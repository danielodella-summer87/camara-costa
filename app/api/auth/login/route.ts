import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  verifyPassword,
  createSession,
  sessionCookieOptions,
  getSessionCookieName,
} from "@/lib/auth/internalAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Usuario y contraseña requeridos" },
        { status: 400 }
      );
    }

    const { data: cred, error: credErr } = await supabaseServer
      .from("app_credentials")
      .select("user_id, password_hash")
      .eq("username", username)
      .maybeSingle();

    if (credErr) {
      return NextResponse.json(
        { ok: false, error: "Error de autenticación" },
        { status: 500 }
      );
    }

    if (!cred) {
      return NextResponse.json(
        { ok: false, error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, cred.password_hash);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createSession(cred.user_id, supabaseServer);
    const cookie = sessionCookieOptions(token, expiresAt);

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(cookie.name, cookie.value, cookie.options as any);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
