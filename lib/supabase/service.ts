import { createClient } from "@supabase/supabase-js";
import { DEMOFORGE_SCHEMA } from "./types";

/** Service-role client for `demoforge` — safe to import from workers and scripts (no Next.js runtime). */
export function createServiceSupabaseClient() {
  return createServiceSupabaseClientForSchema(DEMOFORGE_SCHEMA);
}

export function createServiceSupabaseClientForSchema(schema: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });
}

/** Service client without default schema (e.g. auth schema). */
export function createServiceSupabaseClientPublicSchema() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
