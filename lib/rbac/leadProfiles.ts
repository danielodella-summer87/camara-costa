/**
 * Perfiles de IA permitidos por rol para endpoints de lead (ai-report, gamma, pdf).
 * Solo validación backend; no modifica prompts ni builders.
 */

export type LeadProfileId = "comercial" | "tecnico";

/**
 * Devuelve los perfiles de IA que el rol puede usar.
 * - admin, consultor, operador => comercial + tecnico
 * - comercial => solo comercial
 * - tecnico => solo tecnico
 * - viewer => ninguno
 * - default => []
 */
const ROLE_ALIASES: Record<string, string> = {
  operaciones: "operador",
  solo_lectura: "viewer",
  gerencia: "viewer",
};

export function getAllowedLeadProfilesByRole(
  role: string | null | undefined
): LeadProfileId[] {
  if (role == null || typeof role !== "string") return [];
  const r = (ROLE_ALIASES[role.trim().toLowerCase()] ?? role.trim().toLowerCase());
  if (r === "admin" || r === "consultor" || r === "operador") return ["comercial", "tecnico"];
  if (r === "comercial") return ["comercial"];
  if (r === "tecnico") return ["tecnico"];
  return [];
}

/**
 * Obtiene el nombre del rol (roles.name) a partir de role_id.
 * Compatible con app_users.role_id y tabla roles(id, name, ...).
 */
export async function getRoleNameByRoleId(
  sb: unknown,
  roleId: string | null | undefined
): Promise<string | null> {
  if (!sb || !roleId || !String(roleId).trim()) return null;
  const client = sb as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { name?: string | null } | null }> } } } };
  const { data } = await client.from("roles").select("name").eq("id", roleId).maybeSingle();
  const name = data?.name;
  return name != null && String(name).trim() !== "" ? String(name).trim() : null;
}
