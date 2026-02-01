import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLE = "helpdesk_tickets";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toInt(v: string | null, def: number) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

/** Obtiene app_users.id a partir del email del usuario autenticado (Supabase Auth). */
async function getAppUserIdFromAuthEmail(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);

  const email = authData?.user?.email;
  if (!email) throw new Error("No hay usuario autenticado.");

  const { data: appUser, error: appUserErr } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (appUserErr) throw new Error(appUserErr.message);
  if (!appUser?.id) throw new Error(`No existe app_user para el email ${email}.`);

  return appUser.id as string;
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

  let appUserId: string;
  try {
    appUserId = await getAppUserIdFromAuthEmail(supabase);
  } catch {
    return jsonError("No autenticado", 401);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const type = url.searchParams.get("type");
  const mine = url.searchParams.get("mine");
  const q = url.searchParams.get("q");
  const page = toInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(50, Math.max(5, toInt(url.searchParams.get("pageSize"), 20)));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = await isAdmin(supabase, appUserId);

  let query = supabase.from(TABLE).select("*", { count: "exact" }).range(from, to);

  if (!admin || mine === "1") {
    query = query.eq("created_by", appUserId);
  }

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (type) query = query.eq("type", type);

  if (q && norm(q)) {
    const term = norm(q).replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${term}%`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  query = query.order("last_activity_at", { ascending: false });

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();

  const body = await req.json().catch(() => null);

  // 1) intentar auth server (si algún día lo tenés)
  let email: string | null = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    email = authData?.user?.email ?? null;
  } catch {}

  // 2) fallback: viene desde el client
  if (!email) email = body?.user_email ?? null;

  if (!email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: appUser, error: appUserErr } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (appUserErr) return NextResponse.json({ error: appUserErr.message }, { status: 400 });
  if (!appUser?.id) return NextResponse.json({ error: `No existe app_user para el email ${email}.` }, { status: 400 });

  const created_by = appUser.id;

  const title = norm(body?.title);
  const description = norm(body?.description);
  const type = norm(body?.type) || "bug";
  const priority = norm(body?.priority) || "medium";

  if (!title) return jsonError("Falta título");
  if (!description) return jsonError("Falta descripción");

  const insert = {
    created_by,
    title,
    description,
    type,
    priority,
    status: "new",
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ data });
}
