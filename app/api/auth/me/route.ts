import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionUser, getSessionCookieName } from "@/lib/auth/internalAuth";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName())?.value ?? null;

  const session = await getSessionUser(sessionCookie, supabaseServer);
  if (!session) {
    return NextResponse.json(
      { authed: false, ok: false, userId: null, app_user: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: appUser, error } = await supabaseServer
    .from("app_users")
    .select(`
      id,
      email,
      nombre,
      is_active,
      role_id,
      comercial_id,
      roles:roles ( id, name )
    `)
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !appUser) {
    return NextResponse.json(
      { authed: true, ok: true, userId: session.userId, app_user: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const role =
    (appUser as { roles?: { name?: string } | { name?: string }[] }).roles != null
      ? Array.isArray((appUser as any).roles)
        ? (appUser as any).roles[0]?.name ?? null
        : (appUser as any).roles?.name ?? null
      : null;

  return NextResponse.json(
    {
      authed: true,
      ok: true,
      userId: session.userId,
      user: {
        email: appUser.email ?? null,
        user_metadata: { full_name: appUser.nombre ?? null, name: appUser.nombre ?? null },
      },
      app_user: {
        id: appUser.id,
        email: appUser.email,
        nombre: appUser.nombre,
        is_active: appUser.is_active,
        role_id: appUser.role_id,
        role,
        comercial_id: appUser.comercial_id ?? null,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
