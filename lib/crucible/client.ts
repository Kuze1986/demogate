import type { ProductKey, ProspectPersona } from "@/types/demo";

export interface CrucibleBehaviorProfile {
  delayMultiplier: number;
  thinkingPauseMultiplier: number;
  mousePathJitterPx: number;
  hoverWobblePx: number;
  mouseCurveSteps: number;
}

export interface CrucibleProfileResult {
  profile: CrucibleBehaviorProfile;
  source: "default" | "crucible";
}

const DEFAULT_PROFILE: CrucibleBehaviorProfile = {
  delayMultiplier: 1,
  thinkingPauseMultiplier: 1,
  mousePathJitterPx: 30,
  hoverWobblePx: 2,
  mouseCurveSteps: 28,
};

interface CrucibleProfileRequest {
  sessionId?: string;
  correlationId: string;
  product: ProductKey;
  persona: ProspectPersona;
}

function normalizeProfile(raw: unknown): CrucibleBehaviorProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const delayMultiplier = Number(p.delayMultiplier ?? p.delay_multiplier);
  const thinkingPauseMultiplier = Number(
    p.thinkingPauseMultiplier ?? p.thinking_pause_multiplier
  );
  const mousePathJitterPx = Number(p.mousePathJitterPx ?? p.mouse_path_jitter_px);
  const hoverWobblePx = Number(p.hoverWobblePx ?? p.hover_wobble_px);
  const mouseCurveSteps = Number(p.mouseCurveSteps ?? p.mouse_curve_steps);

  if (
    !Number.isFinite(delayMultiplier) ||
    !Number.isFinite(thinkingPauseMultiplier) ||
    !Number.isFinite(mousePathJitterPx) ||
    !Number.isFinite(hoverWobblePx) ||
    !Number.isFinite(mouseCurveSteps)
  ) {
    return null;
  }

  return {
    delayMultiplier: Math.max(0.5, Math.min(delayMultiplier, 2.5)),
    thinkingPauseMultiplier: Math.max(0.5, Math.min(thinkingPauseMultiplier, 2.5)),
    mousePathJitterPx: Math.max(5, Math.min(mousePathJitterPx, 120)),
    hoverWobblePx: Math.max(0, Math.min(hoverWobblePx, 12)),
    mouseCurveSteps: Math.max(10, Math.min(Math.round(mouseCurveSteps), 80)),
  };
}

export async function fetchCrucibleBehaviorProfile(
  input: CrucibleProfileRequest
): Promise<CrucibleProfileResult> {
  const baseUrl = process.env.CRUCIBLE_SIM_BASE_URL;
  if (!baseUrl) {
    return { profile: DEFAULT_PROFILE, source: "default" };
  }

  const profilePath =
    process.env.CRUCIBLE_SIM_PROFILE_PATH ?? "/api/behavior/profile";
  const apiKey = process.env.CRUCIBLE_SIM_API_KEY;

  try {
    const response = await fetch(new URL(profilePath, baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(2_500),
    });

    if (!response.ok) {
      return { profile: DEFAULT_PROFILE, source: "default" };
    }

    const payload = (await response.json()) as {
      profile?: unknown;
    };
    const profile = normalizeProfile(payload.profile);
    if (!profile) {
      return { profile: DEFAULT_PROFILE, source: "default" };
    }

    return { profile, source: "crucible" };
  } catch {
    return { profile: DEFAULT_PROFILE, source: "default" };
  }
}
