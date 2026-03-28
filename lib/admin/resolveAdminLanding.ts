import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { mergeAdminSidebarModules, type AdminSidebarModule } from "@/lib/admin/adminSidebarModules";

const CONFIG_KEY = "portal_config";

type PortalJson = {
  sidebar_modules?: unknown;
  admin_landing_path?: string | null;
};

function isModuleActive(m: AdminSidebarModule): boolean {
  return m.status === "activo";
}

/**
 * Encuentra el módulo del menú que “posee” una ruta (exacta o prefijo más largo).
 */
export function findSidebarModuleForPath(
  modules: AdminSidebarModule[],
  path: string
): AdminSidebarModule | undefined {
  const norm = (path.split("?")[0] ?? "").replace(/\/$/, "") || "/admin";
  const exact = modules.find((m) => m.href.replace(/\/$/, "") === norm);
  if (exact) return exact;
  const byPrefix = modules
    .filter((m) => {
      const h = m.href.replace(/\/$/, "");
      return norm === h || norm.startsWith(`${h}/`);
    })
    .sort((a, b) => b.href.length - a.href.length);
  return byPrefix[0];
}

/**
 * Resuelve la URL de entrada de `/admin` según `portal_config` y estados del menú.
 *
 * Prioridad:
 * 1. `admin_landing_path` en portal_config, solo si el módulo asociado está **activo** (no en_preparacion / oculto).
 * 2. **Dashboard** (`/admin/dashboard`, key `dashboard_comercial`) si está **activo**.
 * 3. Primer módulo **activo** en el orden del menú.
 * 4. Fallback `/admin/dashboard`.
 *
 * Nunca devuelve una ruta cuyo módulo no esté `activo` (salvo fallback).
 */
export async function resolveAdminLandingPath(): Promise<string> {
  let merged: AdminSidebarModule[] = mergeAdminSidebarModules(undefined);
  let adminLandingPath: string | null = null;

  try {
    const { data } = await supabaseServer.from("config").select("value").eq("key", CONFIG_KEY).maybeSingle();
    if (data?.value && typeof data.value === "string") {
      const cfg = JSON.parse(data.value) as PortalJson;
      merged = mergeAdminSidebarModules(cfg.sidebar_modules as never);
      const raw = typeof cfg.admin_landing_path === "string" ? cfg.admin_landing_path.trim() : "";
      if (raw.startsWith("/admin") && !raw.includes("..") && raw.length < 240) {
        adminLandingPath = raw.split("?")[0] ?? null;
      }
    }
  } catch {
    merged = mergeAdminSidebarModules(undefined);
  }

  if (adminLandingPath) {
    const mod = findSidebarModuleForPath(merged, adminLandingPath);
    if (mod && isModuleActive(mod)) return adminLandingPath;
  }

  const comercial = merged.find((m) => m.key === "dashboard_comercial");
  if (comercial && isModuleActive(comercial)) return "/admin/dashboard";

  const firstActive = merged.find((m) => isModuleActive(m));
  if (firstActive) return firstActive.href;

  return "/admin/dashboard";
}
