/** Línea de costo interno por rol (horas × tarifa horaria del rol). */
export type InternalCostBreakdownLine = {
  agency_role_id: string;
  role_name: string;
  hours: number;
  hourly_rate: number;
  line_cost: number;
};

function normalizeEmbed<T extends { name?: string | null; hourly_rate?: unknown; id?: string }>(
  embed: T | T[] | null | undefined
): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

export function computeLineFromEffortProfileRow(row: {
  hours?: number | string | null;
  estimated_hours?: number | string | null;
  agency_role_id?: string | null;
  agency_roles?: { name?: string | null; hourly_rate?: number | string | null; id?: string } | null | unknown[];
}): InternalCostBreakdownLine {
  const raw = row.hours ?? row.estimated_hours;
  const hours = raw != null && raw !== "" ? Number(raw) : 0;
  const safeHours = Number.isFinite(hours) && hours >= 0 ? hours : 0;
  const r = normalizeEmbed(row.agency_roles as { name?: string | null; hourly_rate?: number | string | null; id?: string });
  const hourly_rate = r?.hourly_rate != null && r.hourly_rate !== "" ? Number(r.hourly_rate) : 0;
  const safeRate = Number.isFinite(hourly_rate) && hourly_rate >= 0 ? hourly_rate : 0;
  const role_name = typeof r?.name === "string" && r.name.trim() ? r.name.trim() : "—";
  const agency_role_id = String(row.agency_role_id ?? r?.id ?? "");
  return {
    agency_role_id,
    role_name,
    hours: safeHours,
    hourly_rate: safeRate,
    line_cost: safeHours * safeRate,
  };
}

export function sumInternalCost(breakdown: InternalCostBreakdownLine[]): number {
  return breakdown.reduce((acc, b) => acc + b.line_cost, 0);
}

export function marginVsPriceBase(priceBase: number | null | undefined, internalTotal: number): {
  margin_amount: number;
  margin_percent: number | null;
} {
  const pb = priceBase != null && Number.isFinite(Number(priceBase)) ? Number(priceBase) : 0;
  const margin_amount = pb - internalTotal;
  const margin_percent = pb > 0 ? (margin_amount / pb) * 100 : null;
  return { margin_amount, margin_percent };
}
