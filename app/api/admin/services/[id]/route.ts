import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAnyPermission } from "@/lib/rbac/requirePermission";
import { AGENCY_SERVICE_CURRENCIES, AGENCY_SERVICE_UNITS } from "@/lib/agencyServices/catalog";

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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validatePatch(body: Record<string, unknown>): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const row: Record<string, unknown> = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { ok: false, error: "name no puede quedar vacío" };
    row.name = name;
  }
  if ("category_id" in body) {
    if (body.category_id === null || body.category_id === "") {
      row.category_id = null;
    } else {
      const cid = typeof body.category_id === "string" ? body.category_id.trim() : "";
      if (!isUuid(cid)) return { ok: false, error: "category_id inválido" };
      row.category_id = cid;
    }
  }
  if ("description" in body) {
    row.description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : body.description == null
          ? null
          : String(body.description);
  }
  if ("internal_notes" in body) {
    row.internal_notes =
      typeof body.internal_notes === "string"
        ? body.internal_notes.trim() || null
        : body.internal_notes == null
          ? null
          : String(body.internal_notes);
  }
  if ("price_base" in body) {
    const n = Number(body.price_base);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "price_base debe ser un número ≥ 0" };
    row.price_base = n;
  }
  if ("currency" in body) {
    const c = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
    if (!AGENCY_SERVICE_CURRENCIES.includes(c as (typeof AGENCY_SERVICE_CURRENCIES)[number])) {
      return { ok: false, error: "currency debe ser USD o UYU" };
    }
    row.currency = c;
  }
  if ("unit" in body) {
    const u = typeof body.unit === "string" ? body.unit.trim() : "";
    if (!AGENCY_SERVICE_UNITS.includes(u as (typeof AGENCY_SERVICE_UNITS)[number])) {
      return { ok: false, error: "unit inválida" };
    }
    row.unit = u;
  }
  if ("default_quantity" in body) {
    const q = Number(body.default_quantity);
    if (!Number.isFinite(q) || q <= 0) return { ok: false, error: "default_quantity debe ser > 0" };
    row.default_quantity = q;
  }
  if ("is_active" in body) {
    row.is_active = Boolean(body.is_active);
  }
  if ("sort_order" in body) {
    const so = Math.trunc(Number(body.sort_order));
    if (!Number.isFinite(so)) return { ok: false, error: "sort_order inválido" };
    row.sort_order = so;
  }

  if (Object.keys(row).length === 0) {
    return { ok: false, error: "No hay campos para actualizar" };
  }

  return { ok: true, row };
}

/**
 * PATCH /api/admin/services/[id]
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
    const v = validatePatch(body);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const catId = v.row.category_id as string | null | undefined;
    if (catId) {
      const { data: cat, error: catErr } = await sb
        .from("agency_service_categories")
        .select("id")
        .eq("id", catId)
        .maybeSingle();
      if (catErr || !cat) {
        return NextResponse.json({ ok: false, error: "Categoría no encontrada" }, { status: 400 });
      }
    }

    const { data: row, error } = await sb
      .from("agency_services")
      .update(v.row)
      .eq("id", id)
      .select("id,name,category,category_id,description,price_base,currency,unit,default_quantity,internal_notes,is_active,sort_order,created_at,updated_at,agency_service_categories(name)")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ ok: false, error: "Servicio no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, service: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/services/[id]
 * Solo si no hay líneas de propuesta que referencien agency_service_id.
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
      .from("lead_service_proposals")
      .select("id", { count: "exact", head: true })
      .eq("agency_service_id", id);

    if (cErr) {
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    }
    if (count && count > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este servicio está en uso en propuestas de leads. Desactivarlo desde el listado en lugar de eliminarlo.",
        },
        { status: 409 }
      );
    }

    const { error: dErr } = await sb.from("agency_services").delete().eq("id", id);

    if (dErr) {
      return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
