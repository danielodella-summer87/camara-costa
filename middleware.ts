import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccessPath } from "@/app/lib/rbac";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // ✅ RBAC: traer rol desde app_users por auth_user_id (NO por id)
  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_active, roles:role_id(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const rel = (appUser as { roles?: { name?: string } | { name?: string }[] } | null)?.roles;
  const roleFromRelation =
    rel == null ? null : Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;

  const isActive = (appUser as { is_active?: boolean } | null)?.is_active ?? false;

  const pathname = req.nextUrl.pathname;

  // si no está activo (o no tiene app_user), lo consideramos sin acceso
  if (!isActive) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return NextResponse.redirect(deniedUrl);
  }

  if (!canAccessPath({ role: roleFromRelation }, pathname)) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return NextResponse.redirect(deniedUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
