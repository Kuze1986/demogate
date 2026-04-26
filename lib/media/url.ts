/**
 * Canonical viewer URL for rendered media. Prefer CDN host when configured.
 */
export function buildCanonicalMediaPublicUrl(input: {
  bucket: string;
  objectKey: string;
}): string {
  const cdn = process.env.DEMOFORGE_MEDIA_CDN_BASE_URL?.replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (cdn) {
    return `${cdn}/${input.bucket}/${input.objectKey}`;
  }
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${input.bucket}/${input.objectKey}`;
  }
  return `${input.bucket}/${input.objectKey}`;
}
