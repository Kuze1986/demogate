import type { Json } from "@/lib/supabase/types";
import type { ProductKey, ProspectPersona } from "@/types/demo";
import type { VideoDeviceProfile, VideoVariantType } from "./types";

export interface DemoScriptStep {
  id: string;
  title: string;
  action: "navigate" | "click" | "type" | "wait" | "assert";
  selector?: string;
  value?: string;
  waitMs?: number;
  notes?: string;
}

export interface DemoNarrationCue {
  stepId: string;
  text: string;
  tone?: "neutral" | "confident" | "urgent" | "friendly";
  startOffsetSeconds?: number;
}

export interface GeneratedScript {
  scriptVersion: string;
  correlationId: string;
  product: ProductKey;
  persona: ProspectPersona;
  locale: string;
  deviceProfile: VideoDeviceProfile;
  steps: DemoScriptStep[];
  narration: DemoNarrationCue[];
  rawModelOutput?: Json;
}

export interface RenderManifest {
  correlationId: string;
  scriptVersion: string;
  stepTimestamps: Array<{ stepId: string; startSeconds: number; endSeconds: number }>;
  hotspots: Array<{
    label: string;
    startSeconds: number;
    endSeconds: number;
    targetUrl: string;
    contextPayload?: Record<string, unknown>;
  }>;
  subtitles?: Array<{ startSeconds: number; endSeconds: number; text: string }>;
}

export interface EnqueueVideoJobInput {
  sessionId: string;
  prospectId?: string | null;
  product: ProductKey;
  persona: ProspectPersona;
  triggeredBy: "intake" | "manual" | "post_live";
  variants: VideoVariantType[];
  priority?: number;
  locale?: string;
  deviceProfiles?: VideoDeviceProfile[];
  correlationId?: string;
}

export interface VideoQueuePayload extends EnqueueVideoJobInput {
  jobId: string;
  createdAtIso: string;
}
