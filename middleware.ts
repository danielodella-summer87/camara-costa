import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, getSessionCookieName } from "@/lib/auth/internalAuth";
import { canAccessPath } from "@/app/lib/rbac";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Permitir /login siempre
  if (pathname.startsWith("/login") || pathname === "/login") {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(getSessionCookieName())?.value ?? null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const session = await getSessionUser(sessionCookie, admin);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const { data: appUser } = await admin
    .from("app_users")
    .select("is_active, roles:role_id(name)")
    .eq("id", session.userId)
    .maybeSingle();

  const rel = (appUser as { roles?: { name?: string } | { name?: string }[] } | null)?.roles;
  const roleFromRelation =
    rel == null ? null : Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;
  const isActive = (appUser as { is_active?: boolean } | null)?.is_active ?? false;

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

  const res = NextResponse.next();
  res.headers.set("x-user-id", session.userId);
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
