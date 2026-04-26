import { randomUUID } from "node:crypto";
import type { EnqueueVideoJobInput, GeneratedScript } from "../../../lib/video/contracts";
import { createServiceSupabaseClient, getPersona } from "./libInterop";
import { buildKuzeVideoArchitectContext } from "../../../lib/kuze/assembly";

export interface ScriptEngineInput extends EnqueueVideoJobInput {
  scriptVersion: string;
}

/**
 * Deterministic script shape generator for capture jobs.
 * Persist its output together with the input payload.
 */
export async function buildVideoScript(input: ScriptEngineInput): Promise<GeneratedScript> {
  const supabase = createServiceSupabaseClient();
  const { data: session } = await supabase
    .from("demo_sessions")
    .select("id, track_id, prospect_id, current_module_id")
    .eq("id", input.sessionId)
    .single();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("first_name, last_name, organization, role, pain_points")
    .eq("id", session?.prospect_id as string)
    .single();
  const { data: track } = await supabase
    .from("demo_tracks")
    .select("name, product")
    .eq("id", session?.track_id as string)
    .single();

  const persona = await getPersona(supabase, input.product);
  const first = prospect?.first_name ?? "";
  const last = prospect?.last_name ?? "";
  const prospectName = `${first} ${last}`.trim() || "Guest";

  const { system, facts: context } = buildKuzeVideoArchitectContext({
    persona,
    kuzeContext: {
      prospectName,
      organization: (prospect?.organization as string) ?? "",
      role: (prospect?.role as string) ?? "",
      painPoints: (prospect?.pain_points as string[] | null) ?? [],
      productName: input.product,
      trackName: (track?.name as string) ?? "",
      currentModuleTitle: "Video Demo",
    },
  });

  return {
    scriptVersion: input.scriptVersion,
    correlationId: input.correlationId ?? randomUUID(),
    product: input.product,
    persona: input.persona,
    locale: input.locale ?? "en",
    deviceProfile: input.deviceProfiles?.[0] ?? "desktop",
    steps: [
      { id: "open", title: "Open demo landing", action: "navigate", value: "/demo" },
      { id: "intake", title: "Summarize persona intent", action: "wait", waitMs: 450 },
      { id: "module_1", title: "Show first module", action: "wait", waitMs: 900 },
      { id: "cta", title: "Highlight CTA", action: "wait", waitMs: 650 },
    ],
    narration: [
      { stepId: "open", text: persona.opening_line ?? "Welcome to your personalized demo." },
      { stepId: "intake", text: `Prospect context: ${context}` },
      { stepId: "module_1", text: system },
      { stepId: "cta", text: "Ready to continue with a live walkthrough and next steps." },
    ],
    rawModelOutput: {
      architectPrompt:
        "You are DemoScript Architect. Given prospect context and persona, output a structured step-by-step demo script optimized for video capture.",
      source: "deterministic-v1",
      personalization: {
        websiteProfile: null,
        linkedinProfile: null,
      },
    },
  };
}
