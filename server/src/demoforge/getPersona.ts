import { createServiceSupabaseClient } from "@/lib/supabase/server";

const PERSONA_PROMPT_SEPARATOR = "\n\n---\n\n";

/** Service-role client scoped to `demoforge` — reuse one instance per request. */
export type DemoforgeServiceClient = ReturnType<
  typeof createServiceSupabaseClient
>;

/** Row shape for `demoforge.personas` (hand-maintained; align with Supabase). */
export interface DemoforgePersonaRow {
  product_id: string;
  system_prompt: string;
  demo_context: string | null;
  opening_line: string | null;
  active: boolean | null;
}

export class PersonaNotFoundError extends Error {
  constructor(productId: string) {
    super(`Persona not found for product_id: ${productId}`);
    this.name = "PersonaNotFoundError";
  }
}

export class PersonaInactiveError extends Error {
  constructor(productId: string) {
    super(`Persona inactive for product_id: ${productId}`);
    this.name = "PersonaInactiveError";
  }
}

/**
 * Loads an active persona for a product. Reuses the caller’s service client —
 * pass the same `createServiceSupabaseClient()` instance as the rest of the route.
 */
export async function getPersona(
  supabase: DemoforgeServiceClient,
  productId: string
): Promise<DemoforgePersonaRow> {
  const { data, error } = await supabase
    .from("personas")
    .select("product_id, system_prompt, demo_context, opening_line, active")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new PersonaNotFoundError(productId);
  }

  const row = data as DemoforgePersonaRow;
  if (row.active === false) {
    throw new PersonaInactiveError(productId);
  }

  return row;
}

export function buildDemoSystemPrompt(persona: DemoforgePersonaRow): string {
  const base = persona.system_prompt.trim();
  const extra = (persona.demo_context ?? "").trim();
  if (!extra) {
    return base;
  }
  return `${base}${PERSONA_PROMPT_SEPARATOR}${extra}`;
}
