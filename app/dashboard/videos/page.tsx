import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  queued:      "bg-gray-800 text-gray-400",
  running:     "bg-blue-900/50 text-blue-300",
  succeeded:   "bg-green-900/50 text-green-400",
  failed:      "bg-red-900/50 text-red-400",
  dead_letter: "bg-orange-900/50 text-orange-400",
  cancelled:   "bg-gray-800 text-gray-500",
};

export default async function VideosPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");

  const svc = createServiceSupabaseClient();
  const { data: jobs, count } = await svc
    .from("video_jobs")
    .select("id,status,created_at,correlation_id,prospect_id", { count: "exact" })
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false })
    .range(0, 49);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Videos</h1>
          <p className="text-sm text-gray-500 mt-1">{count ?? 0} total</p>
        </div>
        <Link href="/dashboard/prospects/new" className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition-colors">
          + Generate video
        </Link>
      </div>

      {!jobs?.length ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <p className="text-gray-500 text-sm">No videos yet. Add a prospect to generate your first video.</p>
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
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-300">{job.id.slice(0, 8)}…</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_STYLES[job.status] ?? "bg-gray-800 text-gray-400"}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/dashboard/videos/${job.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">View</Link>
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
