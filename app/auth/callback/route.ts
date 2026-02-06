import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin";
  const origin = url.origin;

  if (!code) {
    const r = new URL("/login", origin);
    r.searchParams.set("reason", "NO_CODE");
    return NextResponse.redirect(r);
  }

  // 1) Intercambiar code por sesión (esto setea cookies)
  const supabase = await createServerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const r = new URL("/login", origin);
    r.searchParams.set("reason", "EXCHANGE_FAILED");
    r.searchParams.set("message", exchangeError.message);
    return NextResponse.redirect(r);
  }

  // 2) Obtener el user ya autenticado
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    const r = new URL("/403", origin);
    r.searchParams.set("reason", "NO_AUTH_USER");
    return NextResponse.redirect(r);
  }

  const email = user.email.trim().toLowerCase();

  // 3) Vincular allowlist (app_users) usando SERVICE ROLE (bypass RLS)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn("[AUTH CALLBACK] Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
      const r = new URL("/403", origin);
      r.searchParams.set("reason", "MISSING_SERVICE_ROLE");
      r.searchParams.set("email", email);
      return NextResponse.redirect(r);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Buscar en app_users por email
    const { data: appUser, error: appUserErr } = await admin
      .from("app_users")
      .select("id, auth_user_id, is_active")
      .eq("email", email)
      .maybeSingle();

    if (appUserErr) {
      console.warn("[AUTH CALLBACK] app_users lookup error:", appUserErr.message, { email });
      const r = new URL("/403", origin);
      r.searchParams.set("reason", "APP_USER_LOOKUP_ERROR");
      r.searchParams.set("email", email);
      return NextResponse.redirect(r);
    }

    // Si no existe en allowlist: NO puede entrar
    if (!appUser) {
      const r = new URL("/403", origin);
      r.searchParams.set("reason", "NO_APP_USER");
      r.searchParams.set("email", email);
      return NextResponse.redirect(r);
    }

    // Si existe pero está inactivo: NO puede entrar
    if (!appUser.is_active) {
      const r = new URL("/403", origin);
      r.searchParams.set("reason", "APP_USER_INACTIVE");
      r.searchParams.set("email", email);
      return NextResponse.redirect(r);
    }

    // Si existe fila en app_users con este email y auth_user_id es null → vincular (evita 403 y deja sistema consistente)
    if (!appUser.auth_user_id) {
      const { error: updErr } = await admin
        .from("app_users")
        .update({ auth_user_id: user.id })
        .eq("id", appUser.id);

      if (updErr) {
        console.warn("[AUTH CALLBACK] Failed to set auth_user_id:", updErr.message, { email, userId: user.id });
        const r = new URL("/403", origin);
        r.searchParams.set("reason", "APP_USER_UPDATE_ERROR");
        r.searchParams.set("email", email);
        return NextResponse.redirect(r);
      }

      console.log("[AUTH CALLBACK] Linked app_users.auth_user_id OK:", { email, userId: user.id });
    } else {
      // Si ya estaba vinculado, ok
      console.log("[AUTH CALLBACK] app_users already linked:", { email, auth_user_id: appUser.auth_user_id });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[AUTH CALLBACK] Unexpected error:", msg);
    const r = new URL("/403", origin);
    r.searchParams.set("reason", "CALLBACK_EXCEPTION");
    r.searchParams.set("email", email);
    return NextResponse.redirect(r);
  }

  // 4) Ya está vinculado => redirigir donde corresponde
  return NextResponse.redirect(new URL(next, origin));
}
