/**
 * RBAC simple por rol (app_users.role / app_users.rol).
 * Todas las validaciones de acceso pasan por este helper.
 */

export type RoleKey = "admin" | "operador" | "comercial" | "viewer";

/** Usuario con rol (ej. respuesta de /api/admin/permissions/me → user) */
export type UserWithRole = { role?: string | null };

/** Extrae y normaliza el rol del usuario. */
export function getRole(user: UserWithRole | string | null | undefined): RoleKey | null {
  if (user == null) return null;
  const role = typeof user === "string" ? user : (user as UserWithRole).role;
  return normalizeRole(role);
}

/**
 * True si el usuario tiene exactamente el rol indicado.
 * Comparación normalizada (ej. "operaciones" → "operador").
 */
export function hasRole(user: UserWithRole | string | null | undefined, role: string): boolean {
  const r = getRole(user);
  const target = normalizeRole(role);
  if (!r || !target) return false;
  return r === target;
}

/**
 * True si el usuario tiene alguno de los roles indicados.
 */
export function hasAnyRole(
  user: UserWithRole | string | null | undefined,
  roles: readonly string[]
): boolean {
  const r = getRole(user);
  if (!r) return false;
  return roles.some((role) => normalizeRole(role) === r);
}

/** Permisos por rol. admin tiene todos implícitamente. */
const PERMISSIONS_BY_ROLE: Record<Exclude<RoleKey, "admin">, string[]> = {
  operador: ["leads.read", "leads.write", "helpdesk.read", "helpdesk.write"],
  comercial: ["leads.read", "leads.write"],
  viewer: ["leads.read"],
};

const NORMALIZED_ROLES: RoleKey[] = ["admin", "operador", "comercial", "viewer"];

/** Alias de nombres de rol en DB (roles.name) a RoleKey */
const ROLE_ALIASES: Record<string, RoleKey> = {
  operaciones: "operador",
  solo_lectura: "viewer",
  gerencia: "viewer",
};

export function normalizeRole(role: string | null | undefined): RoleKey | null {
  if (role == null || typeof role !== "string") return null;
  const r = role.trim().toLowerCase();
  if (NORMALIZED_ROLES.includes(r as RoleKey)) return r as RoleKey;
  return ROLE_ALIASES[r] ?? null;
}

/** Etiqueta legible del rol para UI (header, etc.). user.role como fuente única. */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  operador: "Operador",
  comercial: "Comercial",
  viewer: "Viewer",
  operaciones: "Operador",
  solo_lectura: "Viewer",
  gerencia: "Gerencia",
};

export function roleToLabel(role: string | null | undefined): string {
  if (role == null || typeof role !== "string") return "Sin rol";
  const r = role.trim().toLowerCase();
  return ROLE_LABELS[r] ?? r.charAt(0).toUpperCase() + r.slice(1);
}

/** Rutas protegidas por rol (middleware RBAC). pathname debe empezar con el segmento. */
const PATH_ROLES: { prefix: string; allowed: RoleKey[] }[] = [
  { prefix: "/admin/configuracion", allowed: ["admin"] },
  { prefix: "/admin/ia", allowed: ["admin"] },
  { prefix: "/admin/mesa-de-ayuda", allowed: ["admin", "operador"] },
  { prefix: "/admin/leads", allowed: ["admin", "comercial", "operador"] },
];

/**
 * Devuelve true si el usuario puede acceder a la pathname dada.
 * Todas las validaciones de acceso por ruta pasan por aquí.
 * Si no hay regla para el path, se permite (solo auth).
 */
export function canAccessPath(
  user: UserWithRole | string | null | undefined,
  pathname: string
): boolean {
  const r = getRole(user);
  if (!r) return false;
  if (r === "admin") return true;
  for (const { prefix, allowed } of PATH_ROLES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return hasAnyRole(r, allowed);
    }
  }
  return true;
}

/** Alias de permisos (UI puede usar leads.create; mapa usa leads.write) */
const PERMISSION_ALIASES: Record<string, string> = {
  "leads.create": "leads.write",
};

/**
 * Devuelve true si el usuario tiene el permiso indicado.
 * Todas las validaciones de permiso pasan por aquí.
 * - admin: tiene todos los permisos.
 * - Otros roles: se consulta PERMISSIONS_BY_ROLE.
 */
export function hasPermission(
  user: UserWithRole | string | null | undefined,
  permission: string
): boolean {
  const key = PERMISSION_ALIASES[permission] ?? permission;
  const r = getRole(user);
  if (!r) return false;
  if (r === "admin") return true;
  const list = PERMISSIONS_BY_ROLE[r as Exclude<RoleKey, "admin">];
  if (!list) return false;
  return list.includes(key);
}
