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

/** PATCH /api/admin/agency-roles/[id] */
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

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ ok: false, error: "name no puede quedar vacío" }, { status: 400 });
      row.name = name;
    }
    if ("hourly_rate" in body) {
      const hourly_rate = Number(body.hourly_rate);
      if (!Number.isFinite(hourly_rate) || hourly_rate < 0) {
        return NextResponse.json({ ok: false, error: "hourly_rate debe ser un número ≥ 0" }, { status: 400 });
      }
      row.hourly_rate = hourly_rate;
    }

    if (Object.keys(row).length === 0) {
      return NextResponse.json({ ok: false, error: "No hay campos para actualizar" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb.from("agency_roles").update(row).eq("id", id).select().single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Rol no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, role: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/agency-roles/[id] — bloqueado si hay perfiles de esfuerzo */
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
    const { count, error: cErr } = await sb
      .from("agency_service_effort_profiles")
      .select("id", { count: "exact", head: true })
      .eq("agency_role_id", id);

    if (cErr) {
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    }
    if (count && count > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este rol está asignado a servicios (esfuerzo). Quitá las asignaciones antes de eliminarlo.",
        },
        { status: 409 }
      );
    }

    const { error: dErr } = await sb.from("agency_roles").delete().eq("id", id);

    if (dErr) {
      return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
