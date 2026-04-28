import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { VIDEO_GUARDRAILS, VIDEO_JOB_STATUS, VIDEO_QUEUE_NAMES } from "./constants";
import type { EnqueueVideoJobInput, VideoQueuePayload } from "./contracts";
import { logVideoOperation } from "./logging";

let sharedConn: IORedis | null = null;
let sharedQueue: Queue<VideoQueuePayload> | null = null;

function getRedisConnection() {
  if (sharedConn) return sharedConn;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing REDIS_URL");
  }
  sharedConn = new IORedis(url, { maxRetriesPerRequest: null });
  return sharedConn;
}

export function getVideoQueue() {
  if (sharedQueue) return sharedQueue;
  sharedQueue = new Queue<VideoQueuePayload>(VIDEO_QUEUE_NAMES.default, {
    connection: getRedisConnection(),
  });
  return sharedQueue;
}

export async function enqueueVideoJob(input: EnqueueVideoJobInput): Promise<{
  videoJobId: string;
  queueJobId: string;
  correlationId: string;
}> {
  const supabase = createServiceSupabaseClient();
  const correlationId = input.correlationId ?? randomUUID();
  const nowIso = new Date().toISOString();
  const skipExpensive = process.env.VIDEO_SKIP_EXPENSIVE_VARIANTS === "true";
  const targetVariants = skipExpensive
    ? input.variants.filter(
        (variant) =>
          !VIDEO_GUARDRAILS.expensiveVariantTypes.includes(
            variant as (typeof VIDEO_GUARDRAILS.expensiveVariantTypes)[number]
          )
      )
    : input.variants;

  const { data: inserted, error: insErr } = await supabase
    .from("video_jobs")
    .insert({
      parent_session_id: input.sessionId,
      prospect_id: input.prospectId ?? null,
      triggered_by: input.triggeredBy,
      status: VIDEO_JOB_STATUS.queued,
      priority: input.priority ?? 100,
      target_variants: targetVariants,
      retries: 0,
      max_retries: VIDEO_GUARDRAILS.defaultMaxRetries,
      max_runtime_seconds: VIDEO_GUARDRAILS.defaultMaxRuntimeSeconds,
      correlation_id: correlationId,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    throw new Error(insErr?.message ?? "Failed to create video_jobs row");
  }

  const payload: VideoQueuePayload = {
    ...input,
    variants: targetVariants.length ? targetVariants : ["default"],
    correlationId,
    createdAtIso: nowIso,
    jobId: inserted.id as string,
  };

  const queue = getVideoQueue();
  const job = await queue.add("render-video", payload, {
    attempts: VIDEO_GUARDRAILS.defaultMaxRetries + 1,
    removeOnComplete: 500,
    removeOnFail: 500,
    priority: input.priority ?? 100,
  });

  await logVideoOperation({
    operation: "job_enqueue",
    status: "success",
    sessionId: input.sessionId,
    correlationId,
    payload: {
      video_job_id: inserted.id,
      queue_job_id: job.id,
      variants: payload.variants,
    },
  });

  return {
    videoJobId: inserted.id as string,
    queueJobId: String(job.id),
    correlationId,
  };
}
