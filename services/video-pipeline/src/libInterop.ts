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
import * as crucibleMod from "../../../lib/crucible/client";
import type { CrucibleProfileResult } from "../../../lib/crucible/client";
import * as integrationsMod from "../../../lib/integrations/index";
import * as mediaMod from "../../../lib/media/url";
import * as storageMod from "../../../lib/video/storage";
import type { EnqueueVideoJobInput, GeneratedScript, RenderManifest, VideoQueuePayload } from "../../../lib/video/contracts";

export const { createServiceSupabaseClient } = serviceMod as typeof import("../../../lib/supabase/service");

export const VIDEO_GUARDRAILS = (constantsMod as typeof import("../../../lib/video/constants")).VIDEO_GUARDRAILS;
export const VIDEO_JOB_STATUS = (constantsMod as typeof import("../../../lib/video/constants")).VIDEO_JOB_STATUS;
export const VIDEO_QUEUE_NAMES = (constantsMod as typeof import("../../../lib/video/constants")).VIDEO_QUEUE_NAMES;
  

export const { logVideoOperation } = loggingMod as typeof import("../../../lib/video/logging");

export const { KUZE_SESSION_FACTS } = kuzePrompts as {
  KUZE_SESSION_FACTS: (ctx: KuzeContext) => string;
};

export const { buildDemoSystemPrompt, getPersona } = personaLib as {
  buildDemoSystemPrompt: (persona: DemoforgePersonaRow) => string;
  getPersona: (supabase: DemoforgeServiceClient, productId: string) => Promise<DemoforgePersonaRow>;
};

export const fetchCrucibleBehaviorProfile = (crucibleMod as {
  fetchCrucibleBehaviorProfile: (input: {
    sessionId?: string;
    correlationId: string;
    product: string;
    persona: string;
  }) => Promise<CrucibleProfileResult>;
}).fetchCrucibleBehaviorProfile;

export const { dispatchIntegrationEvent } = integrationsMod as typeof import("../../../lib/integrations/index");

export const { buildCanonicalMediaPublicUrl } = mediaMod as typeof import("../../../lib/media/url");

export const { uploadFinalRenderToStorage } = storageMod as typeof import("../../../lib/video/storage");

export type { EnqueueVideoJobInput, GeneratedScript, RenderManifest, VideoQueuePayload } from "../../../lib/video/contracts";