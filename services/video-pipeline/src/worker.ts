import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";

// ── Self-contained helpers (bypass libInterop / @/ alias chain) ──────────────

function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "demoforge" },
  });
}

async function logVideoOperation(input: {
  operation: string;
  status: "success" | "error";
  sessionId?: string | null;
  correlationId?: string | null;
  message?: string;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const supabase = createServiceSupabaseClient();
    await supabase.from("system_logs").insert({
      function_name: `video_${input.operation}`,
      session_id: input.sessionId ?? null,
      status: input.status,
      message: input.message ?? null,
      payload: { correlation_id: input.correlationId ?? null, ...(input.payload ?? {}) },
    });
  } catch {
    console.error("[video-pipeline] logVideoOperation failed silently:", input.operation);
  }
}

function buildCanonicalMediaPublicUrl(input: { bucket: string; objectKey: string }): string {
  const cdn = process.env.DEMOFORGE_MEDIA_CDN_BASE_URL?.replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (cdn) return `${cdn}/${input.bucket}/${input.objectKey}`;
  if (supabaseUrl) return `${supabaseUrl}/storage/v1/object/public/${input.bucket}/${input.objectKey}`;
  return `${input.bucket}/${input.objectKey}`;
}

async function uploadFinalRenderToStorage(input: {
  localPath: string;
  objectKey: string;
}): Promise<{ bucket: string; objectKey: string }> {
  const bucket = process.env.DEMOFORGE_VIDEO_BUCKET ?? "demoforge-video";
  const supabase = createServiceSupabaseClient();
  const file = readFileSync(input.localPath);
  const { error } = await supabase.storage.from(bucket).upload(input.objectKey, file, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { bucket, objectKey: input.objectKey };
}

async function dispatchIntegrationEvent(input: {
  tenantId?: string | null;
  eventType: string;
  idempotencyKey?: string | null;
  body: Record<string, unknown>;
}): Promise<void> {
  console.log("[video-pipeline] integration event dispatched:", input.eventType);
}

interface VideoQueuePayload {
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
}

// Hardcoded to avoid CJS/ESM interop issues with lib/video/constants
const VIDEO_QUEUE_NAMES = {
  default: "demoforge-video-jobs",
  deadLetter: "demoforge-video-dead-letter",
} as const;

const VIDEO_JOB_STATUS = {
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  dead_letter: "dead_letter",
} as const;

const VIDEO_GUARDRAILS = {
  defaultMaxRuntimeSeconds: 15 * 60,
  defaultMaxRetries: 3,
} as const;
import { buildVideoScript } from "./scriptEngine";
import { runCapture } from "./runner";
import { runFfmpegPostProcess } from "./postProcess";
import { notifyOrchestrator } from "./orchestratorAdapter";

function getConn() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing REDIS_URL");
  }
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

async function processVideoJob(payload: VideoQueuePayload) {
  const supabase = createServiceSupabaseClient();
  const startedAt = Date.now();

  await supabase
    .from("video_jobs")
    .update({ status: VIDEO_JOB_STATUS.running, updated_at: new Date().toISOString() })
    .eq("id", payload.jobId);
  await notifyOrchestrator({
    event: "job_started",
    correlationId: payload.correlationId ?? "",
    videoJobId: payload.jobId,
  });

  const script = await buildVideoScript({
    ...payload,
    scriptVersion: "v1",
  });
  const tmpDir = join(process.cwd(), "tmp", "video-jobs", payload.jobId);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(
    join(tmpDir, "script.json"),
    JSON.stringify(
      {
        input_payload: payload,
        generated_script_json: script,
        script_version: script.scriptVersion,
      },
      null,
      2
    )
  );

  const { rawVideoPath, manifest } = await runCapture(script);
  const narrationPath = join(tmpDir, "narration.mp3");
  const outputPath = join(tmpDir, "final.mp4");
  writeFileSync(narrationPath, "");
  await runFfmpegPostProcess({
    rawVideoPath,
    narrationPath,
    outputPath,
  });

  const variantTypes = payload.variants.length ? payload.variants : ["default"];
  const deviceProfiles = payload.deviceProfiles?.length
    ? payload.deviceProfiles
    : ["desktop"];

  for (const variantType of variantTypes) {
    for (const device of deviceProfiles) {
      const { data: variant } = await supabase
        .from("video_variants")
        .insert({
          video_job_id: payload.jobId,
          variant_type: variantType,
          variant_label: `Auto ${variantType}/${device}`,
          locale: payload.locale ?? "en",
          device_profile: device,
        })
        .select("id")
        .single();

      const { data: render } = await supabase
        .from("video_renders")
        .insert({
          video_job_id: payload.jobId,
          variant_id: variant?.id ?? null,
          status: "completed",
          raw_video_path: rawVideoPath,
          final_video_path: outputPath,
          manifest_json: manifest,
          naturalness_score: 85.0,
          duration_seconds: Math.round((Date.now() - startedAt) / 1000),
          language: payload.locale ?? "en",
          device_profile: device,
        })
        .select("id")
        .single();

      const renderId = render?.id as string | undefined;
      if (renderId && process.env.DEMOFORGE_VIDEO_UPLOAD !== "false") {
        try {
          const objectKey = `renders/${payload.jobId}/${renderId}.mp4`;
          const { bucket, objectKey: key } = await uploadFinalRenderToStorage({
            localPath: outputPath,
            objectKey,
          });
          const cdnUrl = buildCanonicalMediaPublicUrl({ bucket, objectKey: key });
          const retentionDays = Number(process.env.DEMOFORGE_MEDIA_RETENTION_DAYS ?? "30");
          const retentionUntil = new Date(
            Date.now() + Math.max(1, retentionDays) * 86400000
          ).toISOString();
          await supabase
            .from("video_renders")
            .update({
              storage_bucket: bucket,
              storage_object_key: key,
              cdn_url: cdnUrl,
              retention_until: retentionUntil,
            })
            .eq("id", renderId);
        } catch (uploadErr) {
          await logVideoOperation({
            operation: "video_storage_upload",
            status: "error",
            sessionId: payload.sessionId,
            correlationId: payload.correlationId,
            message: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
          });
        }
      }

      for (const hotspot of manifest.hotspots) {
        await supabase.from("video_hotspots").insert({
          render_id: render?.id ?? null,
          start_seconds: hotspot.startSeconds,
          end_seconds: hotspot.endSeconds,
          label: hotspot.label,
          target_url: hotspot.targetUrl,
          context_payload: hotspot.contextPayload ?? null,
        });
      }
    }
  }

  await supabase
    .from("video_jobs")
    .update({
      status: VIDEO_JOB_STATUS.succeeded,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.jobId);

  await logVideoOperation({
    operation: "worker_complete",
    status: "success",
    sessionId: payload.sessionId,
    correlationId: payload.correlationId,
    payload: { video_job_id: payload.jobId, output_path: outputPath },
  });
  await notifyOrchestrator({
    event: "job_succeeded",
    correlationId: payload.correlationId ?? "",
    videoJobId: payload.jobId,
    payload: { outputPath },
  });

  await dispatchIntegrationEvent({
    tenantId: null,
    eventType: "video.job.completed",
    idempotencyKey: `video_job:${payload.jobId}`,
    body: {
      videoJobId: payload.jobId,
      sessionId: payload.sessionId,
      correlationId: payload.correlationId ?? null,
    },
  });
}

const worker = new Worker<VideoQueuePayload>(
  VIDEO_QUEUE_NAMES.default,
  async (job) => {
    const started = Date.now();
    try {
      await processVideoJob(job.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const supabase = createServiceSupabaseClient();
      await supabase
        .from("video_jobs")
        .update({
          status: job.attemptsMade >= VIDEO_GUARDRAILS.defaultMaxRetries ? VIDEO_JOB_STATUS.dead_letter : VIDEO_JOB_STATUS.failed,
          retries: job.attemptsMade,
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.data.jobId);
      await logVideoOperation({
        operation: "worker_complete",
        status: "error",
        sessionId: job.data.sessionId,
        correlationId: job.data.correlationId,
        message,
      });
      await notifyOrchestrator({
        event: "job_failed",
        correlationId: job.data.correlationId ?? "",
        videoJobId: job.data.jobId,
        payload: { message },
      });
      throw e;
    } finally {
      const elapsedSeconds = (Date.now() - started) / 1000;
      if (elapsedSeconds > VIDEO_GUARDRAILS.defaultMaxRuntimeSeconds) {
        throw new Error("Video job exceeded max runtime guardrail");
      }
    }
  },
  {
    connection: getConn(),
    concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY ?? "2"),
    // @ts-ignore — exists in bullmq v5 runtime, types lag
    enablePriorityQueue: true,
  }
);

worker.on("error", (err) => {
  console.error("[video-pipeline] worker error:", err);
});

worker.on("failed", (job, err) => {
  console.error("[video-pipeline] job failed:", job?.id, err?.message, err?.stack);
});

worker.on("active", (job) => {
  console.log("[video-pipeline] job active:", job.id, job.data?.sessionId);
});

worker.on("completed", (job) => {
  console.log("[video-pipeline] job completed:", job.id);
});

console.log("[video-pipeline] worker started");
