"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function BillingActions({
  stripeConfigured,
  isAuthenticated,
}: {
  stripeConfigured: boolean;
  isAuthenticated: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function startCheckout(mode: "subscription" | "payment", priceKey: string) {
    setError(null);
    setLoading(`${mode}:${priceKey}`);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, priceKey }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Checkout failed");
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setError(null);
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Portal failed");
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No portal URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  if (!stripeConfigured) {
    return (
      <p className="text-sm text-amber-800 dark:text-amber-200">
        Billing is not configured on this deployment (missing Stripe environment variables).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={Boolean(loading)}
          onClick={() => void startCheckout("subscription", "subscription_pro")}
        >
          {loading === "subscription:subscription_pro"
            ? "Redirecting…"
            : "Subscribe — Pro"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={Boolean(loading)}
          onClick={() => void startCheckout("payment", "one_time_credits")}
        >
          {loading === "payment:one_time_credits"
            ? "Redirecting…"
            : "One-time credits"}
        </Button>
        {isAuthenticated && (
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(loading)}
            onClick={() => void openPortal()}
          >
            {loading === "portal" ? "Opening…" : "Manage billing"}
          </Button>
        )}
      </div>
      {!isAuthenticated && (
        <p className="text-xs text-zinc-500">
          Sign in with the same email you used at checkout to open the billing portal.
        </p>
      )}
    </div>
  );
}
