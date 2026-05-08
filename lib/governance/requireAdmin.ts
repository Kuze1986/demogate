import { canAccessAdminPanel } from "@/lib/governance/policy";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase/server";

export type AdminActor = {
  id: string;
  email?: string | null;
};

export async function getAdminActor(): Promise<AdminActor | null> {
  const serverSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user?.id) {
    return null;
  }

  const svc = createServiceSupabaseClient();
  const allowed = await canAccessAdminPanel(svc, {
    id: user.id,
    email: user.email,
  });
  if (!allowed) {
    return null;
  }

  return { id: user.id, email: user.email };
}

export async function requireAdmin(): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor) {
    throw new Error("Unauthorized");
  }
  return actor;
}
