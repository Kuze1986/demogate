import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccessAdminPanel } from "@/lib/governance/policy";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { updateSession } from "@/lib/supabase/middleware";

async function adminGate(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let res = NextResponse.next({ request });

  if (!url || !key) {
    return res;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        res = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    const svc = createServiceSupabaseClient();
    const allowed = await canAccessAdminPanel(svc, {
      id: user.id,
      email: user.email,
    });
    if (!allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/admin/login?error=forbidden", request.url)
      );
    }
  } catch {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/admin/login?error=forbidden", request.url)
    );
  }

  return res;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
    return adminGate(request);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
