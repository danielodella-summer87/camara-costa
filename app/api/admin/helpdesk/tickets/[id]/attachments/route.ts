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
    .from("helpdesk_attachments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request, ctx: any) {
  const supabase = await createServerSupabase();
  const ticketId = await getParamId(ctx);

  if (!ticketId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const file_path = typeof body?.file_path === "string" ? body.file_path.trim() : "";
    const file_name = typeof body?.file_name === "string" ? body.file_name.trim() : "";
    const mime_type = body?.mime_type ?? null;
    const size_bytes = body?.size_bytes ?? null;
    const user_email = body?.user_email ?? null;

    if (!file_path || !file_name) {
      return NextResponse.json({ error: "Adjunto inválido" }, { status: 400 });
    }

    // ✅ validar ticket existe sin .single()
    const t = await supabase.from("helpdesk_tickets").select("id").eq("id", ticketId);
    if (t.error) return NextResponse.json({ error: t.error.message }, { status: 400 });
    if (!t.data || t.data.length === 0) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    const { data, error } = await supabase
      .from("helpdesk_attachments")
      .insert({
        ticket_id: ticketId,
        file_path,
        file_name,
        mime_type,
        size_bytes,
        user_email,
      })
      .select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ data: row ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error registrando adjunto" }, { status: 400 });
  }
}
