/**
 * Menú lateral del admin: definición por defecto + merge con overrides en `portal_config.sidebar_modules`.
 *
 * --- Auditoría: fuente efectiva del sidebar visible ---
 *
 * 1) Defaults de código: `DEFAULT_ADMIN_SIDEBAR_MODULES` (incluye nombres desde `APP_SUITE_CONFIG`).
 * 2) Tras el primer paint, el cliente (`AdminShell`) hace `GET /api/admin/config/portal` y vuelve a
 *    aplicar `mergeAdminSidebarModules(json.data.sidebar_modules)`.
 * 3) Persistencia: tabla Supabase `config`, fila `key = 'portal_config'`, campo JSON `sidebar_modules`
 *    (array de `{ key, label?, icon?, status? }`). Ver `app/api/admin/config/portal/route.ts`.
 * 4) Regla de merge: si existe `label` persistido para una `key`, **gana sobre el default**, salvo
 *    excepciones: `entidades`→"Entidades", `leads87`→leads87/LEADS87. Cualquier otro
 *    texto guardado (p. ej. "LEADS87 · …", emoji, "EASY …") **sigue mostrándose** y pisa
 *    "Summer87 Leads".
 * 5) Claves en `HIDDEN_SIDEBAR_MODULE_KEYS` se filtran del resultado final (p. ej. copilot hasta
 *    que el producto esté listo, u otras entradas legadas).
 * 6) Claves en `HIDDEN_SIDEBAR_MODULE_KEYS` no se listan nunca (filtro final tras el merge); tampoco
 *    se re-graban vía `sanitizeSidebarModulesForPersist` si reaparecieran en un PATCH.
 * 7) Logo del sidebar: **no** sale de `portal_config`. `AdminShell` usa fijo `src="/licencia.png"`
 *    (archivo en `public/`). `logo_url` en portal no altera ese `<img>` hoy.
 */

import { APP_SUITE_CONFIG } from "@/lib/config/appSuiteConfig";

export type SidebarModuleStatus = "activo" | "en_preparacion" | "oculto";

export type AdminSidebarModule = {
  key: string;
  label: string;
  href: string;
  icon: string;
  status: SidebarModuleStatus;
  /** Si true, el texto visible usa `label_member_plural` (Personalización), no `label` guardado. */
  useMemberPluralLabel?: boolean;
  /** `footer`: bloque inferior del sidebar (p. ej. personalización / configuración). */
  navGroup?: "main" | "footer";
};

/** Fragmento persistido en JSON (solo deltas sobre el default). */
export type SidebarModulePersisted = {
  key: string;
  label?: string;
  icon?: string;
  status?: SidebarModuleStatus;
};

export const DEFAULT_ADMIN_SIDEBAR_MODULES: AdminSidebarModule[] = [
  { key: "dashboard_comercial", label: "Dashboard", href: "/admin/dashboard", icon: "📈", status: "activo" },
  {
    key: "leads87",
    label: APP_SUITE_CONFIG.modules.leads.name,
    href: APP_SUITE_CONFIG.modules.leads.href,
    icon: "🎯",
    status: APP_SUITE_CONFIG.modules.leads.enabled ? "activo" : "en_preparacion",
  },
  { key: "entidades", label: "Iniciativas", href: "/admin/empresas", icon: "🏢", status: "activo" },
  { key: "socios", label: "Clientes", href: "/admin/socios", icon: "👥", status: "activo" },
  { key: "agenda", label: "Agenda", href: "/admin/agenda", icon: "📅", status: "activo" },
  { key: "reportes", label: "Reportes", href: "/admin/reportes", icon: "📊", status: "activo" },
  { key: "ia", label: "IA", href: "/admin/ia", icon: "🧠", status: "activo" },
  { key: "mesa_ayuda", label: "Mesa de ayuda", href: "/admin/mesa-de-ayuda", icon: "🆘", status: "activo" },
  {
    key: "neuroventas",
    label: "Manual de neuroventas",
    href: "/admin/neuroventas",
    icon: "📘",
    status: "activo",
    navGroup: "footer",
  },
  {
    key: "personalizacion",
    label: "Personalización",
    href: "/admin/personalizacion",
    icon: "🎨",
    status: "activo",
    navGroup: "footer",
  },
  {
    key: "configuracion",
    label: "Configuración",
    href: "/admin/configuracion",
    icon: "🛠️",
    status: "activo",
    navGroup: "footer",
  },
];

const ALLOWED_KEYS = new Set(DEFAULT_ADMIN_SIDEBAR_MODULES.map((m) => m.key));

/** No se listan aunque existan en `sidebar_modules` en DB (legado o producto no listo). */
export const HIDDEN_SIDEBAR_MODULE_KEYS = [
  "dashboard",
  "copilot",
  "oportunidades",
  "eventos",
  "reuniones",
  "operaciones",
] as const;

const HIDDEN_SIDEBAR_KEY_SET = new Set<string>(HIDDEN_SIDEBAR_MODULE_KEYS);

export function mergeAdminSidebarModules(
  persisted: SidebarModulePersisted[] | null | undefined
): AdminSidebarModule[] {
  const byKey = new Map<string, SidebarModulePersisted>();
  for (const p of persisted ?? []) {
    if (p?.key && ALLOWED_KEYS.has(p.key)) byKey.set(p.key, p);
  }
  const merged = DEFAULT_ADMIN_SIDEBAR_MODULES.map((def) => {
    const o = byKey.get(def.key);
    const status: SidebarModuleStatus =
      o?.status === "activo" || o?.status === "en_preparacion" || o?.status === "oculto"
        ? o.status
        : def.status;
    const persistedLabel =
      typeof o?.label === "string" && o.label.trim() ? o.label.trim() : "";
    const label =
      def.key === "entidades" && /^entidades$/i.test(persistedLabel)
        ? def.label
        : def.key === "leads87" && /^(leads87|LEADS87)$/i.test(persistedLabel)
          ? def.label
          : persistedLabel || def.label;
    return {
      ...def,
      label,
      icon: typeof o?.icon === "string" && o.icon.trim() ? o.icon.trim() : def.icon,
      status,
    };
  });

  const visible = merged.filter((m) => !HIDDEN_SIDEBAR_KEY_SET.has(m.key));

  if (process.env.NODE_ENV === "development") {
    console.debug("[adminSidebarModules.merge]", {
      persistedRowCount: persisted?.length ?? 0,
      leads87Persisted: byKey.get("leads87"),
      leads87Merged: visible.find((m) => m.key === "leads87"),
      allLabels: visible.map((m) => ({ key: m.key, label: m.label, status: m.status })),
    });
  }

  return visible;
}

/** Sanitiza el body PATCH: solo keys conocidas y campos acotados. */
export function sanitizeSidebarModulesForPersist(raw: unknown): SidebarModulePersisted[] {
  if (!Array.isArray(raw)) return [];
  const out: SidebarModulePersisted[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const key = typeof (x as { key?: string }).key === "string" ? (x as { key: string }).key.trim() : "";
    if (!key || !ALLOWED_KEYS.has(key) || HIDDEN_SIDEBAR_KEY_SET.has(key)) continue;
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
