/**
 * tsx loads many repo `.ts` modules as CJS interop when imported from this subtree,
 * so named ESM imports break. Default-import + narrow casts restore stable bindings.
 */
import type { KuzeContext } from "../../../lib/kuze";
import * as kuzePrompts from "../../../lib/kuze";
import * as serviceMod from "../../../lib/supabase/service";
import * as constantsMod from "../../../lib/video/constants";
import * as loggingMod from "../../../lib/video/logging";
import type { DemoforgePersonaRow, DemoforgeServiceClient } from "../../../server/src/demoforge/getPersona";
import * as personaLib from "../../../server/src/demoforge/getPersona";

export const { createServiceSupabaseClient } = serviceMod as typeof import("../../../lib/supabase/service");

export const { VIDEO_GUARDRAILS, VIDEO_JOB_STATUS, VIDEO_QUEUE_NAMES } =
  constantsMod as typeof import("../../../lib/video/constants");

export const { logVideoOperation } = loggingMod as typeof import("../../../lib/video/logging");

export const { KUZE_SESSION_FACTS } = kuzePrompts as {
  KUZE_SESSION_FACTS: (ctx: KuzeContext) => string;
};

export const { buildDemoSystemPrompt, getPersona } = personaLib as {
  buildDemoSystemPrompt: (persona: DemoforgePersonaRow) => string;
  getPersona: (supabase: DemoforgeServiceClient, productId: string) => Promise<DemoforgePersonaRow>;
};
