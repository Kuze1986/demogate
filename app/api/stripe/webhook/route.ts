import { NextResponse } from "next/server";
import Stripe from "stripe";
import { logSystemEvent } from "@/lib/logging";
import {
  findBillingCustomerByEmail,
  insertBillingInvoice,
  upsertBillingCustomer,
  upsertBillingSubscription,
} from "@/lib/stripe/billing-db";
import { getStripe } from "@/lib/stripe/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

async function wasEventAlreadyProcessed(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("billing_events")
    .select("id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

async function recordProcessedEvent(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  event: Stripe.Event
): Promise<void> {
  const payload = JSON.parse(JSON.stringify(event.data.object)) as Record<string, unknown>;
  const { error } = await supabase.from("billing_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    payload,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    await logSystemEvent({
      function_name: "stripe.webhook",
      status: "error",
      message: "Missing STRIPE_WEBHOOK_SECRET",
    });
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "stripe.webhook",
      status: "error",
      message: `Signature verification failed: ${message}`,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  try {
    if (await wasEventAlreadyProcessed(supabase, event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const stripe = getStripe();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email =
          (session.customer_details?.email ??
            session.customer_email ??
            "") ||
          "";
        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (!stripeCustomerId || !email) {
          await logSystemEvent({
            function_name: "stripe.webhook",
            status: "error",
            message: "checkout.session.completed missing customer or email",
            payload: { sessionId: session.id },
          });
          break;
        }

        const tenantId =
          typeof session.metadata?.tenant_id === "string"
            ? session.metadata.tenant_id
            : null;
        const userId =
          typeof session.metadata?.user_id === "string"
            ? session.metadata.user_id
            : null;

        const { id: billingCustomerId } = await upsertBillingCustomer(supabase, {
          stripeCustomerId,
          email,
          userId,
          tenantId,
        });

        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items.data[0]?.price?.id ?? null;
          await upsertBillingSubscription(supabase, {
            billingCustomerId,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            priceId,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
        }

        if (session.mode === "payment" && session.payment_intent) {
          const pi =
            typeof session.payment_intent === "string"
              ? await stripe.paymentIntents.retrieve(session.payment_intent)
              : session.payment_intent;
          await insertBillingInvoice(supabase, {
            billingCustomerId,
            stripePaymentIntentId: pi.id,
            amountPaid: pi.amount_received ?? pi.amount ?? null,
            currency: pi.currency ?? null,
            status: pi.status ?? null,
          });
        }

        await logSystemEvent({
          function_name: "stripe.webhook",
          status: "success",
          message: "checkout.session.completed processed",
          payload: { sessionId: session.id, mode: session.mode },
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: row } = await supabase
          .from("billing_subscriptions")
          .select("billing_customer_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        const billingCustomerId = row?.billing_customer_id as string | undefined;
        if (!billingCustomerId) {
          const customerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          if (!customerId) break;
          const cust = await stripe.customers.retrieve(customerId);
          if (cust.deleted) break;
          const email = cust.email ?? "";
          if (!email) break;
          const { id } = await upsertBillingCustomer(supabase, {
            stripeCustomerId: customerId,
            email,
            userId: null,
            tenantId: null,
          });
          await upsertBillingSubscription(supabase, {
            billingCustomerId: id,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            priceId: sub.items.data[0]?.price?.id ?? null,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
        } else {
          await upsertBillingSubscription(supabase, {
            billingCustomerId,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            priceId: sub.items.data[0]?.price?.id ?? null,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
        }
        await logSystemEvent({
          function_name: "stripe.webhook",
          status: "success",
          message: event.type,
          payload: { subscriptionId: sub.id, status: sub.status },
        });
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (!customerId) break;
        const cust = await stripe.customers.retrieve(customerId);
        if (cust.deleted || !cust.email) break;
        const existing = await findBillingCustomerByEmail(supabase, cust.email);
        if (!existing) break;
        await insertBillingInvoice(supabase, {
          billingCustomerId: existing.id,
          stripeInvoiceId: inv.id ?? null,
          amountPaid: inv.amount_paid ?? null,
          currency: inv.currency ?? null,
          status: inv.status ?? null,
        });
        await logSystemEvent({
          function_name: "stripe.webhook",
          status: "success",
          message: "invoice.paid",
          payload: { invoiceId: inv.id },
        });
        break;
      }
      default:
        await logSystemEvent({
          function_name: "stripe.webhook",
          status: "success",
          message: `Ignored event type ${event.type}`,
          payload: { type: event.type },
        });
    }

    try {
      await recordProcessedEvent(supabase, event);
    } catch (insErr: unknown) {
      const code =
        insErr && typeof insErr === "object" && "code" in insErr
          ? String((insErr as { code?: string }).code)
          : "";
      if (code !== "23505") {
        throw insErr;
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "stripe.webhook",
      status: "error",
      message,
      payload: { eventId: event.id, type: event.type },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
