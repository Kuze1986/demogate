import { NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/logging";
import { findBillingCustomerByEmail } from "@/lib/stripe/billing-db";
import { getStripe } from "@/lib/stripe/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireBillingAdminForTenant } from "@/lib/governance/policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.email) {
      await logSystemEvent({
        function_name: "stripe.portal",
        status: "error",
        message: "Unauthorized",
      });
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    let tenantId: string | null = null;
    try {
      const json = (await request.json()) as { tenantId?: string | null };
      tenantId = json.tenantId ?? null;
    } catch {
      /* optional body */
    }

    if (tenantId) {
      const svc = createServiceSupabaseClient();
      await requireBillingAdminForTenant(svc, user.id, tenantId);
    }

    const svc = createServiceSupabaseClient();
    const customer = await findBillingCustomerByEmail(svc, user.email);
    if (!customer) {
      await logSystemEvent({
        function_name: "stripe.portal",
        status: "error",
        message: "No billing customer for user",
        payload: { email: user.email },
      });
      return NextResponse.json(
        { error: "No billing profile found. Complete a purchase first." },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    await logSystemEvent({
      function_name: "stripe.portal",
      status: "success",
      message: "Billing portal session created",
      payload: { userId: user.id },
    });

    return NextResponse.json({ url: portal.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "stripe.portal",
      status: "error",
      message,
    });
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
