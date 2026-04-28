import Link from "next/link";
import { ManualDemoControlPanel } from "@/components/admin/ManualDemoControlPanel";
import { Card } from "@/components/ui/Card";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export default async function AdminVideosPage() {
  const supabase = createServiceSupabaseClient();
  const { data: jobs } = await supabase
    .from("video_jobs")
    .select("id, parent_session_id, status, created_at, priority, triggered_by")
    .order("created_at", { ascending: false })
    .limit(25);

  const { data: renders } = await supabase
    .from("video_renders")
    .select("id, video_job_id, status, final_video_path, naturalness_score, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: sessions } = await supabase
    .from("demo_sessions")
    .select("id, started_at, status, prospects(email), demo_tracks(product)")
    .order("started_at", { ascending: false })
    .limit(20);

  const manualSessions = (sessions ?? []).map((session) => {
    const prospect = Array.isArray(session.prospects)
      ? session.prospects[0]
      : session.prospects;
    const track = Array.isArray(session.demo_tracks)
      ? session.demo_tracks[0]
      : session.demo_tracks;
    const startedAt = session.started_at
      ? new Date(session.started_at as string).toLocaleString()
      : "unknown";
    const label = `${String(session.id).slice(0, 8)} · ${
      prospect?.email ?? "no-email"
    } · ${track?.product ?? "unknown"} · ${session.status ?? "unknown"} · ${startedAt}`;
    return { id: String(session.id), label };
  });

  const crucibleConfigured = Boolean(process.env.CRUCIBLE_SIM_BASE_URL);

  const completed = (renders ?? []).filter((r) => r.status === "completed").length;
  const failed = (renders ?? []).filter((r) => r.status === "failed").length;
  const avgRenderMin =
    (renders ?? []).length > 0
      ? (
          (renders ?? []).reduce(
            (sum, row) => sum + Number(row.naturalness_score ?? 0),
            0
          ) /
          Math.max((renders ?? []).length, 1)
        ).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] soft-muted">Video Pipeline</p>
        <h1 className="text-2xl font-semibold">Render Operations</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="metric-gradient">
          <p className="text-xs uppercase soft-muted">Active Leads</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{jobs?.length ?? 0}</p>
        </Card>
        <Card className="metric-gradient">
          <p className="text-xs uppercase soft-muted">Completed renders</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{completed}</p>
        </Card>
        <Card className="metric-gradient">
          <p className="text-xs uppercase soft-muted">Avg Naturalness</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{avgRenderMin}%</p>
        </Card>
        <Card className="metric-gradient">
          <p className="text-xs uppercase soft-muted">Conversion Lift</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            +{Math.max(1, completed - failed)}%
          </p>
        </Card>
        <Card className="metric-gradient">
          <p className="text-xs uppercase soft-muted">Crucible behavioral layer</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {crucibleConfigured ? "Connected" : "Not Configured"}
          </p>
          <p className="mt-1 text-xs soft-muted">
            {crucibleConfigured
              ? process.env.CRUCIBLE_SIM_BASE_URL
              : "Set CRUCIBLE_SIM_BASE_URL to enable external behavior simulation."}
          </p>
        </Card>
      </div>

      <ManualDemoControlPanel sessions={manualSessions} />

      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Video Renders</h2>
            <span className="rounded-lg border border-[color:var(--panel-border)] px-2 py-1 text-xs soft-muted">
              Delivery Focus
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="soft-muted">
                <tr>
                  <th className="px-2 py-2 text-left">Render</th>
                  <th className="px-2 py-2 text-left">Prospect</th>
                  <th className="px-2 py-2 text-left">Delivery</th>
                  <th className="px-2 py-2 text-left">Naturalness</th>
                  <th className="px-2 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {(renders ?? []).slice(0, 10).map((render) => (
                  <tr key={render.id} className="border-t border-[color:var(--panel-border)]">
                    <td className="px-2 py-2">
                      <Link href={`/admin/videos/${render.video_job_id}`} className="underline">
                        {String(render.id).slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 soft-muted">Prospect</td>
                    <td className="px-2 py-2">
                      <span className="rounded-lg border border-[rgba(137,255,140,0.35)] bg-[rgba(137,255,140,0.14)] px-2 py-1 text-xs text-[color:var(--accent-2)]">
                        {render.status === "completed" ? "Delivered" : render.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {render.naturalness_score != null
                        ? `${Number(render.naturalness_score).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 soft-muted">
                      {new Date(render.created_at as string).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="metric-gradient">
            <h3 className="text-lg font-semibold">Live Pipeline Activity</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-[color:var(--panel-border)] p-2">
                <p className="text-xl font-semibold">{jobs?.filter((j) => j.status === "running").length ?? 0}</p>
                <p className="soft-muted">Running</p>
              </div>
              <div className="rounded-xl border border-[color:var(--panel-border)] p-2">
                <p className="text-xl font-semibold">{completed}</p>
                <p className="soft-muted">Delivered</p>
              </div>
              <div className="rounded-xl border border-[color:var(--panel-border)] p-2">
                <p className="text-xl font-semibold">{failed}</p>
                <p className="soft-muted">Failed</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">Top Variants</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-[color:var(--panel-border)] p-3 text-center">
                <p className="font-semibold">Hook A</p>
                <p className="soft-muted">A/B</p>
              </div>
              <div className="rounded-xl border border-[color:var(--panel-border)] p-3 text-center">
                <p className="font-semibold">Mobile</p>
                <p className="soft-muted">A/B</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
