import { logSystemEvent } from "@/lib/logging";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export interface OutboundWebhookPayload {
  eventType: string;
  idempotencyKey?: string | null;
  body: Record<string, unknown>;
}

export async function deliverOutboundWebhook(input: {
  endpointId: string;
  url: string;
  secret?: string | null;
  payload: OutboundWebhookPayload;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const idem = input.payload.idempotencyKey ?? null;
  const supabase = createServiceSupabaseClient();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Demoforge-Event": input.payload.eventType,
  };
  if (idem) {
    headers["X-Demoforge-Idempotency-Key"] = idem;
  }
  if (input.secret) {
    headers["X-Demoforge-Signature"] = input.secret;
  }

  try {
    const res = await fetch(input.url, {
      method: "POST",
      headers,
      body: JSON.stringify(input.payload.body),
      signal: AbortSignal.timeout(12_000),
    });
    const ok = res.ok;
    const { error } = await supabase.from("integration_deliveries").insert({
      endpoint_id: input.endpointId,
      event_type: input.payload.eventType,
      idempotency_key: idem,
      status: ok ? "delivered" : "failed",
      attempt: 1,
      response_code: res.status,
      error_message: ok ? null : await res.text().catch(() => "request failed"),
      payload: input.payload.body,
    });
    if (error) {
      await logSystemEvent({
        function_name: "integration_deliveries.insert",
        status: "error",
        message: error.message,
      });
    }
    return { ok, status: res.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("integration_deliveries").insert({
      endpoint_id: input.endpointId,
      event_type: input.payload.eventType,
      idempotency_key: idem,
      status: "failed",
      attempt: 1,
      response_code: null,
      error_message: message,
      payload: input.payload.body,
    });
    await logSystemEvent({
      function_name: "integration.webhook.deliver",
      status: "error",
      message,
    });
    return { ok: false, status: 0, error: message };
  }
}
