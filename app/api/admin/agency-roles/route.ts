import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAnyPermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** GET /api/admin/agency-roles */
export async function GET(_req: NextRequest) {
  try {
    const user = await requireAnyPermission(_req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const sb = supabaseAdmin();
    const { data: rows, error } = await sb
      .from("agency_roles")
      .select("id,name,hourly_rate,created_at,updated_at")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, roles: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** POST /api/admin/agency-roles */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAnyPermission(req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ ok: false, error: "name es requerido" }, { status: 400 });
    }

    const hourly_rate = body.hourly_rate != null ? Number(body.hourly_rate) : 0;
    if (!Number.isFinite(hourly_rate) || hourly_rate < 0) {
      return NextResponse.json({ ok: false, error: "hourly_rate debe ser un número ≥ 0" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: row, error } = await sb
      .from("agency_roles")
      .insert({ name, hourly_rate })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, role: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
