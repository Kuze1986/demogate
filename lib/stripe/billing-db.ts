import { logSystemEvent } from "@/lib/logging";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type DemoforgeClient = ReturnType<typeof createServiceSupabaseClient>;

export async function upsertBillingCustomer(
  supabase: DemoforgeClient,
  input: {
    stripeCustomerId: string;
    email: string;
    userId?: string | null;
    tenantId?: string | null;
  }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("billing_customers")
    .upsert(
      {
        stripe_customer_id: input.stripeCustomerId,
        email: input.email.toLowerCase(),
        user_id: input.userId ?? null,
        tenant_id: input.tenantId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_customer_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error || !data) {
    await logSystemEvent({
      function_name: "stripe.billing_customers.upsert",
      status: "error",
      message: error?.message ?? "upsert failed",
      payload: { stripeCustomerId: input.stripeCustomerId },
    });
    throw new Error(error?.message ?? "Failed to upsert billing customer");
  }
  return { id: data.id as string };
}

export async function findBillingCustomerByEmail(
  supabase: DemoforgeClient,
  email: string
): Promise<{ id: string; stripe_customer_id: string } | null> {
  const { data, error } = await supabase
    .from("billing_customers")
    .select("id, stripe_customer_id")
    .ilike("email", email.trim())
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    id: data.id as string,
    stripe_customer_id: data.stripe_customer_id as string,
  };
}

export async function upsertBillingSubscription(
  supabase: DemoforgeClient,
  input: {
    billingCustomerId: string;
    stripeSubscriptionId: string;
    status: string;
    priceId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
  }
): Promise<void> {
  const { error } = await supabase.from("billing_subscriptions").upsert(
    {
      billing_customer_id: input.billingCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      status: input.status,
      price_id: input.priceId ?? null,
      current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (error) {
    await logSystemEvent({
      function_name: "stripe.billing_subscriptions.upsert",
      status: "error",
      message: error.message,
      payload: { stripeSubscriptionId: input.stripeSubscriptionId },
    });
    throw new Error(error.message);
  }
}

export async function insertBillingInvoice(
  supabase: DemoforgeClient,
  input: {
    billingCustomerId: string;
    stripeInvoiceId?: string | null;
    stripePaymentIntentId?: string | null;
    amountPaid?: number | null;
    currency?: string | null;
    status?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("billing_invoices").insert({
    billing_customer_id: input.billingCustomerId,
    stripe_invoice_id: input.stripeInvoiceId ?? null,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    amount_paid: input.amountPaid ?? null,
    currency: input.currency ?? null,
    status: input.status ?? null,
  });
  if (error) {
    await logSystemEvent({
      function_name: "stripe.billing_invoices.insert",
      status: "error",
      message: error.message,
    });
    throw new Error(error.message);
  }
}
