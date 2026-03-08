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
 * GET /api/admin/leads/[id]/services
 * Servicios propuestos para el lead (join con easy_services).
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
      .select(
        "id,lead_id,service_id,mes,precio,moneda,alcance_editado,observaciones,origen,orden,easy_services(codigo,nombre,billing_type)"
      )
      .eq("lead_id", id)
      .order("mes", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const services = (rows ?? []).map((r: any) => ({
      id: r.id,
      lead_id: r.lead_id,
      service_id: r.service_id,
      mes: r.mes,
      precio: r.precio,
      moneda: r.moneda,
      alcance_editado: r.alcance_editado,
      observaciones: r.observaciones,
      origen: r.origen,
      orden: r.orden,
      codigo: r.easy_services?.codigo ?? null,
      nombre: r.easy_services?.nombre ?? null,
      billing_type: r.easy_services?.billing_type ?? null,
    }));

    return NextResponse.json({ ok: true, services });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/leads/[id]/services
 * Agregar un servicio a la propuesta del lead.
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
      mes?: number | null;
      precio?: number | null;
      alcance_editado?: string | null;
      observaciones?: string | null;
    };

    const serviceId = typeof body?.service_id === "string" ? body.service_id.trim() : null;
    if (!serviceId) {
      return NextResponse.json({ ok: false, error: "service_id es requerido" }, { status: 400 });
    }

    const mes = typeof body?.mes === "number" ? body.mes : Number(body?.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 24) {
      return NextResponse.json({ ok: false, error: "mes debe ser entre 1 y 24" }, { status: 400 });
    }

    const precio = typeof body?.precio === "number" ? body.precio : (body?.precio != null ? Number(body.precio) : null);
    const alcanceEditado = typeof body?.alcance_editado === "string" ? body.alcance_editado.trim() || null : null;
    const observaciones = typeof body?.observaciones === "string" ? body.observaciones.trim() || null : null;

    const sb = supabaseAdmin();
    const { data: row, error } = await sb
      .from("lead_service_proposals")
      .insert({
        lead_id: id,
        service_id: serviceId,
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
