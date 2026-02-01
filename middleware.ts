import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccessPath, normalizeRole } from "@/app/lib/rbac";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // 1) Auth user (Supabase Auth)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const pathname = req.nextUrl.pathname;

  // 2) RBAC: buscar app_user por auth_user_id (NO por id); rol solo desde roles.name
  const { data: appUser, error: appUserErr } = await supabase
    .from("app_users")
    .select("roles:role_id(name), is_active, auth_user_id, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Si no existe registro en app_users -> deny (allowlist)
  if (appUserErr || !appUser) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return NextResponse.redirect(deniedUrl);
  }

  // Si está inactivo -> deny
  if (appUser.is_active === false) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return NextResponse.redirect(deniedUrl);
  }

  const rel = (appUser as { roles?: { name?: string } | { name?: string }[] } | null)?.roles;
  const roleRaw =
    rel == null ? null : Array.isArray(rel) ? rel[0]?.name ?? null : (rel as { name?: string })?.name ?? null;
  const role = normalizeRole(roleRaw);

  if (!canAccessPath({ role }, pathname)) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return NextResponse.redirect(deniedUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
