import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { VIDEO_FEATURE_FLAGS } from "./constants";

export type VideoFeatureFlagName =
  (typeof VIDEO_FEATURE_FLAGS)[keyof typeof VIDEO_FEATURE_FLAGS];

function readEnvFlag(flagName: VideoFeatureFlagName): boolean {
  const envName = flagName.toUpperCase();
  const raw = process.env[envName];
  return raw === "1" || raw === "true";
}

/**
 * Tries to resolve flags from demoforge.feature_flags; falls back to env if missing.
 */
export async function isVideoFeatureEnabled(flagName: VideoFeatureFlagName): Promise<boolean> {
  const envEnabled = readEnvFlag(flagName);
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("flag_key", flagName)
      .maybeSingle();

    if (error || !data) {
      return envEnabled;
    }
    return Boolean(data.enabled);
  } catch {
    return envEnabled;
  }
}
