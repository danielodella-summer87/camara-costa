import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLE = "helpdesk_tickets";

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type Params = { params?: { id?: string } | Promise<{ id?: string }> };

async function getId(ctx: Params): Promise<string | null> {
  const p = ctx.params instanceof Promise ? await ctx.params : ctx.params ?? {};
  return p.id ?? null;
}

export async function GET(req: Request, ctx: Params) {
  const supabase = await createServerSupabase();
  const id = await getId(ctx);

  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // ✅ maybeSingle para evitar "Cannot coerce..."
  const { data: ticket, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!ticket) return NextResponse.json({ data: null }, { status: 404 });

  return NextResponse.json({ data: ticket });
}

export async function PATCH(req: Request, ctx: Params) {
  const supabase = await createServerSupabase();
  const id = await getId(ctx);

  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();

    const titulo = norm(body?.titulo ?? body?.title ?? body?.subject);
    const descripcion = norm(body?.descripcion ?? body?.description ?? body?.detalle);
    const tipo = norm(body?.tipo);
    const prioridad = norm(body?.prioridad);
    const estado = norm(body?.estado);

    // Mapeo a columnas del schema (title, description, type, priority, status)
    const typeMap: Record<string, string> = { mejora: "improvement", error: "bug", sugerencia: "suggestion" };
    const priorityMap: Record<string, string> = { baja: "low", media: "medium", alta: "high", critica: "critical" };

    const payload: Record<string, string | null> = {};
    if (titulo) payload.title = titulo;
    if (descripcion) payload.description = descripcion;
    if (tipo) payload.type = typeMap[tipo] ?? tipo;
    if (prioridad) payload.priority = priorityMap[prioridad] ?? prioridad;
    if (estado) payload.status = estado === "open" ? "new" : estado;

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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error actualizando ticket";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Params) {
  const supabase = await createServerSupabase();
  const id = await getId(ctx);

  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
