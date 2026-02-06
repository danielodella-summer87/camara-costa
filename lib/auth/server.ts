import "server-only";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionUser, getSessionCookieName } from "@/lib/auth/internalAuth";

/**
 * Obtiene el user_id (app_users.id) de la sesión interna desde la cookie.
 * Retorna null si no hay sesión válida.
 */
export async function getInternalUserIdFromRequest(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName())?.value ?? null;
  const session = await getSessionUser(sessionCookie, supabaseServer);
  return session?.userId ?? null;
}

/**
 * Obtiene el app_user actual (por sesión interna) con rol e is_active.
 * Retorna null si no hay sesión o no existe el usuario.
 */
export async function getAppUserFromRequest(): Promise<{
  id: string;
  email: string | null;
  nombre: string | null;
  is_active: boolean | null;
  role_id: string | null;
  role: string | null;
  comercial_id: string | null;
} | null> {
  const userId = await getInternalUserIdFromRequest();
  if (!userId) return null;

  const { data, error } = await supabaseServer
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
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const role =
    (data as { roles?: { name?: string } | { name?: string }[] }).roles != null
      ? Array.isArray((data as any).roles)
        ? (data as any).roles[0]?.name ?? null
        : (data as any).roles?.name ?? null
      : null;

  return {
    id: data.id,
    email: data.email ?? null,
    nombre: data.nombre ?? null,
    is_active: data.is_active ?? null,
    role_id: data.role_id ?? null,
    role,
    comercial_id: data.comercial_id ?? null,
  };
}
