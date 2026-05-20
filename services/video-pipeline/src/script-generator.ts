// @ts-nocheck
/**
 * LLM-powered demo script + narration generator.
 * Uses Anthropic SDK to generate narration cues for each demo step.
 * Self-contained: only npm packages + node builtins (no @/ aliases).
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const SCHEMA = "demoforge";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });
}

export interface ScriptStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  waitMs?: number;
  title: string;
  key?: string;
  notes?: string;
}

export interface NarrationCue {
  stepId: string;
  text: string;
  tone: string;
  estimatedSeconds: number;
}

export interface GeneratedScript {
  correlationId: string;
  product: string;
  persona: string;
  locale: string;
  deviceProfile: string;
  prospectName: string;
  trackName: string;
  baseUrl: string;
  steps: ScriptStep[];
  narration: NarrationCue[];
}

/**
 * Fetch the script template + product from the DB for a given job payload.
 * Falls back to legacy NEXUS hardcoded script when no scriptTemplateId is present.
 */
export async function buildGeneratedScript(payload: {
  jobId: string;
  sessionId: string;
  correlationId?: string;
  scriptTemplateId?: string;
  tenantId?: string;
  product?: string;
  persona?: string;
  locale?: string;
  deviceProfiles?: string[];
  voiceId?: string;
}): Promise<GeneratedScript & { voiceId?: string }> {
  const supabase = db();
  const correlationId = payload.correlationId ?? payload.jobId;

  // Fetch session + prospect (shared by both paths)
  const { data: session } = await supabase
    .from("demo_sessions")
    .select("id,track_id,prospect_id")
    .eq("id", payload.sessionId)
    .maybeSingle();

  const { data: prospect } = session?.prospect_id
    ? await supabase
        .from("prospects")
        .select("first_name,last_name,organization,role,pain_points")
        .eq("id", session.prospect_id)
        .maybeSingle()
    : { data: null };

  const prospectName =
    [prospect?.first_name ?? "", prospect?.last_name ?? ""].join(" ").trim() || "Guest";

  // ── Tenant-custom script template path ──────────────────────────────────────
  if (payload.scriptTemplateId) {
    const { data: template } = await supabase
      .from("demo_script_templates")
      .select("id,name,steps,talking_points,tone,product_id")
      .eq("id", payload.scriptTemplateId)
      .maybeSingle();

    if (!template) {
      throw new Error(`Script template ${payload.scriptTemplateId} not found`);
    }

    const { data: product } = template.product_id
      ? await supabase
          .from("tenant_products")
          .select("id,name,base_url,description")
          .eq("id", template.product_id)
          .maybeSingle()
      : { data: null };

    // Fetch tenant voice ID if not overridden in payload
    let voiceId = payload.voiceId;
    if (!voiceId && payload.tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("elevenlabs_voice_id")
        .eq("id", payload.tenantId)
        .maybeSingle();
      voiceId = tenant?.elevenlabs_voice_id ?? undefined;
    }

    const steps: ScriptStep[] = Array.isArray(template.steps) ? template.steps : [];
    const narration = await generateNarration({
      steps,
      talkingPoints: template.talking_points ?? [],
      tone: template.tone ?? "confident",
      prospectName,
      prospectRole: prospect?.role ?? "",
      productName: product?.name ?? template.name,
      painPoints: prospect?.pain_points ?? [],
    });

    return {
      correlationId,
      product: product?.name ?? "demo",
      persona: payload.persona ?? "unknown",
      locale: payload.locale ?? "en",
      deviceProfile: payload.deviceProfiles?.[0] ?? "desktop",
      prospectName,
      trackName: template.name,
      baseUrl: product?.base_url ?? "",
      steps,
      narration,
      voiceId,
    };
  }

  // ── Legacy NEXUS hardcoded path (no scriptTemplateId) ───────────────────────
  const { data: track } = session?.track_id
    ? await supabase
        .from("demo_tracks")
        .select("name,product")
        .eq("id", session.track_id)
        .maybeSingle()
    : { data: null };

  const shiftUrl = "https://the-shift.up.railway.app";
  const email = process.env.SHIFT_DEMO_EMAIL ?? "kuze@theshift.gg";
  const password = process.env.SHIFT_DEMO_PW ?? "";

  const steps: ScriptStep[] = [
    { id: "login",      action: "navigate",   value: `${shiftUrl}/login`,        title: "Open login"       },
    { id: "email",      action: "type",        selector: "input[type='email']",   value: email,             title: "Enter email"      },
    { id: "password",   action: "type",        selector: "input[type='password']", value: password,         title: "Enter password"   },
    { id: "submit",     action: "clickText",   value: "SIGN IN WITH PASSWORD",                              title: "Submit login"     },
    { id: "wait_auth",  action: "waitForURL",  value: "login",                                              title: "Wait for auth"    },
    { id: "settle",     action: "wait",        waitMs: 1500,                                                title: "Settle dashboard" },
    { id: "home",       action: "navigate",    value: `${shiftUrl}/home`,                                   title: "Dashboard"        },
    { id: "hold_home",  action: "wait",        waitMs: 3000,                                                title: "Show dashboard"   },
    { id: "war_plans",  action: "navigate",    value: `${shiftUrl}/MissionTable`,                           title: "War Plans"        },
    { id: "hold_plans", action: "wait",        waitMs: 3000,                                                title: "Show War Plans"   },
    { id: "boss",       action: "navigate",    value: `${shiftUrl}/BossFight`,                              title: "Boss Fight"       },
    { id: "hold_boss",  action: "wait",        waitMs: 3000,                                                title: "Show Boss Fight"  },
    { id: "outro",      action: "navigate",    value: `${shiftUrl}/home`,                                   title: "Outro"            },
    { id: "hold_outro", action: "wait",        waitMs: 2000,                                                title: "Hold outro"       },
  ];

  const talkingPoints = [
    "The Shift is the world's first workforce gamification platform",
    "Replace boring compliance training with mission-based gameplay",
    "Managers get real-time performance data through the War Plans dashboard",
    "Employees stay engaged through Boss Fight challenges and leaderboards",
  ];

  const narration = await generateNarration({
    steps,
    talkingPoints,
    tone: "confident",
    prospectName,
    prospectRole: prospect?.role ?? "",
    productName: track?.name ?? "The Shift",
    painPoints: prospect?.pain_points ?? [],
  });

  return {
    correlationId,
    product: track?.product ?? payload.product ?? "keystone",
    persona: payload.persona ?? "unknown",
    locale: payload.locale ?? "en",
    deviceProfile: payload.deviceProfiles?.[0] ?? "desktop",
    prospectName,
    trackName: track?.name ?? "",
    baseUrl: shiftUrl,
    steps,
    narration,
    voiceId: payload.voiceId,
  };
}

/**
 * Call Claude to generate narration cues for each demo step.
 * Returns one cue per visible/meaningful step.
 */
async function generateNarration(input: {
  steps: ScriptStep[];
  talkingPoints: string[];
  tone: string;
  prospectName: string;
  prospectRole: string;
  productName: string;
  painPoints: string[];
}): Promise<NarrationCue[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[script-generator] No ANTHROPIC_API_KEY — using placeholder narration");
    return generateFallbackNarration(input.steps, input.productName);
  }

  // Only narrate meaningful steps (skip waits, type, keyboard internals)
  const narratableSteps = input.steps.filter(
    (s) => !["type", "keyboard", "waitForURL"].includes(s.action)
  );

  if (narratableSteps.length === 0) {
    return generateFallbackNarration(input.steps, input.productName);
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a professional product demo narrator. Write concise, engaging voiceover narration for a screen-recorded product demo video.

Rules:
- Each narration cue covers one demo step (a page/view being shown)
- 1-3 short sentences per cue (spoken aloud, so natural and flowing)
- Match the requested tone: ${input.tone}
- Personalize for the prospect when their name/role is provided
- Weave in the provided talking points naturally — don't list them robotically
- estimatedSeconds = realistic speaking time (avg 130 words/min), typically 4-12 seconds
- Output ONLY valid JSON, no markdown, no explanation`;

  const userPrompt = JSON.stringify({
    productName: input.productName,
    prospectName: input.prospectName,
    prospectRole: input.prospectRole,
    painPoints: input.painPoints,
    talkingPoints: input.talkingPoints,
    steps: narratableSteps.map((s) => ({ id: s.id, title: s.title, action: s.action })),
    outputFormat: {
      narration: [
        {
          stepId: "string — matches step id",
          text: "string — voiceover text for this step",
          tone: "string — one of: confident, friendly, urgent, neutral",
          estimatedSeconds: "number — realistic speaking time in seconds",
        },
      ],
    },
  });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in LLM response");

    const parsed = JSON.parse(jsonMatch[0]);
    const cues: NarrationCue[] = (parsed.narration ?? []).map((c: NarrationCue) => ({
      stepId: String(c.stepId),
      text: String(c.text),
      tone: String(c.tone ?? input.tone),
      estimatedSeconds: Math.max(2, Number(c.estimatedSeconds ?? 6)),
    }));

    console.log(`[script-generator] generated ${cues.length} narration cues`);
    return cues;
  } catch (err) {
    console.error("[script-generator] narration generation failed:", err.message);
    return generateFallbackNarration(input.steps, input.productName);
  }
}

function generateFallbackNarration(steps: ScriptStep[], productName: string): NarrationCue[] {
  return steps
    .filter((s) => !["type", "keyboard", "waitForURL"].includes(s.action))
    .map((s) => ({
      stepId: s.id,
      text: `Now let's take a look at the ${s.title} section of ${productName}.`,
      tone: "neutral",
      estimatedSeconds: 4,
    }));
}
