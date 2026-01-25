import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/socios
 * 
 * Obtiene la lista de socios con join a empresas
 */
export async function GET() {
  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("socios")
      .select("id, codigo, plan, estado, fecha_alta, proxima_accion, empresa_id, empresas:empresa_id(id,nombre)")
      .order("fecha_alta", { ascending: false });

    if (error) {
      console.error("Error consultando socios:", error);
      return NextResponse.json(
        { error: error.message ?? "Error cargando socios" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data ?? [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("Error inesperado en GET /api/admin/socios:", e);
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
