import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  stripeSingleton = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return stripeSingleton;
}

export const STRIPE_PRICE_KEYS = {
  subscription_pro: "STRIPE_PRICE_SUBSCRIPTION_PRO",
  one_time_credits: "STRIPE_PRICE_ONE_TIME_CREDITS",
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICE_KEYS;

export function resolveStripePriceId(priceKey: StripePriceKey): string {
  const envName = STRIPE_PRICE_KEYS[priceKey];
  const id = process.env[envName];
  if (!id) {
    throw new Error(`Missing environment variable ${envName}`);
  }
  return id;
}
