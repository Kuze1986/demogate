export interface NaturalnessSignalInput {
  meanDelayMs: number;
  delayVarianceMs: number;
  cursorPathJitter: number;
  hesitationCount: number;
}

export interface EngagementSignalInput {
  watchPercent: number;
  ctaClicks: number;
  replayCount: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function scoreNaturalness(input: NaturalnessSignalInput): number {
  const delayScore = clamp(100 - Math.abs(input.meanDelayMs - 550) / 8, 0, 100);
  const varianceScore = clamp(100 - Math.abs(input.delayVarianceMs - 180) / 4, 0, 100);
  const cursorScore = clamp(100 - input.cursorPathJitter * 8, 0, 100);
  const hesitationScore = clamp(100 - Math.abs(input.hesitationCount - 3) * 14, 0, 100);
  return Math.round((delayScore * 0.3 + varianceScore * 0.25 + cursorScore * 0.25 + hesitationScore * 0.2) * 100) / 100;
}

export function scoreEngagement(input: EngagementSignalInput): number {
  const watchScore = clamp(input.watchPercent, 0, 100);
  const clickScore = clamp(input.ctaClicks * 18, 0, 100);
  const replayScore = clamp(input.replayCount * 12, 0, 100);
  return Math.round((watchScore * 0.6 + clickScore * 0.3 + replayScore * 0.1) * 100) / 100;
}
