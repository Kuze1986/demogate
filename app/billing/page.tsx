import Link from "next/link";
import { BillingActions } from "@/components/billing/BillingActions";
import { Card } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function stripeEnvReady(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      process.env.STRIPE_PRICE_SUBSCRIPTION_PRO &&
      process.env.STRIPE_PRICE_ONE_TIME_CREDITS
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const sp = await searchParams;
  const checkout = sp.checkout;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscriptionSummary: { status: string; current_period_end: string | null } | null =
    null;
  if (user?.email) {
    const svc = createServiceSupabaseClient();
    const { data: cust } = await svc
      .from("billing_customers")
      .select("id")
      .ilike("email", user.email)
      .maybeSingle();
    if (cust?.id) {
      const { data: sub } = await svc
        .from("billing_subscriptions")
        .select("status, current_period_end")
        .eq("billing_customer_id", cust.id as string)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) {
        subscriptionSummary = {
          status: sub.status as string,
          current_period_end: (sub.current_period_end as string | null) ?? null,
        };
      }
    }
  }

  const stripeOk = stripeEnvReady();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">DemoForge</p>
      <h1 className="mt-2 text-3xl font-semibold">Plans & billing</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Choose a subscription for continuous delivery, or purchase one-time credits for
        campaign bursts. State syncs from Stripe webhooks into your workspace record.
      </p>

      {checkout === "success" && (
        <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Checkout completed. It may take a few seconds for subscription status to appear
          below after the webhook runs.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="mt-6 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          Checkout was cancelled. You can restart whenever you are ready.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Current subscription</h2>
          {user ? (
            subscriptionSummary ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Status: <span className="font-medium">{subscriptionSummary.status}</span>
                {subscriptionSummary.current_period_end && (
                  <>
                    {" "}
                    · Renews or ends{" "}
                    {new Date(subscriptionSummary.current_period_end).toLocaleString()}
                  </>
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                No active subscription record found yet for {user.email}.
              </p>
            )
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Sign in to see subscription state linked to your email.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Purchase</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You will be redirected to Stripe Checkout. Taxes and invoices are handled in
            Stripe.
          </p>
          <div className="mt-4">
            <BillingActions
              stripeConfigured={stripeOk}
              isAuthenticated={Boolean(user)}
            />
          </div>
        </Card>

        <p className="text-center text-sm text-zinc-500">
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
