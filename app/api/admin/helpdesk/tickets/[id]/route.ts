import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE = "helpdesk_tickets";

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const supabase = createClient();
  const id = ctx?.params?.id;

  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { data: ticket, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!ticket) return NextResponse.json({ data: null }, { status: 404 });

  return NextResponse.json({ data: ticket });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const supabase = createClient();
  const id = ctx?.params?.id;

  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // ✅ aceptar aliases (UI manda status/priority/type)
    const titulo = norm(body?.titulo ?? body?.title ?? body?.subject);
    const descripcion = norm(body?.descripcion ?? body?.description ?? body?.detalle);

    const estado = norm(body?.estado ?? body?.status);
    const prioridad = norm(body?.prioridad ?? body?.priority);
    const tipo = norm(body?.tipo ?? body?.type);

    const payload: any = {};
    if (titulo) payload.titulo = titulo;
    if (descripcion) payload.descripcion = descripcion;
    if (estado) payload.estado = estado;
    if (prioridad) payload.prioridad = prioridad;
    if (tipo) payload.tipo = tipo;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select("*"); // ✅ sin single

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NextResponse.json({ data: null }, { status: 404 });

    return NextResponse.json({ data: row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error actualizando ticket" }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const supabase = createClient();
  const id = ctx?.params?.id;

  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
