import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const TABLE = "helpdesk_tickets";

async function getParamId(ctx: any) {
  const p = ctx?.params;
  const params = typeof p?.then === "function" ? await p : p;
  const id = params?.id;
  return typeof id === "string" ? id : null;
}

export async function GET(req: Request, ctx: any) {
  const supabase = await createServerSupabase();
  const id = await getParamId(ctx);

  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ticket = Array.isArray(data) ? data[0] : data;
  if (!ticket) return NextResponse.json({ data: null }, { status: 404 });

  return NextResponse.json({ data: { ticket } });
}

export async function PATCH(req: Request, ctx: any) {
  const supabase = await createServerSupabase();
  const id = await getParamId(ctx);

  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();

    // ✅ aceptar ambos nombres (UI manda status/priority/type)
    const status = body?.status ?? body?.estado;
    const priority = body?.priority ?? body?.prioridad;
    const type = body?.type ?? body?.tipo;

    const payload: Record<string, any> = {};
    if (status != null && String(status).trim().length) payload.status = status;
    if (priority != null && String(priority).trim().length) payload.priority = priority;
    if (type != null && String(type).trim().length) payload.type = type;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const ticket = Array.isArray(data) ? data[0] : data;
    if (!ticket) return NextResponse.json({ data: null }, { status: 404 });

    return NextResponse.json({ data: { ticket } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error actualizando ticket" }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: any) {
  const supabase = await createServerSupabase();
  const id = await getParamId(ctx);

  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
