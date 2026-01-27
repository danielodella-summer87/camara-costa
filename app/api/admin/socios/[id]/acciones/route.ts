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
 * GET /api/admin/socios/[id]/acciones
 * Lista acciones del socio ordenadas por fecha_limite asc (y luego created_at desc como fallback)
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await Promise.resolve((ctx as any).params);
  const socioIdRaw = params?.id ? String(params.id) : "";
  const socioId = socioIdRaw ? decodeURIComponent(socioIdRaw) : "";

  if (!socioId) {
    return NextResponse.json(
      { data: [], error: "Missing socio id" } satisfies ApiResp<any[]>,
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("socio_acciones")
    .select("id,socio_id,lead_id,tipo,nota,fecha_limite,realizada_at,created_at")
    .eq("socio_id", socioId)
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
 * POST /api/admin/socios/[id]/acciones
 * Crea una nueva acción planificada
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await Promise.resolve((ctx as any).params);
  const socioIdRaw = params?.id ? String(params.id) : "";
  const socioId = socioIdRaw ? decodeURIComponent(socioIdRaw) : "";

  if (!socioId) {
    return NextResponse.json(
      { data: null, error: "Missing socio id" } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { tipo, nota, fecha_limite } = body;

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

  // IMPORTANTE: realizada_at debe ser NULL al crear (pendiente), no se setea hasta que se marca como ejecutada
  const insertData = {
    socio_id: socioId,
    lead_id: null, // Acción de socio, no de lead
    tipo: tipo.trim(),
    nota: notaNormalizada,
    fecha_limite: fechaLimiteValue, // Usar fecha_limite como deadline real
    realizada_at: null, // EXPLÍCITAMENTE NULL al crear (pendiente)
  };

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
