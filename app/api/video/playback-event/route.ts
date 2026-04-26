import { NextResponse } from "next/server";
import { recordBehaviorSignal } from "@/lib/behavior/signals";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { logVideoOperation } from "@/lib/video/logging";
import { scoreEngagement, scoreNaturalness } from "@/lib/video/analytics";

export const runtime = "nodejs";

interface PlaybackEventBody {
  renderId?: string;
  sessionId?: string;
  eventType?: string;
  playbackSeconds?: number;
  metadata?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlaybackEventBody;
    if (!body.renderId || !body.eventType) {
      return NextResponse.json({ error: "renderId and eventType required" }, { status: 400 });
    }
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.from("video_events").insert({
      render_id: body.renderId,
      session_id: body.sessionId ?? null,
      event_type: body.eventType,
      playback_seconds:
        typeof body.playbackSeconds === "number" ? body.playbackSeconds : null,
      metadata: body.metadata ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }

    const md = body.metadata ?? {};
    if (body.eventType === "video_completed") {
      const naturalness = scoreNaturalness({
        meanDelayMs: Number(md.meanDelayMs ?? 550),
        delayVarianceMs: Number(md.delayVarianceMs ?? 180),
        cursorPathJitter: Number(md.cursorPathJitter ?? 2.2),
        hesitationCount: Number(md.hesitationCount ?? 3),
      });
      const engagement = scoreEngagement({
        watchPercent: Number(md.watchPercent ?? 0),
        ctaClicks: Number(md.ctaClicks ?? 0),
        replayCount: Number(md.replayCount ?? 0),
      });
      await supabase.from("behavior_scores").insert({
        render_id: body.renderId,
        naturalness_score: naturalness,
        engagement_score: engagement,
        scoring_breakdown: {
          naturalness,
          engagement,
          source: "playback_event",
        },
      });
      const variantId =
        typeof md.variantId === "string" && md.variantId.length > 0 ? md.variantId : null;
      if (variantId) {
        await supabase
          .from("video_variants")
          .update({ performance_score: engagement })
          .eq("id", variantId);
      }
      await recordBehaviorSignal({
        sessionId: body.sessionId ?? null,
        renderId: body.renderId,
        signalKind: "playback.completed",
        payload: {
          engagement,
          naturalness,
          variantId,
        },
      });
      await supabase.from("variant_optimization_runs").insert({
        product: String(md.product ?? "unknown"),
        persona: md.persona != null ? String(md.persona) : null,
        segment: md.segment != null ? String(md.segment) : null,
        chosen_variants: [{ variantId, engagement }],
        rationale: {
          source: "playback_event",
          naturalness,
          engagement,
        },
      });
    }

    await logVideoOperation({
      operation: "playback_event",
      status: "success",
      sessionId: body.sessionId ?? null,
      correlationId: String(body.metadata?.correlationId ?? ""),
      payload: {
        render_id: body.renderId,
        event_type: body.eventType,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logVideoOperation({
      operation: "playback_event",
      status: "error",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
