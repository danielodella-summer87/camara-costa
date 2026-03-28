/**
 * Menú lateral del admin: definición por defecto + merge con overrides en `portal_config.sidebar_modules`.
 */

export type SidebarModuleStatus = "activo" | "en_preparacion" | "oculto";

export type AdminSidebarModule = {
  key: string;
  label: string;
  href: string;
  icon: string;
  status: SidebarModuleStatus;
  /** Si true, el texto visible usa `label_member_plural` (Personalización), no `label` guardado. */
  useMemberPluralLabel?: boolean;
};

/** Fragmento persistido en JSON (solo deltas sobre el default). */
export type SidebarModulePersisted = {
  key: string;
  label?: string;
  icon?: string;
  status?: SidebarModuleStatus;
};

export const DEFAULT_ADMIN_SIDEBAR_MODULES: AdminSidebarModule[] = [
  { key: "dashboard", label: "Centro de control", href: "/admin", icon: "🏠", status: "en_preparacion" },
  { key: "dashboard_comercial", label: "Dashboard comercial", href: "/admin/dashboard", icon: "📈", status: "activo" },
  { key: "entidades", label: "Entidades", href: "/admin/empresas", icon: "🏢", status: "activo" },
  { key: "oportunidades", label: "Oportunidades", href: "/admin/oportunidades", icon: "💼", status: "en_preparacion" },
  { key: "leads87", label: "LEADS87", href: "/admin/leads87", icon: "🎯", status: "activo" },
  {
    key: "socios",
    label: "Socios",
    href: "/admin/socios",
    icon: "👥",
    status: "activo",
    useMemberPluralLabel: true,
  },
  { key: "agenda", label: "Agenda", href: "/admin/agenda", icon: "📅", status: "activo" },
  { key: "reuniones", label: "Reuniones", href: "/admin/reuniones", icon: "🤝", status: "en_preparacion" },
  { key: "operaciones", label: "Operaciones", href: "/admin/operaciones", icon: "⚙️", status: "en_preparacion" },
  { key: "reportes", label: "Reportes", href: "/admin/reportes", icon: "📊", status: "activo" },
  { key: "eventos", label: "Eventos", href: "/admin/eventos", icon: "🎉", status: "en_preparacion" },
  { key: "mesa_ayuda", label: "Mesa de ayuda", href: "/admin/mesa-de-ayuda", icon: "🆘", status: "activo" },
  { key: "neuroventas", label: "Manual de neuroventas", href: "/admin/neuroventas", icon: "📘", status: "activo" },
  { key: "ia", label: "IA", href: "/admin/ia", icon: "🧠", status: "activo" },
  { key: "personalizacion", label: "Personalización", href: "/admin/personalizacion", icon: "🎨", status: "activo" },
  { key: "configuracion", label: "Configuración", href: "/admin/configuracion", icon: "🛠️", status: "activo" },
];

const ALLOWED_KEYS = new Set(DEFAULT_ADMIN_SIDEBAR_MODULES.map((m) => m.key));

export function mergeAdminSidebarModules(
  persisted: SidebarModulePersisted[] | null | undefined
): AdminSidebarModule[] {
  const byKey = new Map<string, SidebarModulePersisted>();
  for (const p of persisted ?? []) {
    if (p?.key && ALLOWED_KEYS.has(p.key)) byKey.set(p.key, p);
  }
  return DEFAULT_ADMIN_SIDEBAR_MODULES.map((def) => {
    const o = byKey.get(def.key);
    const status: SidebarModuleStatus =
      o?.status === "activo" || o?.status === "en_preparacion" || o?.status === "oculto"
        ? o.status
        : def.status;
    return {
      ...def,
      label: typeof o?.label === "string" && o.label.trim() ? o.label.trim() : def.label,
      icon: typeof o?.icon === "string" && o.icon.trim() ? o.icon.trim() : def.icon,
      status,
    };
  });
}

/** Sanitiza el body PATCH: solo keys conocidas y campos acotados. */
export function sanitizeSidebarModulesForPersist(raw: unknown): SidebarModulePersisted[] {
  if (!Array.isArray(raw)) return [];
  const out: SidebarModulePersisted[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const key = typeof (x as { key?: string }).key === "string" ? (x as { key: string }).key.trim() : "";
    if (!key || !ALLOWED_KEYS.has(key)) continue;
    const row: SidebarModulePersisted = { key };
    const label = (x as { label?: string }).label;
    if (typeof label === "string" && label.trim()) row.label = label.trim().slice(0, 120);
    const icon = (x as { icon?: string }).icon;
    if (typeof icon === "string") row.icon = icon.slice(0, 32);
    const st = (x as { status?: string }).status;
    if (st === "activo" || st === "en_preparacion" || st === "oculto") row.status = st;
    out.push(row);
  }
  return out;
}
