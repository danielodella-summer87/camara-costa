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

/**
 * GET /api/admin/service-categories
 * ?active_only=1 — solo is_active (útil para selects en formularios).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyPermission(req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const activeOnly = req.nextUrl.searchParams.get("active_only") === "1";
    const sb = supabaseAdmin();
    let q = sb
      .from("agency_service_categories")
      .select("id,name,description,sort_order,is_active,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (activeOnly) {
      q = q.eq("is_active", true);
    }

    const { data: rows, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, categories: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/service-categories
 */
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

    const description =
      typeof body.description === "string" ? body.description.trim() || null : body.description == null ? null : String(body.description);
    const sort_order =
      body.sort_order != null && body.sort_order !== "" ? Math.trunc(Number(body.sort_order)) : 0;
    if (!Number.isFinite(sort_order)) {
      return NextResponse.json({ ok: false, error: "sort_order inválido" }, { status: 400 });
    }
    const is_active = body.is_active === false ? false : true;

    const sb = supabaseAdmin();
    const { data: row, error } = await sb
      .from("agency_service_categories")
      .insert({ name, description, sort_order, is_active })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, category: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
