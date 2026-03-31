import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

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

/**
 * PATCH /api/admin/leads/[id]/services/[proposalId]
 * Actualiza una propuesta de servicio del lead.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId, proposalId } = await context.params;
    const id = safeId(leadId);
    const pId = safeId(proposalId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id (lead) requerido" }, { status: 400 });
    }
    if (!pId) {
      return NextResponse.json({ ok: false, error: "proposalId requerido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      mes?: number | null;
      precio?: number | null;
      alcance_editado?: string | null;
      observaciones?: string | null;
      agency_snapshot?: {
        service_id?: string;
        name_snapshot?: string;
        unit_price?: number;
        quantity?: number;
        total_price?: number;
        unit?: string;
        currency?: string;
        notes?: string;
      } | null;
    };

    const mes = typeof body?.mes === "number" ? body.mes : Number(body?.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 24) {
      return NextResponse.json({ ok: false, error: "mes debe ser un entero entre 1 y 24" }, { status: 400 });
    }

    let precio = body?.precio != null ? Number(body.precio) : null;
    const alcanceEditado = typeof body?.alcance_editado === "string" ? body.alcance_editado.trim() || null : null;
    const observaciones = typeof body?.observaciones === "string" ? body.observaciones.trim() || null : null;

    const sb = supabaseAdmin();

    const { data: existing, error: findErr } = await sb
      .from("lead_service_proposals")
      .select("id,agency_service_id,proposal_line_snapshot")
      .eq("id", pId)
      .eq("lead_id", id)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Propuesta no encontrada" }, { status: 404 });
    }

    let proposalLineSnapshot: Record<string, unknown> | null = null;
    const agencyId = existing.agency_service_id as string | null;
    if (agencyId && body.agency_snapshot && typeof body.agency_snapshot === "object") {
      const a = body.agency_snapshot;
      const unitPrice = Number(a.unit_price);
      const quantity = Number(a.quantity);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ ok: false, error: "unit_price inválido" }, { status: 400 });
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ ok: false, error: "quantity debe ser > 0" }, { status: 400 });
      }
      const total = Number.isFinite(Number(a.total_price)) ? Number(a.total_price) : unitPrice * quantity;
      proposalLineSnapshot = {
        service_id: String(a.service_id ?? agencyId),
        name_snapshot: typeof a.name_snapshot === "string" ? a.name_snapshot : "",
        unit_price: unitPrice,
        quantity,
        total_price: total,
        unit: typeof a.unit === "string" ? a.unit : "hour",
        currency: typeof a.currency === "string" ? a.currency : "USD",
        notes: typeof a.notes === "string" ? a.notes : "",
      };
      precio = total;
    }

    const { data: row, error: updateErr } = await sb
      .from("lead_service_proposals")
      .update({
        mes,
        precio: precio ?? null,
        alcance_editado: alcanceEditado,
        observaciones,
        ...(proposalLineSnapshot ? { proposal_line_snapshot: proposalLineSnapshot, moneda: String(proposalLineSnapshot.currency) } : {}),
      })
      .eq("id", pId)
      .eq("lead_id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, proposal: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/leads/[id]/services/[proposalId]
 * Elimina una propuesta de servicio del lead.
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const user = await requirePermission(_req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId, proposalId } = await context.params;
    const id = safeId(leadId);
    const pId = safeId(proposalId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id (lead) requerido" }, { status: 400 });
    }
    if (!pId) {
      return NextResponse.json({ ok: false, error: "proposalId requerido" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const { data: existing, error: findErr } = await sb
      .from("lead_service_proposals")
      .select("id")
      .eq("id", pId)
      .eq("lead_id", id)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Propuesta no encontrada" }, { status: 404 });
    }

    const { error: deleteErr } = await sb
      .from("lead_service_proposals")
      .delete()
      .eq("id", pId)
      .eq("lead_id", id);

    if (deleteErr) {
      return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedId: pId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
