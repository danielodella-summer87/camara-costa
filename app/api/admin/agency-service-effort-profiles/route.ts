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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * GET /api/admin/agency-service-effort-profiles?agency_service_id=uuid
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyPermission(req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const sid = req.nextUrl.searchParams.get("agency_service_id")?.trim() ?? "";
    if (!sid || !isUuid(sid)) {
      return NextResponse.json({ ok: false, error: "agency_service_id inválido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: rows, error } = await sb
      .from("agency_service_effort_profiles")
      .select("id,agency_service_id,agency_role_id,hours,notes,created_at,updated_at,agency_roles(id,name,hourly_rate)")
      .eq("agency_service_id", sid)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profiles: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/agency-service-effort-profiles
 * body: { agency_service_id, agency_role_id, hours?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAnyPermission(req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const agency_service_id = typeof body.agency_service_id === "string" ? body.agency_service_id.trim() : "";
    const agency_role_id = typeof body.agency_role_id === "string" ? body.agency_role_id.trim() : "";

    if (!isUuid(agency_service_id)) {
      return NextResponse.json({ ok: false, error: "agency_service_id inválido" }, { status: 400 });
    }
    if (!isUuid(agency_role_id)) {
      return NextResponse.json({ ok: false, error: "agency_role_id inválido" }, { status: 400 });
    }

    const hours = body.hours != null ? Number(body.hours) : 0;
    if (!Number.isFinite(hours) || hours < 0) {
      return NextResponse.json({ ok: false, error: "hours debe ser un número ≥ 0" }, { status: 400 });
    }

    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : body.notes == null ? null : String(body.notes);

    const sb = supabaseAdmin();

    const { data: svc, error: sErr } = await sb.from("agency_services").select("id").eq("id", agency_service_id).maybeSingle();
    if (sErr || !svc) {
      return NextResponse.json({ ok: false, error: "Servicio no encontrado" }, { status: 400 });
    }

    const { data: role, error: rErr } = await sb.from("agency_roles").select("id").eq("id", agency_role_id).maybeSingle();
    if (rErr || !role) {
      return NextResponse.json({ ok: false, error: "Rol no encontrado" }, { status: 400 });
    }

    const { data: row, error } = await sb
      .from("agency_service_effort_profiles")
      .insert({ agency_service_id, agency_role_id, hours, notes })
      .select("id,agency_service_id,agency_role_id,hours,notes,created_at,updated_at,agency_roles(id,name,hourly_rate)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "Ese rol ya está asignado a este servicio." },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
