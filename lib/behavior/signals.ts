import { logSystemEvent } from "@/lib/logging";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function recordBehaviorSignal(input: {
  sessionId?: string | null;
  renderId?: string | null;
  signalKind: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.from("behavior_signals").insert({
      session_id: input.sessionId ?? null,
      render_id: input.renderId ?? null,
      signal_kind: input.signalKind,
      payload: input.payload,
    });
    if (error) {
      await logSystemEvent({
        function_name: "behavior_signals.insert",
        status: "error",
        session_id: input.sessionId ?? undefined,
        message: error.message,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "behavior_signals.insert",
      status: "error",
      session_id: input.sessionId ?? undefined,
      message,
    });
  }
}

export async function forwardSignalToCrucible(
  input: {
    sessionId?: string | null;
    renderId?: string | null;
    signalKind: string;
    payload: Record<string, unknown>;
  },
  kuzeMode: string
): Promise<void> {
  await recordBehaviorSignal(input);

  try {
    const baseUrl = process.env.CRUCIBLE_SIM_BASE_URL;
    if (!baseUrl || !input.sessionId) return;

    const apiKey = process.env.CRUCIBLE_SIM_API_KEY;
    const payload = {
      tenant_id: "demoforge",
      kuze_mode: kuzeMode,
      journey_node_id:
        typeof input.payload.journey_node_id === "string"
          ? input.payload.journey_node_id
          : "unknown",
      signals: [
        {
          signal_type: input.signalKind,
          value: 1,
          timestamp: new Date().toISOString(),
          source: "kuze_adaptation",
        },
      ],
    };

    void fetch(
      new URL(`/api/crucible/session/${encodeURIComponent(input.sessionId)}/signal`, baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-bioloop-key": apiKey } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2_500),
      }
    ).catch((error) => {
      console.error(error);
    });
  } catch (error) {
    console.error(error);
  }
}
