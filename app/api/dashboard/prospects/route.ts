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

export async function GET(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "20")));
  const from = (page - 1) * limit;

  const svc = createServiceSupabaseClient();
  const { data, count, error } = await svc
    .from("prospects")
    .select("id,first_name,last_name,email,organization,role,persona,is_qualified,created_at", { count: "exact" })
    .eq("tenant_id", auth.tenant.id)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("prospects")
    .insert({
      tenant_id:        auth.tenant.id,
      first_name:       body.firstName ?? body.first_name ?? null,
      last_name:        body.lastName ?? body.last_name ?? null,
      email,
      organization:     body.organization ?? null,
      role:             body.role ?? null,
      persona:          body.persona ?? "unknown",
      pain_points:      body.pain_points ?? body.painPoints ?? [],
      product_interest: body.product_interest ?? body.productInterest ?? [],
      is_qualified:     true,
    })
    .select("id,first_name,last_name,email,organization,role,persona,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
