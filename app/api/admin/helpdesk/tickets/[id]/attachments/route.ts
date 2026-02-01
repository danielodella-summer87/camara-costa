import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getSessionUser(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function isAdmin(supabase: Awaited<ReturnType<typeof createServerSupabase>>, userId: string) {
  const { data } = await supabase
    .from("app_users")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.is_admin;
}

type RouteContext = { params?: { id?: string } | Promise<{ id?: string }> };

/**
 * Solo registra el adjunto en DB. La subida real se hace desde el cliente al bucket.
 */
export async function POST(req: Request, ctx: RouteContext) {
  const supabase = await createServerSupabase();
  const user = await getSessionUser(supabase);
  if (!user) return jsonError("No autenticado", 401);

  const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params ?? {}));
  const ticketId = params.id;
  if (!ticketId) return jsonError("id de ticket requerido", 400);

  const admin = await isAdmin(supabase, user.id);

  const body = await req.json().catch(() => null);

  const file_path = String(body?.file_path ?? "").trim();
  const file_name = String(body?.file_name ?? "").trim();
  const mime_type = body?.mime_type ? String(body.mime_type) : null;
  const size_bytes = typeof body?.size_bytes === "number" ? body.size_bytes : null;

  if (!file_path || !file_name) return jsonError("Falta file_path o file_name");

  const { data: t, error: tErr } = await supabase
    .from("helpdesk_tickets")
    .select("id,created_by")
    .eq("id", ticketId)
    .single();

  if (tErr || !t) return jsonError("Ticket no encontrado", 404);
  if (!admin && t.created_by !== user.id) return jsonError("Sin permiso", 403);

  const { data, error } = await supabase
    .from("helpdesk_attachments")
    .insert({
      ticket_id: ticketId,
      created_by: user.id,
      file_path,
      file_name,
      mime_type,
      size_bytes,
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ data });
}
