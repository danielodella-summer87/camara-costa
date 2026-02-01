import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ATT_TABLE = "helpdesk_attachments";
const TICKETS_TABLE = "helpdesk_tickets";
const BUCKET = "helpdesk";

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
    .from(ATT_TABLE)
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
    // ✅ validar ticket existe sin .single()
    const { data: ticket, error: tErr } = await supabase
      .from(TICKETS_TABLE)
      .select("id")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido (field: file)" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    // ✅ author nullable por ahora (si la columna created_by es nullable)
    const created_by = null as string | null;

    const { data, error } = await supabase
      .from(ATT_TABLE)
      .insert({
        ticket_id: ticketId,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size ?? null,
        created_by,
      })
      .select("*"); // ✅ sin single

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;

    // devolver también URL firmada opcional (si querés previsualizar)
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    const signed_url = signed.data?.signedUrl ?? null;

    return NextResponse.json({ data: row ?? null, signed_url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error subiendo adjunto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
