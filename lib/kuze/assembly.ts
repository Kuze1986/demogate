import type { KuzeContext } from "@/lib/kuze";
import { KUZE_SESSION_FACTS, KUZE_SYSTEM_PROMPT } from "@/lib/kuze";
import type { DemoforgePersonaRow } from "@/server/src/demoforge/getPersona";
import { buildDemoSystemPrompt } from "@/server/src/demoforge/getPersona";

export const KUZE_VOICE_APPENDIX = `
Voice contract (applies everywhere Kuze speaks or writes):
- Direct, surgical, never performative.
- Ground claims in operational reality for workforce + pharmacy training orgs.
- Prefer crisp recommendations over generic encouragement.
`.trim();

export function buildKuzeModelSystemPrompt(input: {
  persona: DemoforgePersonaRow;
  kuzeContext: KuzeContext;
}): string {
  const base = buildDemoSystemPrompt(input.persona);
  const overlay = KUZE_SYSTEM_PROMPT(input.kuzeContext);
  const behavioral = input.kuzeContext.behavioralState;
  const behavioralSection = behavioral
    ? [
        "Live behavioral intelligence (adapt your approach in real time):",
        `- Engagement trajectory: ${behavioral.engagement_trajectory} (${{
          rising: "prospect is engaging more deeply",
          falling: "prospect is losing interest",
          stable: "prospect is at baseline engagement",
          volatile: "prospect signals are inconsistent",
        }[behavioral.engagement_trajectory]})`,
        "- Friction points (areas of hesitation or resistance):",
        ...(behavioral.friction_points.length
          ? behavioral.friction_points.map((point) => `  - ${point}`)
          : ["  - none detected"]),
        `- Recommended pivot: ${
          behavioral.recommended_pivot ??
          "none provided; if engagement is falling or a friction point is active, choose a concrete pivot that lowers complexity and reconnects to the prospect's top pain."
        }`,
        `- Confidence: ${behavioral.confidence.toFixed(2)} (${behavioral.confidence < 0.4 ? "weight this signal lightly; validate with live conversation cues before pivoting." : "use this signal as meaningful guidance, while still validating in conversation."})`,
      ].join("\n")
    : null;
  return [base, KUZE_VOICE_APPENDIX, behavioralSection ? `${overlay}\n\n${behavioralSection}` : overlay].join(
    "\n\n"
  );
}

export function buildKuzeSessionFacts(input: { kuzeContext: KuzeContext }): string {
  return [KUZE_SESSION_FACTS(input.kuzeContext), KUZE_VOICE_APPENDIX].join("\n\n");
}

export function buildKuzeRoutingAugmentation(): string {
  return [
    KUZE_VOICE_APPENDIX,
    "When routing, bias toward operational fit: map pains to a single best product/persona pair.",
  ].join("\n\n");
}

export function buildKuzeFollowupSystemPrompt(input: {
  persona: DemoforgePersonaRow;
  kuzeContext: KuzeContext;
}): string {
  return [
    buildDemoSystemPrompt(input.persona),
    KUZE_VOICE_APPENDIX,
    "You are drafting a follow-up email as Kuze. Keep it concise, specific, and action-oriented.",
    KUZE_SESSION_FACTS(input.kuzeContext),
  ].join("\n\n");
}

export function buildKuzeVideoArchitectContext(input: {
  persona: DemoforgePersonaRow;
  kuzeContext: KuzeContext;
}): { system: string; facts: string } {
  return {
    system: buildDemoSystemPrompt(input.persona),
    facts: buildKuzeSessionFacts({ kuzeContext: input.kuzeContext }),
  };
}
