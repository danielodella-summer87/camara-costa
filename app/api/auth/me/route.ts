import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();

  // 1) Auth user (desde cookies)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData?.user ?? null;

  if (authErr || !user) {
    return NextResponse.json(
      { authed: false, user: null, app_user: null, session: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2) Session (opcional, para debug)
  const { data: sessionData } = await supabase.auth.getSession();

  // 3) Buscar perfil interno por auth_user_id
  const baseSelect = `
    id,
    email,
    nombre,
    is_active,
    role_id,
    auth_user_id,
    comercial_id,
    roles:roles ( id, name )
  `;

  let appUser: any = null;

  // a) por auth_user_id
  const byAuth = await supabase
    .from("app_users")
    .select(baseSelect)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuth.error) {
    return NextResponse.json(
      {
        authed: true,
        user,
        app_user: null,
        session: sessionData?.session ?? null,
        error: byAuth.error.message,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  appUser = byAuth.data ?? null;

  // b) si no existe por auth_user_id, intentar por email y vincular auth_user_id
  if (!appUser && user.email) {
    const email = String(user.email).toLowerCase().trim();

    const byEmail = await supabase
      .from("app_users")
      .select(baseSelect)
      .ilike("email", email)
      .maybeSingle();

    if (byEmail.data?.id) {
      // vincular auth_user_id
      const link = await supabase
        .from("app_users")
        .update({ auth_user_id: user.id })
        .eq("id", byEmail.data.id)
        .select(baseSelect)
        .maybeSingle();

      appUser = link.data ?? byEmail.data ?? null;
    }
  }

  // 4) Normalizar rol
  const role =
    appUser?.roles?.name ??
    (typeof appUser?.roles?.[0]?.name === "string" ? appUser.roles[0].name : null);

  return NextResponse.json(
    {
      authed: true,
      user,
      session: sessionData?.session ?? null,
      app_user: appUser
        ? {
            id: appUser.id,
            email: appUser.email,
            nombre: appUser.nombre,
            is_active: appUser.is_active,
            role_id: appUser.role_id,
            role,
            auth_user_id: appUser.auth_user_id,
            comercial_id: appUser.comercial_id ?? null,
          }
        : null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
