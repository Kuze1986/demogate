import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PLANS = [
  { key: "free",       label: "Free",       price: "$0/mo",   videos: 5,    features: ["5 videos/month", "AI narration", "Basic analytics"] },
  { key: "pro",        label: "Pro",         price: "$49/mo",  videos: 100,  features: ["100 videos/month", "AI narration", "Custom branding", "Priority support"] },
  { key: "enterprise", label: "Enterprise",  price: "Custom",  videos: -1,   features: ["Unlimited videos", "Custom voice", "API access", "SLA"] },
];

export default async function BillingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");

  const { tenant } = ctx;
  const usagePercent = tenant.videos_limit > 0
    ? Math.min(100, Math.round((tenant.videos_used / tenant.videos_limit) * 100))
    : 0;

  const svc = createServiceSupabaseClient();
  const { data: billing } = await svc
    .from("billing_customers")
    .select("id,stripe_customer_id")
    .eq("tenant_id", tenant.id)
    .single();

  const hasStripe = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && billing?.stripe_customer_id;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">Billing</h1>

      {/* Current usage */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white capitalize">{tenant.plan} plan</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tenant.videos_limit === -1 ? "Unlimited videos" : `${tenant.videos_used} of ${tenant.videos_limit} videos used this month`}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tenant.plan === "free" ? "bg-gray-800 text-gray-400" : "bg-indigo-900/50 text-indigo-300 border border-indigo-800/50"}`}>
            {tenant.plan}
          </span>
        </div>
        {tenant.videos_limit > 0 && (
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-yellow-500" : "bg-indigo-500"}`} style={{ width: `${usagePercent}%` }} />
          </div>
        )}
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {PLANS.map((plan) => (
          <div key={plan.key} className={`bg-gray-900 rounded-xl border p-5 ${tenant.plan === plan.key ? "border-indigo-600" : "border-gray-800"}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-white text-sm">{plan.label}</p>
              {tenant.plan === plan.key && <span className="text-xs text-indigo-400">Current</span>}
            </div>
            <p className="text-lg font-bold text-white mb-3">{plan.price}</p>
            <ul className="space-y-1 mb-4">
              {plan.features.map(f => (
                <li key={f} className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            {tenant.plan !== plan.key && plan.key !== "enterprise" && hasStripe && (
              <Link
                href="/api/stripe/checkout"
                className="block text-center text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition-colors"
              >
                Upgrade
              </Link>
            )}
            {plan.key === "enterprise" && (
              <a href="mailto:sales@demoforge.app" className="block text-center text-xs font-medium text-indigo-400 hover:text-indigo-300">
                Contact sales
              </a>
            )}
          </div>
        ))}
      </div>

      {!hasStripe && (
        <p className="text-xs text-gray-600 text-center">Billing is not configured for this environment.</p>
      )}
    </div>
  );
}
