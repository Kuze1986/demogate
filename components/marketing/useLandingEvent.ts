"use client";

export type LandingEventType =
  | "landing_view"
  | "landing_cta_demo"
  | "landing_cta_admin"
  | "landing_cta_billing"
  | "landing_faq_expand"
  | "landing_pricing_toggle";

export async function emitLandingEvent(
  eventType: LandingEventType,
  metadata?: Record<string, unknown> | null
) {
  try {
    await fetch("/api/landing-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, metadata: metadata ?? null }),
    });
  } catch {
    /* non-blocking analytics */
  }
}
