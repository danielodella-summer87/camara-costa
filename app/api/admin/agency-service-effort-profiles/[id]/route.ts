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

function safeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

/** PATCH /api/admin/agency-service-effort-profiles/[id] */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission(req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const row: Record<string, unknown> = {};

    if ("hours" in body) {
      const hours = Number(body.hours);
      if (!Number.isFinite(hours) || hours < 0) {
        return NextResponse.json({ ok: false, error: "hours debe ser un número ≥ 0" }, { status: 400 });
      }
      row.hours = hours;
    }
    if ("notes" in body) {
      row.notes =
        typeof body.notes === "string" ? body.notes.trim() || null : body.notes == null ? null : String(body.notes);
    }

    if (Object.keys(row).length === 0) {
      return NextResponse.json({ ok: false, error: "No hay campos para actualizar" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb
      .from("agency_service_effort_profiles")
      .update(row)
      .eq("id", id)
      .select("id,agency_service_id,agency_role_id,hours,notes,created_at,updated_at,agency_roles(id,name,hourly_rate)")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Perfil no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/agency-service-effort-profiles/[id] */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission(_req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from("agency_service_effort_profiles").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
