import { createSignedRenderUrl } from "@/lib/video/storage";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export interface BestRenderResult {
  finalVideoPath: string;
  naturalnessScore: number | null;
  renderId: string;
}

export async function getBestCompletedRenderForSession(
  sessionId: string
): Promise<BestRenderResult | null> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from("video_renders")
    .select(
      "id, final_video_path, naturalness_score, storage_bucket, storage_object_key, cdn_url, video_jobs!inner(parent_session_id, status)"
    )
    .eq("video_jobs.parent_session_id", sessionId)
    .eq("status", "completed")
    .order("naturalness_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const hasPath =
    Boolean(data.final_video_path) ||
    Boolean(data.cdn_url) ||
    Boolean(data.storage_bucket && data.storage_object_key);
  if (!hasPath) {
    return null;
  }

  const bucket = data.storage_bucket as string | null;
  const objectKey = data.storage_object_key as string | null;
  const cdnUrl = data.cdn_url as string | null;
  let path =
    (cdnUrl as string | null) ??
    (data.final_video_path as string | null) ??
    null;
  if (!path && bucket && objectKey) {
    path = await createSignedRenderUrl({ bucket, objectKey });
  }
  if (!path) {
    return null;
  }

  return {
    renderId: data.id as string,
    finalVideoPath: path,
    naturalnessScore: (data.naturalness_score as number | null) ?? null,
  };
}

export async function waitForBestCompletedRenderForSession(
  sessionId: string,
  waitMs: number
): Promise<BestRenderResult | null> {
  const deadline = Date.now() + Math.max(0, waitMs);
  let result = await getBestCompletedRenderForSession(sessionId);
  while (!result && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    result = await getBestCompletedRenderForSession(sessionId);
  }
  return result;
}
