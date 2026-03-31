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

/**
 * PATCH /api/admin/service-categories/[id]
 */
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
    if ("description" in body) {
      row.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : body.description == null
            ? null
            : String(body.description);
    }
    if ("sort_order" in body) {
      const so = Math.trunc(Number(body.sort_order));
      if (!Number.isFinite(so)) return NextResponse.json({ ok: false, error: "sort_order inválido" }, { status: 400 });
      row.sort_order = so;
    }
    if ("is_active" in body) {
      row.is_active = Boolean(body.is_active);
    }

    if (Object.keys(row).length === 0) {
      return NextResponse.json({ ok: false, error: "No hay campos para actualizar" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb
      .from("agency_service_categories")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Categoría no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, category: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/service-categories/[id]
 * Solo si no hay agency_services con esta categoría.
 */
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
      .from("agency_services")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (cErr) {
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    }
    if (count && count > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esta categoría tiene servicios asociados. Desactivarla desde el listado en lugar de eliminarla.",
        },
        { status: 409 }
      );
    }

    const { error: dErr } = await sb.from("agency_service_categories").delete().eq("id", id);

    if (dErr) {
      return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
