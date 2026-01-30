type PermKey = { key?: string | null };
type PermShape =
  | { permissions?: PermKey | null }
  | { permission_id?: string | null; permissions?: PermKey[] | null };

/**
 * Extrae los permission keys (strings) de la respuesta de Supabase role_permissions + permissions.
 * Acepta ambos shapes: permissions como objeto único o como array.
 */
export function extractPermissionKeys(perms?: PermShape[] | null): string[] {
  return (perms ?? [])
    .flatMap((x) => {
      const p = (x as { permissions?: PermKey | PermKey[] | null }).permissions;
      if (p == null) return [];
      if (Array.isArray(p)) return p.map((i) => (i?.key ?? "").toString().trim());
      return [(p?.key ?? "").toString().trim()];
    })
    .filter(Boolean);
}
