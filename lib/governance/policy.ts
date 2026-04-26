import { createServiceSupabaseClient } from "@/lib/supabase/service";

type DemoforgeClient = ReturnType<typeof createServiceSupabaseClient>;

const ADMIN_ROLES = ["owner", "admin"] as const;

async function fetchMembershipRoles(
  supabase: DemoforgeClient,
  userId: string
): Promise<{ tenantId: string; roleKey: string }[]> {
  const { data: memberships, error: mErr } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role_id")
    .eq("user_id", userId);
  if (mErr) {
    throw new Error(mErr.message);
  }
  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const roleIds = [...new Set(rows.map((r) => r.role_id as string))];
  const { data: roles, error: rErr } = await supabase
    .from("roles")
    .select("id, key")
    .in("id", roleIds);
  if (rErr) {
    throw new Error(rErr.message);
  }
  const keyById = new Map(
    (roles ?? []).map((row) => [row.id as string, row.key as string])
  );
  return rows.map((row) => ({
    tenantId: row.tenant_id as string,
    roleKey: keyById.get(row.role_id as string) ?? "",
  }));
}

export async function canAccessAdminPanel(
  supabase: DemoforgeClient,
  user: { id: string; email?: string | null }
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email && user.email.toLowerCase() === adminEmail.toLowerCase()) {
    return true;
  }
  const memberships = await fetchMembershipRoles(supabase, user.id);
  return memberships.some((m) => ADMIN_ROLES.includes(m.roleKey as (typeof ADMIN_ROLES)[number]));
}

export async function requireBillingAdminForTenant(
  supabase: DemoforgeClient,
  userId: string,
  tenantId: string
): Promise<void> {
  const memberships = await fetchMembershipRoles(supabase, userId);
  const hit = memberships.find(
    (m) =>
      m.tenantId === tenantId &&
      ADMIN_ROLES.includes(m.roleKey as (typeof ADMIN_ROLES)[number])
  );
  if (!hit) {
    throw new Error("Unauthorized: billing admin role required for this tenant.");
  }
}
