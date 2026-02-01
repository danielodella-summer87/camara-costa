import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function r(url: URL, reason: string, extra?: Record<string, string | null | undefined>) {
  const u = new URL("/403", url.origin);
  u.searchParams.set("reason", reason);
  if (extra?.email) u.searchParams.set("email", extra.email);
  if (extra?.uid) u.searchParams.set("uid", extra.uid);
  if (extra?.extra) u.searchParams.set("extra", extra.extra);
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?e=missing_code", url.origin));
  }

  const supabase = await createServerSupabase();

  // 1) Intercambiar code por sesión (setea cookies)
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) {
    return NextResponse.redirect(new URL(`/login?e=${encodeURIComponent(exErr.message)}`, url.origin));
  }

  // 2) Obtener usuario auth
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData?.user ?? null;

  if (authErr || !user) {
    return r(url, "NO_AUTH_USER");
  }

  const email = user.email ? String(user.email).toLowerCase().trim() : null;

  // 3) Buscar app_user por auth_user_id
  const select = `id,email,nombre,is_active,role_id,auth_user_id`;

  const byAuth = await supabase
    .from("app_users")
    .select(select)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuth.error) {
    return r(url, "APP_USERS_QUERY_ERROR_BY_AUTH", { email, uid: user.id, extra: byAuth.error.message });
  }

  let appUser: any = byAuth.data ?? null;

  // 4) Fallback por email + vincular auth_user_id
  if (!appUser && email) {
    const byEmail = await supabase
      .from("app_users")
      .select(select)
      .ilike("email", email)
      .maybeSingle();

    if (byEmail.error) {
      return r(url, "APP_USERS_QUERY_ERROR_BY_EMAIL", { email, uid: user.id, extra: byEmail.error.message });
    }

    if (byEmail.data?.id) {
      const link = await supabase
        .from("app_users")
        .update({ auth_user_id: user.id })
        .eq("id", byEmail.data.id)
        .select(select)
        .maybeSingle();

      if (link.error) {
        return r(url, "APP_USERS_LINK_ERROR", { email, uid: user.id, extra: link.error.message });
      }

      appUser = link.data ?? byEmail.data ?? null;
    }
  }

  // 5) Reglas de acceso
  if (!appUser) {
    return r(url, "NO_APP_USER", { email, uid: user.id });
  }

  if (appUser.is_active !== true) {
    return r(url, "INACTIVE_APP_USER", { email: appUser.email, uid: user.id });
  }

  // OK → dashboard
  return NextResponse.redirect(new URL("/admin", url.origin));
}
