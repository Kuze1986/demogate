import { readFile } from "node:fs/promises";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { logSystemEvent } from "@/lib/logging";

const DEFAULT_BUCKET = "demoforge-video";

export function getVideoStorageBucket(): string {
  return process.env.DEMOFORGE_VIDEO_BUCKET ?? DEFAULT_BUCKET;
}

export async function uploadFinalRenderToStorage(input: {
  localPath: string;
  objectKey: string;
  contentType?: string;
}): Promise<{ bucket: string; objectKey: string }> {
  const supabase = createServiceSupabaseClient();
  const bucket = getVideoStorageBucket();
  const file = await readFile(input.localPath);
  const { error } = await supabase.storage.from(bucket).upload(input.objectKey, file, {
    contentType: input.contentType ?? "video/mp4",
    upsert: true,
  });
  if (error) {
    await logSystemEvent({
      function_name: "video.storage.upload",
      status: "error",
      message: error.message,
      payload: { bucket, objectKey: input.objectKey },
    });
    throw new Error(error.message);
  }
  await logSystemEvent({
    function_name: "video.storage.upload",
    status: "success",
    message: "Uploaded render object",
    payload: { bucket, objectKey: input.objectKey },
  });
  return { bucket, objectKey: input.objectKey };
}

export async function createSignedRenderUrl(input: {
  bucket: string;
  objectKey: string;
  expiresSeconds?: number;
}): Promise<string | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .createSignedUrl(input.objectKey, input.expiresSeconds ?? 60 * 30);
  if (error || !data?.signedUrl) {
    await logSystemEvent({
      function_name: "video.storage.signed_url",
      status: "error",
      message: error?.message ?? "missing signed url",
      payload: { bucket: input.bucket, objectKey: input.objectKey },
    });
    return null;
  }
  return data.signedUrl;
}
