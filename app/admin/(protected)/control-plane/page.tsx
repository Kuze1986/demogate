import { MissingSchemaBanner } from "@/components/admin/MissingSchemaBanner";
import { Card } from "@/components/ui/Card";
import { isPostgrestTableMissingError } from "@/lib/supabase/postgrest-errors";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function ControlPlanePage() {
  const svc = createServiceSupabaseClient();

  const [logsRes, jobsRes, runsRes] = await Promise.all([
    svc.from("system_logs").select("*").order("occurred_at", { ascending: false }).limit(40),
    svc.from("video_jobs").select("status").limit(500),
    svc
      .from("variant_optimization_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (logsRes.error) {
    throw new Error(logsRes.error.message);
  }
  if (jobsRes.error) {
    throw new Error(jobsRes.error.message);
  }

  const runsMissing = Boolean(runsRes.error && isPostgrestTableMissingError(runsRes.error));
  if (runsRes.error && !runsMissing) {
    throw new Error(runsRes.error.message);
  }

  const logs = logsRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const runs = runsMissing ? [] : (runsRes.data ?? []);

  const jobStats = jobs.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Control plane</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Orchestration health, integration-adjacent signals, and optimizer decisions at a
          glance.
        </p>
      </div>

      {runsMissing && (
        <MissingSchemaBanner tables={["demoforge.variant_optimization_runs"]} />
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Video job mix</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {Object.entries(jobStats).map(([status, count]) => (
            <li
              key={status}
              className="rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">{status}</p>
              <p className="text-2xl font-semibold">{count}</p>
            </li>
          ))}
          {Object.keys(jobStats).length === 0 && (
            <li className="text-zinc-500">No video jobs recorded yet.</li>
          )}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Optimizer decisions</h2>
        <ul className="mt-3 space-y-2 text-xs">
          {runs.map((run) => (
            <li
              key={run.id as string}
              className="rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            >
              <p className="font-medium">
                {(run.product as string) ?? "product"} ·{" "}
                {(run.created_at as string | null) ?? ""}
              </p>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/5 p-2 text-[11px] dark:bg-white/5">
                {JSON.stringify(run.chosen_variants ?? {}, null, 2)}
              </pre>
            </li>
          ))}
          {runs.length === 0 && (
            <li className="text-zinc-500">No optimization runs yet.</li>
          )}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Recent system logs</h2>
        <ul className="mt-3 space-y-2 text-xs">
          {logs.map((log) => (
            <li
              key={log.id as string}
              className="rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            >
              <span className="font-medium">{log.function_name as string}</span> ·{" "}
              <span>{log.status as string}</span> ·{" "}
              <span className="text-zinc-500">{(log.message as string | null) ?? ""}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
