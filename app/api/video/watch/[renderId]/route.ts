import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ renderId: string }> }
) {
  const { renderId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const svc = createServiceSupabaseClient();

  const { data: render } = await svc
    .from("video_renders")
    .select("id,final_video_path,access_token,video_job_id,tenant_id")
    .eq("id", renderId)
    .eq("access_token", token)
    .single();

  if (!render) {
    return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  }

  // Load hotspots
  const { data: hotspots } = await svc
    .from("video_hotspots")
    .select("id,start_seconds,end_seconds,label,target_url")
    .eq("render_id", renderId)
    .order("start_seconds", { ascending: true });

  // Load tenant branding
  let tenantName = "DemoForge";
  let tenantLogoUrl: string | null = null;
  let brandColor = "#6366f1";
  if (render.tenant_id) {
    const { data: tenant } = await svc
      .from("tenants")
      .select("name,logo_url,brand_color")
      .eq("id", render.tenant_id as string)
      .single();
    if (tenant) {
      tenantName = (tenant.name as string) || tenantName;
      tenantLogoUrl = (tenant.logo_url as string | null) ?? null;
      brandColor = (tenant.brand_color as string) || brandColor;
    }
  }

  // Load prospect name via job → session
  let prospectName: string | null = null;
  const { data: job } = await svc
    .from("video_jobs")
    .select("prospect_id,parent_session_id")
    .eq("id", render.video_job_id as string)
    .single();
  if (job?.prospect_id) {
    const { data: prospect } = await svc
      .from("prospects")
      .select("first_name,last_name")
      .eq("id", job.prospect_id as string)
      .single();
    if (prospect) {
      const name = `${prospect.first_name ?? ""} ${prospect.last_name ?? ""}`.trim();
      if (name) prospectName = name;
    }
  }

  return NextResponse.json({
    cdnUrl: render.final_video_path,
    tenantName,
    tenantLogoUrl,
    brandColor,
    prospectName,
    hotspots: (hotspots ?? []).map(h => ({
      id: h.id,
      startSeconds: h.start_seconds,
      endSeconds: h.end_seconds,
      label: h.label,
      targetUrl: h.target_url,
    })),
  });
}
