import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import type { AgencyLineSnapshot } from "@/lib/agencyServices/catalog";
import { LEAD_SERVICE_PROPOSALS_LIST_SELECT, mapLeadServiceProposalRows } from "@/lib/leads/mapLeadServiceProposalRows";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function buildSnapshotFromAgencyRow(row: {
  id: string;
  name: string;
  price_base: number | string | null;
  currency: string | null;
  unit: string;
  default_quantity: number | string | null;
}): AgencyLineSnapshot {
  const unitPrice = Number(row.price_base ?? 0);
  const qty = Number(row.default_quantity ?? 1);
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const up = Number.isFinite(unitPrice) ? unitPrice : 0;
  return {
    service_id: row.id,
    name_snapshot: row.name,
    unit_price: up,
    quantity: safeQty,
    total_price: up * safeQty,
    unit: row.unit,
    currency: row.currency?.trim() || "USD",
    notes: "",
  };
}

/**
 * GET /api/admin/leads/[id]/services
 * Servicios propuestos para el lead (easy_services y/o agency_services).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId } = await context.params;
    const id = safeId(leadId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: rows, error } = await sb
      .from("lead_service_proposals")
      .select(LEAD_SERVICE_PROPOSALS_LIST_SELECT)
      .eq("lead_id", id)
      .order("mes", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const services = mapLeadServiceProposalRows(rows);

    return NextResponse.json({ ok: true, services });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/leads/[id]/services
 * Agregar servicio: easy (service_id) o catálogo agencia (agency_service_id).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId } = await context.params;
    const id = safeId(leadId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({})) as {
      service_id?: string | null;
      agency_service_id?: string | null;
      mes?: number | null;
      precio?: number | null;
      alcance_editado?: string | null;
      observaciones?: string | null;
      unit_price?: number | null;
      quantity?: number | null;
      notes?: string | null;
    };

    const easyId = typeof body?.service_id === "string" ? body.service_id.trim() : null;
    const agencyId = typeof body?.agency_service_id === "string" ? body.agency_service_id.trim() : null;

    if (easyId && agencyId) {
      return NextResponse.json(
        { ok: false, error: "Enviá solo service_id (EASY) o agency_service_id, no ambos" },
        { status: 400 }
      );
    }
    if (!easyId && !agencyId) {
      return NextResponse.json(
        { ok: false, error: "service_id o agency_service_id es requerido" },
        { status: 400 }
      );
    }

    const mes = typeof body?.mes === "number" ? body.mes : Number(body?.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 24) {
      return NextResponse.json({ ok: false, error: "mes debe ser entre 1 y 24" }, { status: 400 });
    }

    const alcanceEditado = typeof body?.alcance_editado === "string" ? body.alcance_editado.trim() || null : null;
    const observaciones = typeof body?.observaciones === "string" ? body.observaciones.trim() || null : null;

    const sb = supabaseAdmin();

    if (agencyId) {
      const { data: arow, error: aErr } = await sb
        .from("agency_services")
        .select("id,name,price_base,currency,unit,default_quantity,is_active")
        .eq("id", agencyId)
        .eq("is_active", true)
        .maybeSingle();

      if (aErr || !arow) {
        return NextResponse.json(
          { ok: false, error: aErr?.message ?? "Servicio de agencia no encontrado o inactivo" },
          { status: 400 }
        );
      }

      let snapshot = buildSnapshotFromAgencyRow(arow);
      if (body.unit_price != null && Number.isFinite(Number(body.unit_price))) {
        snapshot = { ...snapshot, unit_price: Number(body.unit_price) };
      }
      if (body.quantity != null && Number.isFinite(Number(body.quantity)) && Number(body.quantity) > 0) {
        snapshot = { ...snapshot, quantity: Number(body.quantity) };
      }
      snapshot.total_price = snapshot.unit_price * snapshot.quantity;
      if (typeof body.notes === "string") {
        snapshot = { ...snapshot, notes: body.notes };
      }

      const precioOverride = body.precio != null ? Number(body.precio) : null;
      const precioFinal = precioOverride != null && Number.isFinite(precioOverride) ? precioOverride : snapshot.total_price;

      const { data: row, error } = await sb
        .from("lead_service_proposals")
        .insert({
          lead_id: id,
          service_id: null,
          agency_service_id: agencyId,
          mes,
          precio: precioFinal,
          moneda: snapshot.currency,
          alcance_editado: alcanceEditado,
          observaciones,
          origen: "manual",
          proposal_line_snapshot: snapshot,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, proposal: row, agency_snapshot: snapshot });
    }

    const precio = typeof body?.precio === "number" ? body.precio : body?.precio != null ? Number(body.precio) : null;

    const { data: row, error } = await sb
      .from("lead_service_proposals")
      .insert({
        lead_id: id,
        service_id: easyId,
        mes,
        precio: precio ?? null,
        alcance_editado: alcanceEditado,
        observaciones,
        origen: "manual",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, proposal: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
