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
  | { params: { id: string; accion_id: string } }
  | { params: Promise<{ id: string; accion_id: string }> };

/**
 * PATCH /api/admin/socios/[id]/acciones/[accion_id]
 * Marca una acción como ejecutada (actualiza realizada_at si no estaba)
 */
export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const params = await Promise.resolve((ctx as any).params);
  const socioIdRaw = params?.id ? String(params.id) : "";
  const accionIdRaw = params?.accion_id ? String(params.accion_id) : "";

  if (!socioIdRaw || !accionIdRaw) {
    return NextResponse.json(
      { data: null, error: "Missing socio id or accion id" } satisfies ApiResp<null>,
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  // Si realizada_at no está seteada, setearla a now()
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("socio_acciones")
    .update({
      realizada_at: now,
    })
    .eq("id", accionIdRaw)
    .eq("socio_id", socioIdRaw)
    .select("id,socio_id,lead_id,tipo,nota,fecha_limite,realizada_at,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message } satisfies ApiResp<null>,
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { data: null, error: "Acción no encontrada" } satisfies ApiResp<null>,
      { status: 404 }
    );
  }

  return NextResponse.json({ data, error: null } satisfies ApiResp<any>);
}
