import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "app_users";

/**
 * Nombre para mostrar: full_name || name || email
 */
function displayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const fullName = meta.full_name ?? meta.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  const email = user.email ?? "";
  return email.trim() || "Usuario";
}

export type SyncUserOptions = {
  /** Rol desde invitación (allowlist); si no se pasa, insert usa "viewer" y update no toca rol */
  role?: string | null;
};

/**
 * Sincroniza el usuario de Auth con la tabla app_users.
 * - Si no existe: inserta con id = user.id, email, nombre, avatar_url, rol = options.role ?? "viewer".
 * - Si existe: actualiza email, nombre, avatar_url y, si options.role está definido, rol.
 *
 * Usar después de exchangeCodeForSession en /auth/callback (con role desde app_user_invites).
 */
export async function syncUserToAppUsers(
  supabase: SupabaseClient,
  user: User,
  options?: SyncUserOptions
): Promise<{ ok: boolean; error?: string }> {
  const id = user.id;
  const email = user.email ?? "";
  const nombre = displayName(user);
  const avatar_url = (user.user_metadata?.avatar_url as string) ?? null;
  const role = options?.role?.trim() || null;

  const { data: existing } = await supabase
    .from(TABLE)
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      email,
      nombre,
      ...(avatar_url != null && { avatar_url }),
    };
    if (role != null) updatePayload.rol = role;

    const { error } = await supabase.from(TABLE).update(updatePayload).eq("id", id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from(TABLE).insert({
    id,
    email,
    nombre,
    ...(avatar_url != null && { avatar_url }),
    rol: role ?? "viewer",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
