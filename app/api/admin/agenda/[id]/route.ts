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

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error desconocido";
  }
}

/**
 * PATCH /api/admin/agenda/:id
 * Actualiza una actividad (socio_acciones) por id
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin();
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta id" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const tipo = body?.tipo ? String(body.tipo).trim() : undefined;
    const fechaLimiteRaw = body?.fecha_limite ? String(body.fecha_limite).trim() : undefined;
    const horaRaw = body?.hora != null ? String(body.hora).trim() : undefined;
    const nota = body?.nota !== undefined ? (body.nota ? String(body.nota) : null) : undefined;
    const lugar = body?.lugar !== undefined ? (body.lugar ? String(body.lugar) : null) : undefined;
    const comercialId = body?.comercial_id !== undefined ? (body.comercial_id ? String(body.comercial_id) : null) : undefined;
    const invitedUserIds =
      body?.invited_user_ids !== undefined
        ? Array.isArray(body.invited_user_ids)
          ? (body.invited_user_ids as string[]).filter((id): id is string => typeof id === "string" && id.trim() !== "")
          : []
        : undefined;

    // Validar fecha_limite si viene
    if (fechaLimiteRaw !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fechaLimiteRaw)) {
        return NextResponse.json(
          { data: null, error: "fecha_limite debe tener formato YYYY-MM-DD" } satisfies ApiResp<null>,
          { status: 400 }
        );
      }
    }

    // Validar hora si viene
    let hora: string | undefined = undefined;
    if (horaRaw !== undefined) {
      const horaRegex = /^\d{2}:\d{2}$/;
      hora = horaRegex.test(horaRaw) ? horaRaw : "00:00";
    }

    // Construir payload solo con campos que vienen
    const updatePayload: Record<string, unknown> = {};
    if (tipo !== undefined) updatePayload.tipo = tipo;
    if (fechaLimiteRaw !== undefined) updatePayload.fecha_limite = fechaLimiteRaw;
    if (hora !== undefined) updatePayload.hora = hora;
    if (nota !== undefined) updatePayload.nota = nota;
    if (lugar !== undefined) updatePayload.lugar = lugar;
    if (comercialId !== undefined) updatePayload.comercial_id = comercialId;
    if (invitedUserIds !== undefined) updatePayload.invited_user_ids = invitedUserIds;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { data: null, error: "No hay campos para actualizar" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("socio_acciones")
      .update(updatePayload)
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      console.error("[Agenda][PATCH] supabase error:", error);
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "Actividad no encontrada" } satisfies ApiResp<null>,
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: { id: String(data.id) }, error: null } satisfies ApiResp<{ id: string }>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    console.error("[Agenda][PATCH] Error:", e);
    return NextResponse.json(
      { data: null, error: toErrorMessage(e) } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/admin/agenda/:id
 * Borra una actividad (socio_acciones) por id
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta id" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const { error } = await supabase.from("socio_acciones").delete().eq("id", id);

    if (error) {
      console.error("[Agenda][DELETE] supabase error:", error);
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: { ok: true }, error: null } satisfies ApiResp<{ ok: true }>,
      { status: 200 }
    );
  } catch (e: unknown) {
    console.error("[Agenda][DELETE] Error:", e);
    return NextResponse.json(
      { data: null, error: toErrorMessage(e) } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
