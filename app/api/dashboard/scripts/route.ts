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

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("demo_script_templates")
    .select("id,name,steps,talking_points,tone,is_default,product_id,created_at,updated_at")
    .eq("tenant_id", auth.tenant.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scripts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("demo_script_templates")
    .insert({
      tenant_id:      auth.tenant.id,
      name,
      product_id:     body.product_id ?? null,
      steps:          body.steps ?? [],
      talking_points: body.talking_points ?? [],
      tone:           body.tone ?? "confident",
      is_default:     body.is_default ?? false,
    })
    .select("id,name,steps,talking_points,tone,is_default,product_id,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
