import { NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/logging";

export const runtime = "nodejs";

const LANDING_EVENT_TYPES = [
  "landing_view",
  "landing_cta_demo",
  "landing_cta_admin",
  "landing_cta_billing",
  "landing_faq_expand",
  "landing_pricing_toggle",
] as const;

type LandingEventType = (typeof LANDING_EVENT_TYPES)[number];

function isLandingEventType(s: string): s is LandingEventType {
  return (LANDING_EVENT_TYPES as readonly string[]).includes(s);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventType?: string;
      metadata?: Record<string, unknown> | null;
    };
    const { eventType, metadata } = body;
    if (!eventType || !isLandingEventType(eventType)) {
      await logSystemEvent({
        function_name: "landing_event",
        status: "error",
        message: "Invalid landing eventType",
        payload: { eventType: eventType ?? null },
      });
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    await logSystemEvent({
      function_name: "landing_event",
      status: "success",
      message: eventType,
      payload: metadata ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await logSystemEvent({
      function_name: "landing_event",
      status: "error",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
