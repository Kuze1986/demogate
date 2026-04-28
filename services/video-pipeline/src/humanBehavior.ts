import type { Page } from "@playwright/test";

export interface BehaviorTuning {
  delayMultiplier: number;
  thinkingPauseMultiplier: number;
  mousePathJitterPx: number;
  hoverWobblePx: number;
  mouseCurveSteps: number;
}

function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export async function humanDelay(baseMs: number, tuning?: BehaviorTuning) {
  const multiplier = tuning?.delayMultiplier ?? 1;
  const ms = Math.round(baseMs * multiplier * (0.7 + Math.random() * 0.6));
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function thinkingPause(tuning?: BehaviorTuning) {
  const multiplier = tuning?.thinkingPauseMultiplier ?? 1;
  await new Promise((resolve) =>
    setTimeout(resolve, Math.round(jitter(350, 1200) * multiplier))
  );
}

export async function moveMouseBezier(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  tuning?: BehaviorTuning
) {
  const curveJitter = tuning?.mousePathJitterPx ?? 30;
  const cp1 = {
    x: from.x + (to.x - from.x) * 0.3 + jitter(-curveJitter, curveJitter),
    y: from.y + (to.y - from.y) * 0.2 + jitter(-curveJitter, curveJitter),
  };
  const cp2 = {
    x: from.x + (to.x - from.x) * 0.75 + jitter(-curveJitter, curveJitter),
    y: from.y + (to.y - from.y) * 0.8 + jitter(-curveJitter, curveJitter),
  };
  const steps = tuning?.mouseCurveSteps ?? 28;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 3) * from.x +
      3 * Math.pow(1 - t, 2) * t * cp1.x +
      3 * (1 - t) * Math.pow(t, 2) * cp2.x +
      Math.pow(t, 3) * to.x;
    const y =
      Math.pow(1 - t, 3) * from.y +
      3 * Math.pow(1 - t, 2) * t * cp1.y +
      3 * (1 - t) * Math.pow(t, 2) * cp2.y +
      Math.pow(t, 3) * to.y;
    await page.mouse.move(x, y);
  }
}

export async function hoverWobble(
  page: Page,
  at: { x: number; y: number },
  tuning?: BehaviorTuning
) {
  const wobble = tuning?.hoverWobblePx ?? 2;
  await page.mouse.move(at.x + jitter(-wobble, wobble), at.y + jitter(-wobble, wobble));
  await page.mouse.move(
    at.x + jitter(-wobble / 2, wobble / 2),
    at.y + jitter(-wobble / 2, wobble / 2)
  );
}
