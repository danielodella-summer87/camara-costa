import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COMMENTS_TABLE = "helpdesk_comments";
const TICKETS_TABLE = "helpdesk_tickets";

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type Params = { params?: { id?: string } | Promise<{ id?: string }> };

async function getTicketId(ctx: Params): Promise<string | null> {
  const p = ctx.params instanceof Promise ? await ctx.params : ctx.params ?? {};
  return p.id ?? null;
}

export async function GET(req: Request, ctx: Params) {
  const supabase = await createServerSupabase();
  const ticketId = await getTicketId(ctx);

  if (!ticketId || !isUUID(ticketId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request, ctx: Params) {
  const supabase = await createServerSupabase();
  const ticketId = await getTicketId(ctx);

  if (!ticketId || !isUUID(ticketId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const contenido = norm(body?.contenido ?? body?.content ?? body?.comentario ?? body?.body);
    const isInternal = !!body?.is_internal;

    if (!contenido) return NextResponse.json({ error: "Comentario requerido" }, { status: 400 });

    // ✅ Validar ticket existe sin .single()
    const { data: ticket, error: tErr } = await supabase
      .from(TICKETS_TABLE)
      .select("id,created_by")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    // ✅ author nullable por ahora (si la columna created_by es nullable)
    const created_by = null as string | null;

    const { data, error } = await supabase
      .from(COMMENTS_TABLE)
      .insert({
        ticket_id: ticketId,
        body: contenido,
        is_internal: isInternal,
        created_by,
      })
      .select("*"); // ✅ sin single

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ data: row ?? null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error creando comentario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
