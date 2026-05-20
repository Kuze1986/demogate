import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");

  const svc = createServiceSupabaseClient();
  const { data: prospects, count } = await svc
    .from("prospects")
    .select("id,first_name,last_name,email,organization,role,is_qualified,created_at", { count: "exact" })
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false })
    .range(0, 49);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-sm text-gray-500 mt-1">{count ?? 0} total</p>
        </div>
        <Link href="/dashboard/prospects/new" className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition-colors">
          + Add prospect
        </Link>
      </div>

      {!prospects?.length ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <p className="text-gray-500 text-sm">No prospects yet. Add a prospect to generate a personalized demo video.</p>
          <Link href="/dashboard/prospects/new" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300 text-sm underline">Add first prospect</Link>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(prospects ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">
                    {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{p.email}</td>
                  <td className="px-5 py-3 text-gray-400">{p.organization ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/dashboard/prospects/${p.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
