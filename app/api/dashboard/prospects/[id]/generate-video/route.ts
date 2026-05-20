import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getCurrentTenant, getTenantQuota } from "@/lib/tenant";
import { enqueueVideoJob } from "@/lib/video/queue";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getCurrentTenant(user.id);
  if (!ctx) return NextResponse.json({ error: "No workspace found" }, { status: 403 });
  const { tenant } = ctx;

  // Quota check
  const quota = await getTenantQuota(tenant.id);
  if (!quota.is_unlimited && quota.remaining <= 0) {
    return NextResponse.json(
      { error: `Video quota exceeded (${quota.videos_used}/${quota.videos_limit}). Upgrade your plan to generate more videos.` },
      { status: 402 }
    );
  }

  const { id: prospectId } = await params;

  // Verify prospect belongs to this tenant
  const svc = createServiceSupabaseClient();
  const { data: prospect, error: prospectErr } = await svc
    .from("prospects")
    .select("id,email,first_name,last_name,persona")
    .eq("id", prospectId)
    .eq("tenant_id", tenant.id)
    .single();

  if (prospectErr || !prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* optional body */ }

  // Find default script template for this tenant
  const { data: template } = await svc
    .from("demo_script_templates")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("is_default", true)
    .single();

  // Create a placeholder session for the video job
  const { data: session, error: sessionErr } = await svc
    .from("demo_sessions")
    .insert({
      prospect_id:       prospectId,
      tenant_id:         tenant.id,
      status:            "started",
      modules_completed: 0,
      modules_total:     0,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  try {
    const result = await enqueueVideoJob({
      sessionId:        session.id,
      prospectId,
      product:          "keystone" as const,
      persona:          (prospect.persona ?? "unknown") as "unknown",
      triggeredBy:      "manual",
      variants:         ["default"],
      locale:           String(body.locale ?? "en"),
      deviceProfiles:   ["desktop"],
      tenantId:         tenant.id,
      scriptTemplateId: template?.id ?? null,
      voiceId:          String(body.voiceId ?? tenant.elevenlabs_voice_id ?? ""),
    });

    return NextResponse.json({
      videoJobId:    result.videoJobId,
      queueJobId:    result.queueJobId,
      correlationId: result.correlationId,
      sessionId:     session.id,
    }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("QUOTA_EXCEEDED")) {
      return NextResponse.json({ error: msg }, { status: 402 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
