import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued:    "bg-gray-800 text-gray-400",
    running:   "bg-blue-900/50 text-blue-300",
    succeeded: "bg-green-900/50 text-green-400",
    failed:    "bg-red-900/50 text-red-400",
    dead_letter: "bg-orange-900/50 text-orange-400",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");
  const { tenant } = ctx;

  const svc = createServiceSupabaseClient();

  const [jobsResult, prospectsResult] = await Promise.all([
    svc.from("video_jobs").select("id,status,created_at,correlation_id").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(10),
    svc.from("prospects").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  ]);

  const jobs = jobsResult.data ?? [];
  const prospectCount = prospectsResult.count ?? 0;
  const videosThisMonth = jobs.filter(j => j.status === "succeeded").length;

  const usagePercent = tenant.videos_limit > 0
    ? Math.min(100, Math.round((tenant.videos_used / tenant.videos_limit) * 100))
    : 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <Link
          href="/dashboard/prospects/new"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          + Generate video
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Videos generated</p>
          <p className="text-3xl font-bold text-white">{tenant.videos_used}</p>
          <div className="mt-3 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${usagePercent}%` }} />
          </div>
          <p className="text-xs text-gray-600 mt-1.5">
            {tenant.videos_limit === -1 ? "Unlimited" : `${tenant.videos_used} / ${tenant.videos_limit}`}
            {" "}· {tenant.plan} plan
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Prospects</p>
          <p className="text-3xl font-bold text-white">{prospectCount}</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Succeeded (shown)</p>
          <p className="text-3xl font-bold text-white">{videosThisMonth}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/dashboard/prospects/new" className="rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 transition-colors">
          Add prospect
        </Link>
        <Link href="/dashboard/scripts/new" className="rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 transition-colors">
          Edit script
        </Link>
        <Link href="/dashboard/settings" className="rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 transition-colors">
          Workspace settings
        </Link>
      </div>

      {/* Recent jobs */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent video jobs</h2>
        {jobs.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
            <p className="text-gray-500 text-sm">No videos yet — add a prospect to generate your first demo.</p>
            <Link href="/dashboard/prospects/new" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300 text-sm underline">
              Add your first prospect
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Job ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{job.id.slice(0, 8)}&hellip;</td>
                    <td className="px-5 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/dashboard/videos/${job.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
