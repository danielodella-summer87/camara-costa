import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

/**
 * GET /api/admin/leads/[id]/acciones
 * Lista acciones del lead ordenadas por fecha_limite asc (y luego created_at desc como fallback)
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await Promise.resolve((ctx as any).params);
  const leadIdRaw = params?.id ? String(params.id) : "";
  const leadId = leadIdRaw ? decodeURIComponent(leadIdRaw) : "";

  if (!leadId) {
    return NextResponse.json(
      { data: [], error: "Missing lead id" } satisfies ApiResp<any[]>,
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("socio_acciones")
    .select("id,socio_id,lead_id,tipo,nota,fecha_limite,realizada_at,created_at")
    .eq("lead_id", leadId)
    .order("fecha_limite", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { data: [], error: error.message } satisfies ApiResp<any[]>,
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [], error: null } satisfies ApiResp<any[]>);
}

/**
 * POST /api/admin/leads/[id]/acciones
 * Crea una nueva acción planificada para el lead
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await Promise.resolve((ctx as any).params);
  const leadIdRaw = params?.id ? String(params.id) : "";
  const leadId = leadIdRaw ? decodeURIComponent(leadIdRaw) : "";

  if (!leadId) {
    return NextResponse.json(
      { data: null, error: "Missing lead id" } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { tipo, nota, fecha_limite } = body;

  // Validación: NO permitir que se intente setear socio_id en acciones de lead
  if (body.socio_id !== undefined && body.socio_id !== null) {
    return NextResponse.json(
      { data: null, error: "No se puede setear socio_id en acciones de lead. Las acciones de lead deben tener socio_id=null." } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  // Validación: NO permitir que se intente setear lead_id diferente al del params
  if (body.lead_id !== undefined && body.lead_id !== leadId) {
    return NextResponse.json(
      { data: null, error: "No se puede setear lead_id diferente al del parámetro de la URL." } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  // Validaciones
  if (!tipo || typeof tipo !== "string") {
    return NextResponse.json(
      { data: null, error: "tipo es requerido (string)" } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  // fecha_limite es opcional, si no viene usar CURRENT_DATE como default
  let fechaLimiteValue: string;
  if (!fecha_limite || typeof fecha_limite !== "string" || !fecha_limite.trim()) {
    // Si no viene, usar hoy como default
    fechaLimiteValue = new Date().toISOString().split("T")[0];
  } else {
    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha_limite.trim())) {
      return NextResponse.json(
        { data: null, error: "fecha_limite debe tener formato YYYY-MM-DD" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }
    fechaLimiteValue = fecha_limite.trim();
  }

  const supabase = supabaseAdmin();

  // Normalizar nota: nunca null, siempre string (vacío si no hay valor)
  const notaNormalizada = nota ? String(nota).trim() : "";

  // Asegurar que lead_id nunca sea undefined antes de construir el payload
  // (Ya validado arriba, pero doble verificación para seguridad)
  if (!leadId || leadId.trim().length === 0) {
    return NextResponse.json(
      { data: null, error: "lead_id es requerido y no puede ser undefined o vacío" } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  // Payload de inserción: socio_id SIEMPRE null, lead_id SIEMPRE del params
  // Tipo explícito para garantizar que lead_id nunca sea undefined
  // IMPORTANTE: realizada_at debe ser NULL al crear (pendiente), no se setea hasta que se marca como ejecutada
  const insertData: {
    lead_id: string;
    socio_id: null;
    tipo: string;
    nota: string;
    fecha_limite: string;
    realizada_at: null;
  } = {
    lead_id: leadId, // SIEMPRE usar el id del params, nunca undefined
    socio_id: null, // SIEMPRE null para acciones de lead
    tipo: tipo.trim(),
    nota: notaNormalizada,
    fecha_limite: fechaLimiteValue, // Usar fecha_limite como deadline real
    realizada_at: null, // EXPLÍCITAMENTE NULL al crear (pendiente)
  };

  // Log temporal del payload antes del insert
  console.log(`[POST /api/admin/leads/${leadId}/acciones] Payload antes del insert:`, JSON.stringify(insertData, null, 2));
  console.log(`[POST /api/admin/leads/${leadId}/acciones] Verificando lead_id:`, insertData.lead_id, typeof insertData.lead_id);
  console.log(`[POST /api/admin/leads/${leadId}/acciones] Verificando socio_id:`, insertData.socio_id);

  const { data, error } = await supabase
    .from("socio_acciones")
    .insert(insertData)
    .select("id,socio_id,lead_id,tipo,nota,fecha_limite,realizada_at,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message } satisfies ApiResp<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null } satisfies ApiResp<any>);
}
