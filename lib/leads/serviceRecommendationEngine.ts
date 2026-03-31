/**
 * Motor de recomendación de servicios del catálogo agencia (solo IDs existentes).
 */

export type CatalogRoleLine = {
  role_code: string;
  role_name: string;
  hourly_rate: number;
  default_hours: number;
};

export type CatalogServiceForRecommendation = {
  service_code: string;
  name: string;
  description: string | null;
  category: string | null;
  price_base: number;
  currency: string;
  unit: string;
  default_quantity: number;
  roles: CatalogRoleLine[];
};

export type ServiceRecommendationRaw = {
  service_code: string;
  priority: number;
  quantity: number;
  reason: string;
  adjusted_role_hours: Array<{ role_code: string; hours: number; role_name?: string }>;
  suggested_client_note: string;
  suggested_ad_spend: number | null;
};

function normalizeEmbed<T extends { id?: string; name?: string | null; hourly_rate?: unknown }>(
  embed: T | T[] | null | undefined
): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

export function mergeAgencyCatalog(
  services: Array<{
    id: string;
    name: string;
    description?: string | null;
    price_base?: unknown;
    currency?: string | null;
    unit?: string;
    default_quantity?: unknown;
    agency_service_categories?: { name?: string | null } | { name?: string | null }[] | null;
  }>,
  effortRows: Array<{
    agency_service_id: string;
    hours?: unknown;
    estimated_hours?: unknown;
    agency_role_id?: string | null;
    agency_roles?: { id?: string; name?: string | null; hourly_rate?: unknown } | unknown[] | null;
  }>
): CatalogServiceForRecommendation[] {
  const byService = new Map<string, CatalogRoleLine[]>();
  for (const row of effortRows) {
    const sid = String(row.agency_service_id ?? "");
    if (!sid) continue;
    const r = normalizeEmbed(row.agency_roles as { id?: string; name?: string | null; hourly_rate?: unknown });
    const role_code = String(row.agency_role_id ?? r?.id ?? "");
    if (!role_code) continue;
    const rawH = row.estimated_hours ?? row.hours;
    const hours = rawH != null && rawH !== "" ? Number(rawH) : 0;
    const line: CatalogRoleLine = {
      role_code,
      role_name: typeof r?.name === "string" ? r.name : "—",
      hourly_rate: r?.hourly_rate != null ? Number(r.hourly_rate) : 0,
      default_hours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
    };
    if (!byService.has(sid)) byService.set(sid, []);
    byService.get(sid)!.push(line);
  }

  return services.map((s) => {
    const emb = s.agency_service_categories;
    const row = Array.isArray(emb) ? emb[0] : emb;
    const category = typeof row?.name === "string" && row.name.trim() ? row.name.trim() : null;
    const price_base = s.price_base != null ? Number(s.price_base) : 0;
    const dq = s.default_quantity != null ? Number(s.default_quantity) : 1;
    return {
      service_code: s.id,
      name: s.name,
      description: s.description ?? null,
      category,
      price_base: Number.isFinite(price_base) ? price_base : 0,
      currency: (s.currency?.trim() || "USD").toUpperCase(),
      unit: String(s.unit ?? "hour"),
      default_quantity: Number.isFinite(dq) && dq > 0 ? dq : 1,
      roles: byService.get(s.id) ?? [],
    };
  });
}

export function validateRecommendations(
  raw: ServiceRecommendationRaw[],
  catalog: CatalogServiceForRecommendation[]
): { items: ServiceRecommendationRaw[]; dropped: string[] } {
  const allowed = new Map(catalog.map((c) => [c.service_code, c]));
  const dropped: string[] = [];
  const items: ServiceRecommendationRaw[] = [];
  for (const r of raw) {
    const code = String(r.service_code ?? "").trim();
    const svc = allowed.get(code);
    if (!svc) {
      dropped.push(code || "(vacío)");
      continue;
    }
    const roleIds = new Set(svc.roles.map((x) => x.role_code));
    const adj = Array.isArray(r.adjusted_role_hours)
      ? r.adjusted_role_hours
          .filter((x) => x && roleIds.has(String(x.role_code)))
          .map((x) => {
            const rc = String(x.role_code);
            const role = svc.roles.find((rr) => rr.role_code === rc);
            return {
              role_code: rc,
              hours: Math.max(0, Number(x.hours) || 0),
              role_name: role?.role_name ?? (typeof x.role_name === "string" ? x.role_name : ""),
            };
          })
      : [];
    items.push({
      service_code: code,
      priority: Math.min(5, Math.max(1, Math.round(Number(r.priority) || 3))),
      quantity: Math.max(0.01, Number(r.quantity) || svc.default_quantity),
      reason: typeof r.reason === "string" ? r.reason.slice(0, 4000) : "",
      adjusted_role_hours: adj,
      suggested_client_note:
        typeof r.suggested_client_note === "string" ? r.suggested_client_note.slice(0, 4000) : "",
      suggested_ad_spend: (() => {
        const v = r.suggested_ad_spend as unknown;
        if (v == null) return null;
        if (typeof v === "string" && v.trim() === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(0, n) : null;
      })(),
    });
  }
  return { items, dropped };
}

export function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
