export const AGENCY_SERVICE_UNITS = ["hour", "monthly", "project", "one_time"] as const;
export type AgencyServiceUnit = (typeof AGENCY_SERVICE_UNITS)[number];

export const AGENCY_SERVICE_CURRENCIES = ["USD", "UYU"] as const;
export type AgencyServiceCurrency = (typeof AGENCY_SERVICE_CURRENCIES)[number];

export type AgencyLineSnapshot = {
  service_id: string;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  unit: string;
  currency: string;
  notes: string;
};

/** billing_type de easy_services / fases: monthly vs resto → one_time */
export function agencyUnitToBillingType(unit: string | null | undefined): "monthly" | "one_time" {
  return String(unit ?? "").toLowerCase() === "monthly" ? "monthly" : "one_time";
}

export function unitLabelEs(unit: string | null | undefined): string {
  const u = String(unit ?? "").toLowerCase();
  if (u === "hour") return "hora";
  if (u === "monthly") return "mensual";
  if (u === "project") return "proyecto";
  if (u === "one_time") return "único";
  return unit ?? "—";
}

export function parseAgencyLineSnapshot(raw: unknown): AgencyLineSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const serviceId = typeof o.service_id === "string" ? o.service_id.trim() : "";
  if (!serviceId) return null;
  const name = typeof o.name_snapshot === "string" ? o.name_snapshot : "";
  const unitPrice = Number(o.unit_price);
  const quantity = Number(o.quantity);
  const totalPrice = Number(o.total_price);
  const unit = typeof o.unit === "string" ? o.unit : "hour";
  const currency = typeof o.currency === "string" ? o.currency : "USD";
  const notes = typeof o.notes === "string" ? o.notes : "";
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity) || quantity <= 0) return null;
  const total = Number.isFinite(totalPrice) ? totalPrice : unitPrice * quantity;
  return {
    service_id: serviceId,
    name_snapshot: name,
    unit_price: unitPrice,
    quantity,
    total_price: total,
    unit,
    currency,
    notes,
  };
}
