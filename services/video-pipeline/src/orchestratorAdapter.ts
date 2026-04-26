export async function notifyOrchestrator(input: {
  event: "job_started" | "job_succeeded" | "job_failed";
  correlationId: string;
  videoJobId: string;
  payload?: Record<string, unknown>;
}) {
  const endpoint = process.env.ORCHESTRATOR_WEBHOOK_URL;
  if (!endpoint) return;
  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => undefined);
}
