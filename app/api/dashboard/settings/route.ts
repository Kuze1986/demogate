import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getCurrentTenant } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getCurrentTenant(user.id);
  if (!ctx) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  return NextResponse.json({ tenant: ctx.tenant });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getCurrentTenant(user.id);
  if (!ctx) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.brand_color !== undefined) updates.brand_color = String(body.brand_color);
  if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
  if (body.elevenlabs_voice_id !== undefined) updates.elevenlabs_voice_id = body.elevenlabs_voice_id;

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("tenants")
    .update(updates)
    .eq("id", ctx.tenant.id)
    .select("id,name,slug,logo_url,brand_color,elevenlabs_voice_id,plan,videos_limit,videos_used")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tenant: data });
}
