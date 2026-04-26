export const VIDEO_FEATURE_FLAGS = {
  video_pipeline_enabled: "video_pipeline_enabled",
  video_ab_enabled: "video_ab_enabled",
  video_hotspots_enabled: "video_hotspots_enabled",
  video_localization_enabled: "video_localization_enabled",
} as const;

export const VIDEO_JOB_STATUS = {
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  dead_letter: "dead_letter",
} as const;

export const VIDEO_RENDER_STATUS = {
  pending: "pending",
  rendering: "rendering",
  completed: "completed",
  failed: "failed",
} as const;

export const VIDEO_VARIANT_TYPES = [
  "default",
  "hook_a",
  "hook_b",
  "cta_a",
  "cta_b",
  "localized_es",
  "mobile",
] as const;

export const VIDEO_SLO_THRESHOLDS = {
  renderSuccessRateMinPct: 95,
  p95RenderDurationMaxSeconds: 8 * 60,
  firstVideoLatencyMaxSeconds: 12 * 60,
  deliverySuccessRateMinPct: 98,
} as const;

export const VIDEO_QUEUE_NAMES = {
  default: "demoforge-video-jobs",
  deadLetter: "demoforge-video-dead-letter",
} as const;

export const VIDEO_GUARDRAILS = {
  defaultMaxRuntimeSeconds: 15 * 60,
  defaultMaxRetries: 3,
  expensiveVariantTypes: ["localized_es", "mobile"] as const,
} as const;
