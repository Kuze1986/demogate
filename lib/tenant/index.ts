import { createServiceSupabaseClient } from "@/lib/supabase/service";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  elevenlabs_voice_id: string | null;
  plan: "free" | "pro" | "enterprise";
  videos_limit: number;
  videos_used: number;
  created_at: string;
}

export interface TenantQuota {
  plan: TenantRow["plan"];
  videos_used: number;
  videos_limit: number;
  remaining: number;
  is_unlimited: boolean;
}

export async function getTenantById(tenantId: string): Promise<TenantRow | null> {
  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("tenants")
    .select("id, name, slug, logo_url, brand_color, elevenlabs_voice_id, plan, videos_limit, videos_used, created_at")
    .eq("id", tenantId)
    .single();
  if (error || !data) return null;
  return data as TenantRow;
}

export async function getTenantBySlug(slug: string): Promise<TenantRow | null> {
  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("tenants")
    .select("id, name, slug, logo_url, brand_color, elevenlabs_voice_id, plan, videos_limit, videos_used, created_at")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data as TenantRow;
}

export async function getCurrentTenant(userId: string): Promise<{ tenant: TenantRow; roleKey: string } | null> {
  const svc = createServiceSupabaseClient();
  const { data: memberships, error } = await svc
    .from("tenant_memberships")
    .select("tenant_id, role_id")
    .eq("user_id", userId)
    .limit(1);
  if (error || !memberships?.length) return null;

  const m = memberships[0];
  const [tenant, roleRow] = await Promise.all([
    getTenantById(m.tenant_id as string),
    svc.from("roles").select("key").eq("id", m.role_id as string).single(),
  ]);
  if (!tenant) return null;
  return { tenant, roleKey: (roleRow.data?.key as string) ?? "" };
}

export async function assertTenantMembership(userId: string, tenantId: string): Promise<void> {
  const svc = createServiceSupabaseClient();
  const { data, error } = await svc
    .from("tenant_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) {
    throw new Error("Unauthorized: no membership for this tenant.");
  }
}

export async function getTenantQuota(tenantId: string): Promise<TenantQuota> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
  const is_unlimited = tenant.videos_limit === -1;
  return {
    plan: tenant.plan,
    videos_used: tenant.videos_used,
    videos_limit: tenant.videos_limit,
    remaining: is_unlimited ? Infinity : Math.max(0, tenant.videos_limit - tenant.videos_used),
    is_unlimited,
  };
}

export async function incrementVideoUsage(tenantId: string): Promise<void> {
  const svc = createServiceSupabaseClient();
  const { error } = await svc.rpc("increment_tenant_videos_used", { p_tenant_id: tenantId });
  if (error) {
    // Fallback: manual increment if RPC not available
    const tenant = await getTenantById(tenantId);
    if (tenant) {
      await svc
        .from("tenants")
        .update({ videos_used: tenant.videos_used + 1 })
        .eq("id", tenantId);
    }
  }
}

/** Slugify a company name to a URL-safe slug */
export function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function generateUniqueSlug(baseName: string): Promise<string> {
  const svc = createServiceSupabaseClient();
  const base = slugifyCompanyName(baseName) || "tenant";
  let slug = base;
  let attempt = 0;

  while (attempt < 10) {
    const { data } = await svc.from("tenants").select("id").eq("slug", slug).single();
    if (!data) return slug;
    attempt++;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now()}`;
}
