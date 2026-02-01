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

export async function GET(_req: Request, ctx: RouteContext) {
  const supabase = await createServerSupabase();
  const user = await getSessionUser(supabase);
  if (!user) return jsonError("No autenticado", 401);

  const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params ?? {}));
  const id = params.id;
  if (!id) return jsonError("id requerido", 400);

  const admin = await isAdmin(supabase, user.id);

  let tq = supabase.from("helpdesk_tickets").select("*").eq("id", id);
  if (!admin) tq = tq.eq("created_by", user.id);

  const { data: ticket, error: tErr } = await tq.single();
  if (tErr) return jsonError(tErr.message, 404);

  const { data: comments } = await supabase
    .from("helpdesk_comments")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const { data: attachments } = await supabase
    .from("helpdesk_attachments")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    data: { ticket, comments: comments ?? [], attachments: attachments ?? [] },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const supabase = await createServerSupabase();
  const user = await getSessionUser(supabase);
  if (!user) return jsonError("No autenticado", 401);

  const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params ?? {}));
  const id = params.id;
  if (!id) return jsonError("id requerido", 400);

  const admin = await isAdmin(supabase, user.id);
  if (!admin) return jsonError("Solo admin puede actualizar tickets", 403);

  const body = await req.json().catch(() => null);
  const payload: Record<string, unknown> = {};

  if (typeof body?.status === "string") payload.status = body.status;
  if (typeof body?.priority === "string") payload.priority = body.priority;
  if (typeof body?.type === "string") payload.type = body.type;
  if (typeof body?.admin_assignee === "string" || body?.admin_assignee === null)
    payload.admin_assignee = body.admin_assignee;

  if (payload.status === "closed") payload.closed_at = new Date().toISOString();
  if (payload.status && payload.status !== "closed") payload.closed_at = null;

  const { data, error } = await supabase
    .from("helpdesk_tickets")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ data });
}
