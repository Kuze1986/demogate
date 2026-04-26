import { NextResponse } from "next/server";
import { enqueueVideoJob } from "@/lib/video/queue";
import { logVideoOperation } from "@/lib/video/logging";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { ProductKey, ProspectPersona } from "@/types/demo";
import type { VideoDeviceProfile, VideoVariantType } from "@/lib/video/types";

export const runtime = "nodejs";

interface ManualTriggerBody {
  sessionId?: string;
  variants?: VideoVariantType[];
  deviceProfiles?: VideoDeviceProfile[];
  locale?: string;
  priority?: number;
}

const VALID_DEVICE_PROFILES: VideoDeviceProfile[] = ["desktop", "mobile"];
const VALID_VARIANTS: VideoVariantType[] = [
  "default",
  "hook_a",
  "hook_b",
  "cta_a",
  "cta_b",
  "localized_es",
  "mobile",
];

function sanitizeVariants(variants: unknown): VideoVariantType[] {
  if (!Array.isArray(variants)) return ["default"];
  const filtered = variants.filter((v): v is VideoVariantType =>
    VALID_VARIANTS.includes(v as VideoVariantType)
  );
  return filtered.length ? filtered : ["default"];
}

function sanitizeDeviceProfiles(deviceProfiles: unknown): VideoDeviceProfile[] {
  if (!Array.isArray(deviceProfiles)) return ["desktop"];
  const filtered = deviceProfiles.filter((v): v is VideoDeviceProfile =>
    VALID_DEVICE_PROFILES.includes(v as VideoDeviceProfile)
  );
  return filtered.length ? filtered : ["desktop"];
}

export async function POST(request: Request) {
  const serverSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || (adminEmail && user.email !== adminEmail)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ManualTriggerBody;
  try {
    payload = (await request.json()) as ManualTriggerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = payload.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data: session, error: sessionErr } = await supabase
      .from("demo_sessions")
      .select(
        "id, prospect_id, track_id, prospects(persona), demo_tracks(product, persona)"
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionErr) throw new Error(sessionErr.message);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    type ProspectEmbed = { persona: ProspectPersona | null };
    type TrackEmbed = { product: ProductKey; persona: ProspectPersona | null };
    const prospect = Array.isArray(session.prospects)
      ? (session.prospects[0] as ProspectEmbed | undefined)
      : (session.prospects as ProspectEmbed | null);
    const track = Array.isArray(session.demo_tracks)
      ? (session.demo_tracks[0] as TrackEmbed | undefined)
      : (session.demo_tracks as TrackEmbed | null);

    if (!track?.product) {
      return NextResponse.json(
        { error: "Unable to resolve track product for session" },
        { status: 422 }
      );
    }

    const persona = (prospect?.persona ?? track.persona ?? "unknown") as ProspectPersona;
    const variants = sanitizeVariants(payload.variants);
    const deviceProfiles = sanitizeDeviceProfiles(payload.deviceProfiles);
    const priority =
      typeof payload.priority === "number" && Number.isFinite(payload.priority)
        ? Math.max(1, Math.min(Math.round(payload.priority), 999))
        : 80;

    const enqueued = await enqueueVideoJob({
      sessionId,
      prospectId: session.prospect_id as string | null,
      product: track.product,
      persona,
      triggeredBy: "manual",
      variants,
      deviceProfiles,
      locale: payload.locale?.trim() || "en",
      priority,
    });

    await logVideoOperation({
      operation: "manual_trigger",
      status: "success",
      sessionId,
      correlationId: enqueued.correlationId,
      payload: {
        triggered_by_user: user.email ?? null,
        video_job_id: enqueued.videoJobId,
        queue_job_id: enqueued.queueJobId,
      },
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      videoJobId: enqueued.videoJobId,
      queueJobId: enqueued.queueJobId,
      correlationId: enqueued.correlationId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logVideoOperation({
      operation: "manual_trigger",
      status: "error",
      sessionId,
      message,
      payload: { triggered_by_user: user.email ?? null },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
