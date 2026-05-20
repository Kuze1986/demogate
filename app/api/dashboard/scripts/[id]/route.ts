import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getCurrentTenant } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function getAuthContext() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ctx = await getCurrentTenant(user.id);
  if (!ctx) return null;
  return { user, tenant: ctx.tenant };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("demo_script_templates")
    .select("id,name,steps,talking_points,tone,is_default,product_id,created_at,updated_at")
    .eq("id", id)
    .eq("tenant_id", auth.tenant.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.steps !== undefined) updates.steps = body.steps;
  if (body.talking_points !== undefined) updates.talking_points = body.talking_points;
  if (body.tone !== undefined) updates.tone = String(body.tone);
  if (body.is_default !== undefined) updates.is_default = Boolean(body.is_default);
  if (body.product_id !== undefined) updates.product_id = body.product_id;

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("demo_script_templates")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", auth.tenant.id)
    .select("id,name,steps,talking_points,tone,is_default,product_id,updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const svc = createServiceSupabaseClient();
  const { error } = await svc
    .from("demo_script_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
