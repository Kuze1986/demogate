// @ts-nocheck
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ── Types (inlined to avoid lib/ import chain) ────────────────────────────────

export interface ScriptEngineInput {
  jobId: string;
  sessionId: string;
  prospectId?: string | null;
  product: string;
  persona: string;
  triggeredBy: string;
  variants: string[];
  deviceProfiles?: string[];
  locale?: string;
  priority?: number;
  correlationId?: string;
  createdAtIso?: string;
  scriptVersion: string;
}

interface GeneratedScript {
  scriptVersion: string;
  correlationId: string;
  product: string;
  persona: string;
  locale: string;
  deviceProfile: string;
  steps: Array<{
    id: string;
    title: string;
    action: "navigate" | "click" | "type" | "wait";
    value?: string;
    selector?: string;
    waitMs?: number;
  }>;
  narration: Array<{ stepId: string; text: string }>;
  rawModelOutput: {
    architectPrompt: string;
    source: string;
    personalization: { websiteProfile: null; linkedinProfile: null };
  };
}

// ── Self-contained Supabase client ────────────────────────────────────────────

function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "demoforge" },
  });
}

// ── Inline context builder (no @/ imports) ────────────────────────────────────

function buildKuzeVideoArchitectContext(input: {
  persona: { opening_line?: string | null; name?: string };
  kuzeContext: {
    prospectName: string;
    organization: string;
    role: string;
    painPoints: string[];
    productName: string;
    trackName: string;
  };
}): { system: string; facts: string } {
  return {
    system: `You are Kuze, an AI demo agent for ${input.kuzeContext.productName}. Voice: direct, surgical, never performative. Ground claims in operational reality for workforce training orgs.`,
    facts: [
      `Prospect: ${input.kuzeContext.prospectName}`,
      `Organization: ${input.kuzeContext.organization}`,
      `Role: ${input.kuzeContext.role}`,
      `Product: ${input.kuzeContext.productName}`,
      `Track: ${input.kuzeContext.trackName}`,
      input.kuzeContext.painPoints.length
        ? `Pain points: ${input.kuzeContext.painPoints.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// ── Script builder ────────────────────────────────────────────────────────────

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
    .maybeSingle();

  const { data: track } = await supabase
    .from("demo_tracks")
    .select("name, product")
    .eq("id", session?.track_id as string)
    .maybeSingle();

  const first = (prospect?.first_name as string) ?? "";
  const last = (prospect?.last_name as string) ?? "";
  const prospectName = `${first} ${last}`.trim() || "Guest";

  const persona = { opening_line: null, name: "Kuze" };

  const { system, facts: context } = buildKuzeVideoArchitectContext({
    persona,
    kuzeContext: {
      prospectName,
      organization: (prospect?.organization as string) ?? "",
      role: (prospect?.role as string) ?? "",
      painPoints: (prospect?.pain_points as string[] | null) ?? [],
      productName: input.product,
      trackName: (track?.name as string) ?? "",
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
      { stepId: "open", text: "Welcome to your personalized demo." },
      { stepId: "intake", text: `Prospect context: ${context}` },
      { stepId: "module_1", text: system },
      { stepId: "cta", text: "Ready to continue with a live walkthrough and next steps." },
    ],
    rawModelOutput: {
      architectPrompt:
        "You are DemoScript Architect. Given prospect context and persona, output a structured step-by-step demo script optimized for video capture.",
      source: "deterministic-v1",
      personalization: { websiteProfile: null, linkedinProfile: null },
    },
  };
}
