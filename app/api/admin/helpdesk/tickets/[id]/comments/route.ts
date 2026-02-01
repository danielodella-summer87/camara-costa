import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

async function getParamId(ctx: any) {
  const p = ctx?.params;
  const params = typeof p?.then === "function" ? await p : p;
  const id = params?.id;
  return typeof id === "string" ? id : null;
}

export async function GET(req: Request, ctx: any) {
  const supabase = await createServerSupabase();
  const ticketId = await getParamId(ctx);

  if (!ticketId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { data, error } = await supabase
    .from("helpdesk_comments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request, ctx: any) {
  const supabase = await createServerSupabase();
  const ticketId = await getParamId(ctx);

  if (!ticketId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    const is_internal = !!body?.is_internal;
    const user_email = body?.user_email ?? null;

    if (!text) return NextResponse.json({ error: "Comentario requerido" }, { status: 400 });

    // ✅ validar ticket existe sin .single()
    const t = await supabase.from("helpdesk_tickets").select("id").eq("id", ticketId);
    if (t.error) return NextResponse.json({ error: t.error.message }, { status: 400 });
    if (!t.data || t.data.length === 0) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    const { data, error } = await supabase
      .from("helpdesk_comments")
      .insert({
        ticket_id: ticketId,
        body: text,
        is_internal,
        user_email,
      })
      .select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ data: row ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error comentando" }, { status: 400 });
  }
}
