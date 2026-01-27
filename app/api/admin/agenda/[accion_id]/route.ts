import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ accion_id: string }> | { accion_id: string } }
) {
  try {
    const supabase = supabaseAdmin();
    const resolvedParams = await Promise.resolve(params);
    const accionId = resolvedParams.accion_id;

    if (!accionId) throw new Error("Falta accion_id");

    const { error } = await supabase.from("socio_acciones").delete().eq("id", accionId);

    if (error) {
      console.error("[Agenda][DELETE] supabase error:", error);
      throw new Error(error.message);
    }

    return NextResponse.json({ data: true, error: null }, { status: 200 });
  } catch (e: any) {
    console.error("[Agenda][DELETE] Error:", e);
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error borrando actividad" },
      { status: 500 }
    );
  }
}
