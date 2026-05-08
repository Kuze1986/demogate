import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type IlitaSignificance = "low" | "medium" | "high" | "critical";

let cached: SupabaseClient | null = null;

function getNexusServiceClient(): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null;
  if (!url || !key) {
    return null;
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/**
 * Ilita observer — best-effort insert into `ilita.app_observations`.
 * Never throws; never blocks user-facing flows.
 */
export async function observe(
  eventType: string,
  payload: Record<string, unknown>,
  options?: { userId?: string; significance?: IlitaSignificance }
): Promise<void> {
  try {
    const supabase = getNexusServiceClient();
    if (!supabase) return;

    const { error } = await supabase.schema("ilita").from("app_observations").insert({
      app: "DemoForge",
      event_type: eventType,
      payload,
      user_id: options?.userId ?? null,
      significance: options?.significance ?? "low",
    });
    if (error) {
      // Swallow — Ilita must not break primary flows (table/RLS may be absent in some envs).
      return;
    }
  } catch {
    /* never block user flow */
  }
}
