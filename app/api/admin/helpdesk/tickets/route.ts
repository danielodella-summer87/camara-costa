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

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const user = await getSessionUser(supabase);
  if (!user) return jsonError("No autenticado", 401);

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const type = url.searchParams.get("type");
  const mine = url.searchParams.get("mine");

  const admin = await isAdmin(supabase, user.id);

  let q = supabase.from("helpdesk_tickets").select("*");

  if (!admin || mine === "1") {
    q = q.eq("created_by", user.id);
  }

  if (status) q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (type) q = q.eq("type", type);

  q = q.order("last_activity_at", { ascending: false });

  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const user = await getSessionUser(supabase);
  if (!user) return jsonError("No autenticado", 401);

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const type = String(body?.type ?? "bug").trim();
  const priority = String(body?.priority ?? "medium").trim();

  if (!title) return jsonError("Falta título");
  if (!description) return jsonError("Falta descripción");

  const insert = {
    created_by: user.id,
    title,
    description,
    type,
    priority,
    status: "new",
  };

  const { data, error } = await supabase
    .from("helpdesk_tickets")
    .insert(insert)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ data });
}
