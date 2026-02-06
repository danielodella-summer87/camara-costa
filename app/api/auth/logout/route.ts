import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { destroySession, getSessionCookieName, clearSessionCookieHeader } from "@/lib/auth/internalAuth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName())?.value ?? null;

  if (sessionCookie) {
    await destroySession(sessionCookie, supabaseServer);
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("Set-Cookie", clearSessionCookieHeader());
  return res;
}
