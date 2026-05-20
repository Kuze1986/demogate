import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const svc = createServiceSupabaseClient();

  const { data: tenant } = await svc
    .from("tenants")
    .select("name,logo_url,brand_color")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: tenant.name,
    logoUrl: tenant.logo_url ?? null,
    brandColor: tenant.brand_color ?? "#6366f1",
  });
}
