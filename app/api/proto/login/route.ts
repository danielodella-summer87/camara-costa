import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyPassword, createSession, sessionCookieOptions } from "@/lib/auth/internalAuth";
import { getDashboardPath } from "@/lib/auth/session";

type DbRoleJoin = { name: string | null } | null;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    // En el front seguimos mandando { cedula, pin } aunque ahora "cedula" sea username.
    const username = String(body?.cedula ?? "").trim();
    const pin = String(body?.pin ?? "");

    if (!username) {
      return NextResponse.json({ ok: false, error: "Ingresá tu nombre de usuario." }, { status: 400 });
    }
    if (!pin) {
      return NextResponse.json({ ok: false, error: "Ingresá tu PIN." }, { status: 400 });
    }

    // A) Credencial por username
    const { data: cred, error: credErr } = await supabaseServer
      .from("app_credentials")
      .select("user_id, password_hash")
      .eq("username", username)
      .maybeSingle();

    if (credErr) throw new Error(credErr.message);
    if (!cred) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado." }, { status: 404 });
    }

    // B) Verificar PIN
    const ok = await verifyPassword(pin, cred.password_hash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto." }, { status: 401 });
    }

    // C) Usuario real + rol (JOIN a roles) y FK garantizado
    const { data: user, error: userErr } = await supabaseServer
      .from("app_users")
      .select("id, role_id, roles:roles ( name )")
      .eq("id", cred.user_id)
      .maybeSingle();

    if (userErr) throw new Error(userErr.message);
    if (!user) throw new Error("Credencial apunta a user_id inexistente en app_users");

    const roleName = ((user as any).roles as DbRoleJoin)?.name ?? null;
    if (!roleName) {
      throw new Error("El usuario no tiene rol asociado (roles.name null). Revisá app_users.role_id y tabla roles.");
    }

    // D) Sesión interna (app_sessions) + cookie crm_session
    const userId = user.id as string;

    if (process.env.NODE_ENV !== "production") {
      console.log("[PROTO_LOGIN] before createSession", { username, userId, roleName });
    }

    const { token, expiresAt } = await createSession(userId, supabaseServer);
    const { name, value, options } = sessionCookieOptions(token, expiresAt);

    if (process.env.NODE_ENV !== "production") {
      console.log("[PROTO_LOGIN] after createSession", { cookieName: name, tokenPreview: token.slice(0, 8), userId });
    }

    const res = NextResponse.json({ ok: true, redirectTo: getDashboardPath(roleName) });
    res.cookies.set(name, value, options);
    return res;
  } catch (err) {
    console.error("[PROTO_LOGIN] ERROR:", err);
    const isDev = process.env.NODE_ENV !== "production";
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: isDev ? message : "Error inesperado." }, { status: 500 });
  }
}
