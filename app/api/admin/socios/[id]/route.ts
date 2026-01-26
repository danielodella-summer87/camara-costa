import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * DELETE /api/admin/socios/:id
 * Elimina un socio y devuelve el lead asociado a "Nuevo"
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = typeof rawId === "string" ? rawId.trim() : null;
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // 1. Obtener el socio para leer lead_id antes de borrarlo
    const { data: socio, error: socioErr } = await sb
      .from("socios")
      .select("id, lead_id")
      .eq("id", id)
      .maybeSingle();

    if (socioErr) {
      return NextResponse.json(
        { data: null, error: `Error leyendo socio: ${socioErr.message}` } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    if (!socio) {
      return NextResponse.json({ data: null, error: "Socio no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const leadId = socio.lead_id;

    // 2. Borrar el socio
    const { error: deleteErr } = await sb.from("socios").delete().eq("id", id);

    if (deleteErr) {
      return NextResponse.json(
        { data: null, error: `Error eliminando socio: ${deleteErr.message}` } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    // 3. Si hay lead_id, actualizar el lead: pipeline='Nuevo', is_member=false
    if (leadId) {
      const { error: updateErr } = await sb
        .from("leads")
        .update({
          pipeline: "Nuevo",
          is_member: false,
          member_since: null,
        })
        .eq("id", leadId);

      if (updateErr) {
        // Log el error pero no fallar (el socio ya se borró)
        console.error(`[DELETE socio] Error actualizando lead ${leadId}:`, updateErr);
        return NextResponse.json(
          {
            data: { deleted: true, lead_id: leadId, lead_updated: false },
            error: null,
            warning: `Socio eliminado, pero error actualizando lead: ${updateErr.message}`,
          } satisfies ApiResp<any> & { warning?: string },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      { data: { deleted: true, lead_id: leadId ?? null, lead_updated: !!leadId } } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}
