import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAnyPermission, requirePermission } from "@/lib/rbac/requirePermission";
import {
  AGENCY_SERVICE_CURRENCIES,
  AGENCY_SERVICE_UNITS,
  agencyUnitToBillingType,
} from "@/lib/agencyServices/catalog";
import {
  computeLineFromEffortProfileRow,
  marginVsPriceBase,
  sumInternalCost,
  type InternalCostBreakdownLine,
} from "@/lib/agencyServices/internalCost";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Fila catálogo para UI de propuesta (compat con EasyService) + campos admin. */
function categoryEmbedName(
  embed: { name?: string | null } | { name?: string | null }[] | null | undefined
): string | null {
  const row = Array.isArray(embed) ? embed[0] : embed;
  return typeof row?.name === "string" && row.name.trim() ? row.name.trim() : null;
}

export function mapAgencyRowToCatalogRow(s: {
  id: string;
  name: string;
  category?: string | null;
  category_id?: string | null;
  agency_service_categories?: { name?: string | null } | { name?: string | null }[] | null;
  description: string | null;
  price_base: number | string | null;
  currency: string | null;
  unit: string;
  default_quantity: number | string | null;
  internal_notes?: string | null;
  sort_order: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}) {
  const priceBase =
    s.price_base != null && s.price_base !== ""
      ? Number(s.price_base)
      : null;
  const defQty =
    s.default_quantity != null && s.default_quantity !== ""
      ? Number(s.default_quantity)
      : 1;
  const categoriaNombre =
    categoryEmbedName(s.agency_service_categories) ??
    (typeof s.category === "string" && s.category.trim() ? s.category.trim() : null);
  return {
    id: s.id,
    codigo: "",
    nombre: s.name,
    category_id: s.category_id ?? null,
    categoria: categoriaNombre,
    descripcion_corta: s.description ?? null,
    alcance_base: s.description ?? null,
    billing_type: agencyUnitToBillingType(s.unit),
    precio_base: Number.isFinite(priceBase) ? priceBase : null,
    moneda: s.currency?.trim() || "USD",
    orden: s.sort_order ?? 0,
    unit: s.unit,
    default_quantity: Number.isFinite(defQty) && defQty > 0 ? defQty : 1,
    is_active: s.is_active !== false,
    internal_notes: s.internal_notes ?? null,
    sort_order: s.sort_order ?? 0,
    source: "agency" as const,
  };
}

/**
 * GET /api/admin/services
 * - Sin query: catálogo activo para propuestas (permiso leads.read), orden sort_order, name.
 * - ?include_inactive=1: todos los registros (config.update o config.admin) para admin.
 */
export async function GET(req: NextRequest) {
  try {
    const includeInactive = req.nextUrl.searchParams.get("include_inactive") === "1";
    const user = includeInactive
      ? await requireAnyPermission(req, ["config.update", "config.admin"])
      : await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const sb = supabaseAdmin();
    let q = sb
      .from("agency_services")
      .select(
        "id,name,category,category_id,description,price_base,currency,unit,default_quantity,internal_notes,is_active,sort_order,created_at,updated_at,agency_service_categories(name)"
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) {
      q = q.eq("is_active", true);
    }

    const { data: rows, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let services = (rows ?? []).map((r) => mapAgencyRowToCatalogRow(r));

    if (includeInactive) {
      const { data: efforts, error: effErr } = await sb
        .from("agency_service_effort_profiles")
        .select("agency_service_id,agency_role_id,estimated_hours");

      if (effErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `No se pudo cargar esfuerzo por servicio: ${effErr.message}`,
            hint: "Verificá permisos del service role y que exista la tabla agency_service_effort_profiles.",
          },
          { status: 500 }
        );
      }

      const effortRows = efforts ?? [];
      const roleIds = [...new Set(effortRows.map((r) => r.agency_role_id).filter(Boolean))] as string[];

      let roleMap = new Map<string, { id: string; name: string; hourly_rate: number }>();
      if (roleIds.length > 0) {
        const { data: roleRows, error: roleErr } = await sb
          .from("agency_roles")
          .select("id,name,hourly_rate")
          .in("id", roleIds);

        if (roleErr) {
          return NextResponse.json(
            {
              ok: false,
              error: `No se pudieron cargar tarifas de roles: ${roleErr.message}`,
              hint: "Verificá la tabla agency_roles y el listado de ids.",
            },
            { status: 500 }
          );
        }
        roleMap = new Map(
          (roleRows ?? []).map((r) => {
            const id = String(r.id).toLowerCase();
            const hourly_rate =
              r.hourly_rate != null && r.hourly_rate !== "" ? Number(r.hourly_rate) : 0;
            return [
              id,
              {
                id: String(r.id),
                name: typeof r.name === "string" ? r.name : "—",
                hourly_rate: Number.isFinite(hourly_rate) && hourly_rate >= 0 ? hourly_rate : 0,
              },
            ];
          })
        );
      }

      const byService = new Map<string, InternalCostBreakdownLine[]>();
      for (const row of effortRows) {
        const sidRaw = row.agency_service_id;
        const sid = sidRaw != null ? String(sidRaw).toLowerCase() : "";
        if (!sid) continue;
        const rid = row.agency_role_id != null ? String(row.agency_role_id).toLowerCase() : "";
        const role = rid ? roleMap.get(rid) : undefined;
        const est = (row as { estimated_hours?: number | string | null }).estimated_hours;
        const line = computeLineFromEffortProfileRow({
          hours: est,
          agency_role_id: row.agency_role_id,
          agency_roles: role
            ? { id: role.id, name: role.name, hourly_rate: role.hourly_rate }
            : null,
        });
        if (!byService.has(sid)) byService.set(sid, []);
        byService.get(sid)!.push(line);
      }

      services = services.map((s) => {
        const sid = String(s.id).toLowerCase();
        const breakdown = byService.get(sid) ?? [];
        const internal_cost_total = sumInternalCost(breakdown);
        const { margin_amount, margin_percent } = marginVsPriceBase(s.precio_base, internal_cost_total);
        return {
          ...s,
          internal_cost_total,
          internal_cost_breakdown: breakdown,
          margin_amount,
          margin_percent,
        };
      });
    }

    return NextResponse.json({ ok: true, services });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validateBody(body: Record<string, unknown>): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name es requerido" };

  let category_id: string | null = null;
  if (body.category_id != null && body.category_id !== "") {
    const cid = typeof body.category_id === "string" ? body.category_id.trim() : "";
    if (!isUuid(cid)) return { ok: false, error: "category_id inválido" };
    category_id = cid;
  }
  const description =
    typeof body.description === "string" ? body.description.trim() || null : body.description == null ? null : String(body.description);
  const internal_notes =
    typeof body.internal_notes === "string"
      ? body.internal_notes.trim() || null
      : body.internal_notes == null
        ? null
        : String(body.internal_notes);

  const priceBase = body.price_base != null ? Number(body.price_base) : 0;
  if (!Number.isFinite(priceBase) || priceBase < 0) {
    return { ok: false, error: "price_base debe ser un número ≥ 0" };
  }

  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "USD";
  if (!AGENCY_SERVICE_CURRENCIES.includes(currency as (typeof AGENCY_SERVICE_CURRENCIES)[number])) {
    return { ok: false, error: "currency debe ser USD o UYU" };
  }

  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  if (!AGENCY_SERVICE_UNITS.includes(unit as (typeof AGENCY_SERVICE_UNITS)[number])) {
    return { ok: false, error: "unit inválida (hour, monthly, project, one_time)" };
  }

  const defaultQty = body.default_quantity != null ? Number(body.default_quantity) : 1;
  if (!Number.isFinite(defaultQty) || defaultQty <= 0) {
    return { ok: false, error: "default_quantity debe ser un número > 0" };
  }

  const is_active = body.is_active === false ? false : true;
  const sort_order =
    body.sort_order != null && body.sort_order !== ""
      ? Math.trunc(Number(body.sort_order))
      : 0;
  if (!Number.isFinite(sort_order)) {
    return { ok: false, error: "sort_order inválido" };
  }

  return {
    ok: true,
    row: {
      name,
      category_id,
      description,
      price_base: priceBase,
      currency,
      unit,
      default_quantity: defaultQty,
      internal_notes,
      is_active,
      sort_order,
    },
  };
}

/**
 * POST /api/admin/services
 * Alta de servicio (config.update o config.admin).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAnyPermission(req, ["config.update", "config.admin"]);
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const v = validateBody(body);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const catId = v.row.category_id as string | null;
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
      .insert(v.row)
      .select("id,name,category,category_id,description,price_base,currency,unit,default_quantity,internal_notes,is_active,sort_order,created_at,updated_at,agency_service_categories(name)")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, service: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
