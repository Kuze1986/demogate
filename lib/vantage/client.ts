/**
 * Vantage portfolio marketing consumer.
 * Pulls approved brand packs / pieces for landing + intake hydration.
 */

export type VantageProductSlug =
  | "shift"
  | "keystone"
  | "scripta"
  | "demoforge"
  | "crucible"
  | "vantage";

export interface VantageMarketingBrand {
  name: string;
  essence: string;
  handle?: string;
  domain?: string;
  accent?: string;
  voice?: { register?: string; do?: string[]; dont?: string[] };
  captions?: Array<{ tag: string; title: string; body: string }>;
  launch?: {
    eyebrow?: string;
    sqHeadline?: string;
    sqSub?: string;
    cta?: string;
    metrics?: Array<{ label: string; value: string; unit?: string }>;
  };
  insight?: {
    sqHeadline?: string;
    sqBody?: string;
  };
}

export interface VantageMarketingPack {
  product: VantageProductSlug;
  brand: VantageMarketingBrand;
  pieces: Array<Record<string, unknown>>;
  assets: Array<{ id: string; kind: string; public_url: string }>;
}

export interface VantageProductSummary {
  product: VantageProductSlug;
  name: string;
  essence: string;
  piece_count: number;
  launch?: { headline?: string; sub?: string; cta?: string };
}

function config() {
  const base = (process.env.VANTAGE_API_URL ?? "").replace(/\/$/, "");
  const key = process.env.VANTAGE_SERVICE_KEY?.trim() ?? "";
  return { base, key };
}

async function vantageFetch<T>(path: string): Promise<T | null> {
  const { base, key } = config();
  if (!base || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${base}${path}`, {
      headers: {
        Accept: "application/json",
        "x-vantage-key": key,
        ...(process.env.VANTAGE_WORKSPACE_ID
          ? { "x-workspace-id": process.env.VANTAGE_WORKSPACE_ID }
          : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[vantage] ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn("[vantage] fetch failed", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMarketingPack(
  product: VantageProductSlug,
): Promise<VantageMarketingPack | null> {
  return vantageFetch<VantageMarketingPack>(`/v1/marketing/${product}`);
}

export async function listMarketingProducts(): Promise<VantageProductSummary[] | null> {
  const data = await vantageFetch<{ products: VantageProductSummary[] }>("/v1/marketing");
  return data?.products ?? null;
}
