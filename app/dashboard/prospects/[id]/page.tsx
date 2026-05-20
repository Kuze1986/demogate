import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");

  const svc = createServiceSupabaseClient();
  const { data: prospect } = await svc
    .from("prospects")
    .select("id,first_name,last_name,email,organization,role,persona,pain_points,is_qualified,created_at")
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!prospect) notFound();

  // Fetch video jobs for this prospect
  const { data: jobs } = await svc
    .from("video_jobs")
    .select("id,status,created_at,correlation_id")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(" ") || prospect.email;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/prospects" className="text-xs text-gray-500 hover:text-gray-400 mb-2 inline-block">&larr; All prospects</Link>
          <h1 className="text-2xl font-bold text-white">{name}</h1>
          <p className="text-sm text-gray-500">{prospect.email}</p>
        </div>
        <form action={`/api/dashboard/prospects/${id}/generate-video`} method="POST">
          <Link
            href={`/dashboard/prospects/${id}/generate-video`}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
            prefetch={false}
          >
            Generate video
          </Link>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          ["Organization", prospect.organization],
          ["Role", prospect.role],
          ["Persona", prospect.persona],
          ["Qualified", prospect.is_qualified ? "Yes" : "No"],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm text-white">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {(prospect.pain_points as string[])?.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Pain points</p>
          <ul className="space-y-1">
            {(prospect.pain_points as string[]).map((p, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">·</span> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Video jobs</h2>
      {!jobs?.length ? (
        <p className="text-sm text-gray-500">No videos generated for this prospect yet.</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{job.id.slice(0, 8)}…</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${job.status === "succeeded" ? "bg-green-900/50 text-green-400" : job.status === "failed" ? "bg-red-900/50 text-red-400" : "bg-gray-800 text-gray-400"}`}>
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
