import { NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/logging";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getStripe,
  resolveStripePriceId,
  type StripePriceKey,
} from "@/lib/stripe/server";

export const runtime = "nodejs";

const VALID_MODES = ["subscription", "payment"] as const;
type CheckoutMode = (typeof VALID_MODES)[number];

function isPriceKey(s: string): s is StripePriceKey {
  return s === "subscription_pro" || s === "one_time_credits";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: string;
      priceKey?: string;
      tenantId?: string | null;
    };
    const mode = body.mode as CheckoutMode | undefined;
    const priceKey = body.priceKey;

    if (!mode || !VALID_MODES.includes(mode as CheckoutMode)) {
      await logSystemEvent({
        function_name: "stripe.checkout",
        status: "error",
        message: "Invalid mode",
        payload: { mode: body.mode ?? null },
      });
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    if (!priceKey || typeof priceKey !== "string" || !isPriceKey(priceKey)) {
      await logSystemEvent({
        function_name: "stripe.checkout",
        status: "error",
        message: "Invalid priceKey",
        payload: { priceKey: priceKey ?? null },
      });
      return NextResponse.json({ error: "Invalid priceKey" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
      await logSystemEvent({
        function_name: "stripe.checkout",
        status: "error",
        message: "Missing NEXT_PUBLIC_APP_URL",
      });
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let userEmail: string | null = null;
    let userId: string | null = null;
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
      userId = user?.id ?? null;
    } catch {
      /* anonymous checkout allowed */
    }

    const stripe = getStripe();
    const priceId = resolveStripePriceId(priceKey);

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      customer_creation: userEmail ? undefined : "always",
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: {
        app: "demoforge",
        priceKey,
        ...(userId ? { user_id: userId } : {}),
        ...(body.tenantId ? { tenant_id: body.tenantId } : {}),
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      await logSystemEvent({
        function_name: "stripe.checkout",
        status: "error",
        message: "Stripe returned no session URL",
      });
      return NextResponse.json({ error: "Checkout unavailable" }, { status: 502 });
    }

    await logSystemEvent({
      function_name: "stripe.checkout",
      status: "success",
      message: "Checkout session created",
      payload: { sessionId: session.id, mode, priceKey },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "stripe.checkout",
      status: "error",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
