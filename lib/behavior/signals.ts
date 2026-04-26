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
