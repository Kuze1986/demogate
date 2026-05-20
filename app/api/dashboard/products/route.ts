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
    .from("tenant_products")
    .select("id,name,description,base_url,created_at")
    .eq("tenant_id", auth.tenant.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const name = String(body.name ?? "").trim();
  const base_url = String(body.base_url ?? "").trim();
  if (!name || !base_url) return NextResponse.json({ error: "name and base_url are required" }, { status: 400 });

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("tenant_products")
    .insert({ tenant_id: auth.tenant.id, name, base_url, description: body.description ?? null })
    .select("id,name,base_url,description,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
