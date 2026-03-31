import type { AgencyLineSnapshot } from "@/lib/agencyServices/catalog";
import type { BuildProposalPayloadService } from "@/lib/leads/proposalExportPayload";

/** Fila API / UI detalle lead (incluye snapshot agencia). */
export type MappedLeadServiceProposalRow = BuildProposalPayloadService & {
  lead_id: string;
  origen: string | null;
  orden: number | null;
  agency_snapshot: AgencyLineSnapshot | null;
};

export const LEAD_SERVICE_PROPOSALS_LIST_SELECT =
  "id,lead_id,service_id,agency_service_id,mes,precio,moneda,alcance_editado,observaciones,origen,orden,proposal_line_snapshot,easy_services(codigo,nombre,billing_type),agency_services(name,unit,category,category_id,description,price_base,currency,default_quantity,agency_service_categories(name))";

function buildFallbackAgencySnapshot(
  agencyServiceId: string,
  agency: {
    name?: string;
    unit?: string;
    price_base?: number | null;
    currency?: string | null;
  } | null,
  precio: unknown,
  moneda: unknown
): AgencyLineSnapshot {
  const p = Number(precio ?? 0);
  const up = Number.isFinite(p) ? p : Number(agency?.price_base ?? 0);
  return {
    service_id: agencyServiceId,
    name_snapshot: agency?.name ?? "",
    unit_price: up,
    quantity: 1,
    total_price: up,
    unit: agency?.unit ?? "hour",
    currency: String(moneda ?? agency?.currency ?? "USD"),
    notes: "",
  };
}

/** Normaliza filas de Supabase para export y APIs. */
export function mapLeadServiceProposalRows(rows: unknown[] | null | undefined): MappedLeadServiceProposalRow[] {
  return (rows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const easy = r.easy_services as { codigo?: string; nombre?: string; billing_type?: string } | null;
    const agency = r.agency_services as {
      name?: string;
      unit?: string;
      category?: string | null;
      category_id?: string | null;
      agency_service_categories?: { name?: string | null } | null;
      description?: string | null;
      price_base?: number | null;
      currency?: string | null;
      default_quantity?: number | null;
    } | null;
    const snapRaw = r.proposal_line_snapshot;
    let agency_snapshot: AgencyLineSnapshot | null = null;
    if (snapRaw && typeof snapRaw === "object") {
      const o = snapRaw as Record<string, unknown>;
      agency_snapshot = {
        service_id: String(o.service_id ?? r.agency_service_id ?? ""),
        name_snapshot: String(o.name_snapshot ?? agency?.name ?? ""),
        unit_price: Number(o.unit_price ?? 0),
        quantity: Number(o.quantity ?? 1),
        total_price: Number(o.total_price ?? 0),
        unit: String(o.unit ?? agency?.unit ?? "hour"),
        currency: String(o.currency ?? r.moneda ?? "USD"),
        notes: typeof o.notes === "string" ? o.notes : "",
      };
      if (!Number.isFinite(agency_snapshot.quantity) || agency_snapshot.quantity <= 0) agency_snapshot.quantity = 1;
      if (!Number.isFinite(agency_snapshot.unit_price)) agency_snapshot.unit_price = 0;
      if (!Number.isFinite(agency_snapshot.total_price)) {
        agency_snapshot.total_price = agency_snapshot.unit_price * agency_snapshot.quantity;
      }
    } else if (agency && r.agency_service_id) {
      agency_snapshot = buildFallbackAgencySnapshot(String(r.agency_service_id), agency, r.precio, r.moneda);
    }

    const isAgency = Boolean(r.agency_service_id);
    const billingFromAgency = agency?.unit
      ? String(agency.unit).toLowerCase() === "monthly"
        ? "monthly"
        : "one_time"
      : null;

    return {
      id: String(r.id),
      lead_id: String(r.lead_id),
      service_id: (r.service_id as string | null) ?? null,
      agency_service_id: (r.agency_service_id as string | null) ?? null,
      mes: r.mes as number,
      precio: r.precio as number | null,
      moneda: r.moneda as string | null,
      alcance_editado: r.alcance_editado as string | null,
      observaciones: r.observaciones as string | null,
      origen: (r.origen as string | null) ?? null,
      orden: (r.orden as number | null) ?? null,
      agency_snapshot,
      codigo: isAgency ? null : easy?.codigo ?? null,
      nombre: isAgency ? agency_snapshot?.name_snapshot ?? agency?.name ?? null : easy?.nombre ?? null,
      billing_type: isAgency ? billingFromAgency : easy?.billing_type ?? null,
    };
  });
}
