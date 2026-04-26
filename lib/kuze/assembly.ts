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
  return [base, KUZE_VOICE_APPENDIX, overlay].join("\n\n");
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
