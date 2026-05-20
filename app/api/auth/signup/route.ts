import { createServerClient } from "@supabase/ssr";
import { createServiceSupabaseClient, createServiceSupabaseClientPublicSchema } from "@/lib/supabase/service";
import { generateUniqueSlug } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const companyName = String(body.companyName ?? "").trim();

  if (!firstName || !email || !password || !companyName) {
    return NextResponse.json(
      { error: "firstName, email, password, and companyName are required" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const svcPublic = createServiceSupabaseClientPublicSchema();
  const svc = createServiceSupabaseClient();

  // 1. Create auth user
  const { data: authData, error: authError } = await svcPublic.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, company_name: companyName },
  });
  if (authError) {
    if (authError.message?.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }
  const userId = authData.user.id;

  // 2. Create tenant
  const slug = await generateUniqueSlug(companyName);
  const { data: tenant, error: tenantError } = await svc
    .from("tenants")
    .insert({ name: companyName, slug, plan: "free", videos_limit: 5, videos_used: 0 })
    .select("id, slug")
    .single();
  if (tenantError || !tenant) {
    // Roll back auth user
    await svcPublic.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }

  // 3. Get owner role ID
  const { data: ownerRole, error: roleError } = await svc
    .from("roles")
    .select("id")
    .eq("key", "owner")
    .single();
  if (roleError || !ownerRole) {
    await svcPublic.auth.admin.deleteUser(userId);
    await svc.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Role configuration error" }, { status: 500 });
  }

  // 4. Create tenant membership (owner)
  const { error: membershipError } = await svc.from("tenant_memberships").insert({
    user_id: userId,
    tenant_id: tenant.id,
    role_id: ownerRole.id,
  });
  if (membershipError) {
    await svcPublic.auth.admin.deleteUser(userId);
    await svc.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Failed to create membership" }, { status: 500 });
  }

  // billing_customers row is created lazily by the Stripe webhook
  // (checkout.session.completed carries tenant_id + user_id in metadata)

  // 5. Sign user in via SSR client to set session cookies
  const response = NextResponse.json(
    { ok: true, tenantId: tenant.id, tenantSlug: tenant.slug },
    { status: 201 }
  );

  const cookieClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await cookieClient.auth.signInWithPassword({ email, password });

  return response;
}
