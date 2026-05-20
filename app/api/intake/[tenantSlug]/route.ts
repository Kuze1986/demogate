import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { enqueueVideoJob } from "@/lib/video/queue";
import { logSystemEvent } from "@/lib/logging";

export const runtime = "nodejs";

interface IntakeBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  organization?: string;
  role?: string;
  painPoints?: string[];
  tenantSlug?: string;
}

function validate(b: unknown): IntakeBody | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  for (const k of ["firstName", "lastName", "email", "organization", "role"]) {
    if (typeof o[k] !== "string" || !(o[k] as string).trim()) return null;
  }
  return o as IntakeBody;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const svc = createServiceSupabaseClient();

  let body: IntakeBody | null = null;
  try {
    body = validate(await request.json());
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    // Resolve tenant
    const { data: tenant } = await svc
      .from("tenants")
      .select("id,plan,videos_used,videos_limit,elevenlabs_voice_id")
      .eq("slug", tenantSlug)
      .single();

    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Quota check
    if (tenant.videos_limit !== -1 && (tenant.videos_used ?? 0) >= (tenant.videos_limit ?? 0)) {
      return NextResponse.json({ error: "Demo capacity reached. Please try again later." }, { status: 429 });
    }

    // Upsert prospect (deduplicate by email + tenant)
    const email = (body.email as string).toLowerCase().trim();
    const { data: existing } = await svc
      .from("prospects")
      .select("id")
      .eq("email", email)
      .eq("tenant_id", tenant.id as string)
      .single();

    let prospectId: string;
    if (existing) {
      prospectId = existing.id as string;
    } else {
      const { data: prospect, error: pErr } = await svc
        .from("prospects")
        .insert({
          tenant_id: tenant.id,
          first_name: body.firstName,
          last_name: body.lastName,
          email,
          organization: body.organization,
          role: body.role,
          pain_points: body.painPoints ?? [],
          is_qualified: true,
        })
        .select("id")
        .single();
      if (pErr || !prospect) throw new Error(pErr?.message ?? "Failed to create prospect");
      prospectId = prospect.id as string;
    }

    // Find default script template
    const { data: template } = await svc
      .from("demo_script_templates")
      .select("id,voice_id")
      .eq("tenant_id", tenant.id as string)
      .eq("is_default", true)
      .single();

    // Create placeholder session
    const { data: session, error: sErr } = await svc
      .from("demo_sessions")
      .insert({
        tenant_id: tenant.id,
        prospect_id: prospectId,
        status: "started",
        modules_completed: 0,
        modules_total: 0,
      })
      .select("id")
      .single();

    if (sErr || !session) throw new Error(sErr?.message ?? "Failed to create session");

    // Enqueue video job
    await enqueueVideoJob({
      sessionId: session.id as string,
      prospectId,
      triggeredBy: "intake",
      variants: ["default"],
      tenantId: tenant.id as string,
      scriptTemplateId: template?.id ?? null,
      voiceId: (template as { voice_id?: string } | null)?.voice_id ?? (tenant.elevenlabs_voice_id as string | null) ?? null,
    });

    await logSystemEvent({
      function_name: "intake_submit",
      session_id: session.id as string,
      status: "success",
      message: "Intake submitted, video job enqueued",
      payload: { tenantSlug, prospectId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "intake_submit",
      status: "error",
      message,
      payload: body ? { email: body.email } : null,
    });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
