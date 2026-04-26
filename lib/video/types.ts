import type { Json } from "@/lib/supabase/types";
import type { VIDEO_JOB_STATUS, VIDEO_RENDER_STATUS, VIDEO_VARIANT_TYPES } from "./constants";

export type VideoJobStatus = (typeof VIDEO_JOB_STATUS)[keyof typeof VIDEO_JOB_STATUS];
export type VideoRenderStatus =
  (typeof VIDEO_RENDER_STATUS)[keyof typeof VIDEO_RENDER_STATUS];
export type VideoVariantType = (typeof VIDEO_VARIANT_TYPES)[number];
export type VideoJobTrigger = "intake" | "manual" | "post_live";
export type VideoDeviceProfile = "desktop" | "mobile";

export interface VideoJobRow {
  id: string;
  parent_session_id: string;
  prospect_id: string | null;
  triggered_by: VideoJobTrigger;
  status: VideoJobStatus;
  priority: number;
  target_variants: VideoVariantType[];
  retries: number;
  max_retries: number;
  max_runtime_seconds: number;
  correlation_id: string;
  orchestrator_ref: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoRenderRow {
  id: string;
  video_job_id: string;
  variant_id: string | null;
  status: VideoRenderStatus;
  raw_video_path: string | null;
  final_video_path: string | null;
  manifest_json: Json | null;
  naturalness_score: number | null;
  duration_seconds: number | null;
  language: string | null;
  device_profile: VideoDeviceProfile | null;
  created_at: string;
  updated_at: string;
}

export interface VideoVariantRow {
  id: string;
  video_job_id: string;
  variant_type: VideoVariantType;
  variant_label: string | null;
  performance_score: number | null;
  locale: string | null;
  device_profile: VideoDeviceProfile | null;
  created_at: string;
}

export interface VideoHotspotRow {
  id: string;
  render_id: string;
  start_seconds: number;
  end_seconds: number;
  label: string;
  target_url: string;
  context_payload: Json | null;
}

export interface VideoEventRow {
  id: string;
  render_id: string;
  session_id: string | null;
  event_type: string;
  event_at: string;
  playback_seconds: number | null;
  metadata: Json | null;
}
