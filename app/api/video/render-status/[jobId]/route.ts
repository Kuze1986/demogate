import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getCurrentTenant } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getCurrentTenant(user.id);
  if (!ctx) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const { jobId } = await params;
  const svc = createServiceSupabaseClient();

  const { data: job, error } = await svc
    .from("video_jobs")
    .select("id,status,error_message,created_at,updated_at,correlation_id")
    .eq("id", jobId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (error || !job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If succeeded, include the best render's CDN URL
  let cdnUrl: string | null = null;
  let renderId: string | null = null;
  let accessToken: string | null = null;
  if (job.status === "succeeded") {
    const { data: render } = await svc
      .from("video_renders")
      .select("id,cdn_url,access_token,naturalness_score")
      .eq("video_job_id", jobId)
      .eq("status", "completed")
      .order("naturalness_score", { ascending: false })
      .limit(1)
      .single();
    if (render) {
      cdnUrl       = render.cdn_url as string | null;
      renderId     = render.id as string;
      accessToken  = render.access_token as string | null;
    }
  }

  return NextResponse.json({
    status:       job.status,
    cdnUrl,
    renderId,
    accessToken,
    errorMessage: job.error_message ?? null,
    updatedAt:    job.updated_at,
  });
}
