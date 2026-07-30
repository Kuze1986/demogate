import { DEMO_PRODUCT_CARDS } from "@/lib/constants";
import { listMarketingProducts, type VantageProductSlug } from "@/lib/vantage/client";

/** Map DemoForge intake product ids → Social Kit / Vantage product slugs when they overlap. */
const VANTAGE_SLUG_BY_CARD: Partial<Record<string, VantageProductSlug>> = {
  keystone: "keystone",
  scripta: "scripta",
};

/**
 * Enrich intake product cards with Vantage brand essence when available.
 * Falls back to static DEMO_PRODUCT_CARDS on any failure.
 */
export async function getEnrichedDemoProductCards() {
  const products = await listMarketingProducts();
  if (!products?.length) return DEMO_PRODUCT_CARDS;

  const bySlug = new Map(products.map((p) => [p.product, p]));
  return DEMO_PRODUCT_CARDS.map((card) => {
    const slug = VANTAGE_SLUG_BY_CARD[card.id];
    if (!slug) return card;
    const pack = bySlug.get(slug);
    if (!pack?.essence) return card;
    return { ...card, title: pack.name || card.title, blurb: pack.essence };
  });
}
