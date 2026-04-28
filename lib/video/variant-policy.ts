import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { VIDEO_VARIANT_TYPES } from "@/lib/video/constants";
import type { VideoVariantType } from "@/lib/video/types";

const DEFAULT_ORDER: VideoVariantType[] = ["default", "hook_b", "mobile"];

function isVariantType(value: string): value is VideoVariantType {
  return (VIDEO_VARIANT_TYPES as readonly string[]).includes(value);
}

/**
 * Orders variant labels using recent `performance_score` telemetry when present.
 */
export async function pickVideoVariantOrder(): Promise<VideoVariantType[]> {
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("video_variants")
      .select("variant_type, performance_score, created_at")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error || !data?.length) {
      return [...DEFAULT_ORDER];
    }
    const best = new Map<string, number>();
    for (const row of data) {
      const key = row.variant_type as string;
      if (!isVariantType(key)) continue;
      const score = Number(row.performance_score ?? 0);
      const prev = best.get(key) ?? -Infinity;
      if (score >= prev) {
        best.set(key, score);
      }
    }
    const known = new Set<string>(DEFAULT_ORDER);
    for (const row of data) {
      const key = row.variant_type as string;
      if (isVariantType(key)) {
        known.add(key);
      }
    }
    return [...known]
      .filter(isVariantType)
      .sort((a, b) => (best.get(b) ?? 0) - (best.get(a) ?? 0));
  } catch {
    return [...DEFAULT_ORDER];
  }
}
