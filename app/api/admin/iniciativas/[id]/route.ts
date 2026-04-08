import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

async function rubroNameById(supabase: ReturnType<typeof supabaseAdmin>, rubro_id: string) {
  const { data, error } = await supabase.from("rubros").select("nombre").eq("id", rubro_id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.nombre ?? null;
}

/** Solo datos básicos de iniciativa; no toca estado_revision ni conversión a lead. */
type IniciativaBasicPatch = {
  nombre?: string;
  web?: string | null;
  contacto_nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  rubro_id?: string | null;
  descripcion?: string | null;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(req as Request, "leads.write");
  if (!user) {
    return NextResponse.json({ data: null, error: "No autorizado" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as IniciativaBasicPatch;
    const supabase = supabaseAdmin();

    const nombre = body.nombre === undefined ? undefined : cleanStr(body.nombre);
    const web = body.web === undefined ? undefined : cleanStr(body.web);
    const contacto_nombre = body.contacto_nombre === undefined ? undefined : cleanStr(body.contacto_nombre);
    const email = body.email === undefined ? undefined : cleanStr(body.email);
    const telefono = body.telefono === undefined ? undefined : cleanStr(body.telefono);
    const descripcion = body.descripcion === undefined ? undefined : cleanStr(body.descripcion);
    const rubro_id = body.rubro_id === undefined ? undefined : cleanStr(body.rubro_id);

    const update: Record<string, unknown> = {};

    if (nombre !== undefined) update.nombre = nombre;
    if (web !== undefined) update.web = web;
    if (contacto_nombre !== undefined) update.contacto_nombre = contacto_nombre;
    if (email !== undefined) update.email = email;
    if (telefono !== undefined) update.telefono = telefono;
    if (descripcion !== undefined) update.descripcion = descripcion;

    if (rubro_id !== undefined) {
      if (rubro_id === null) {
        update.rubro_id = null;
        update.rubro = null;
      } else {
        if (!UUID_RE.test(rubro_id)) {
          return NextResponse.json(
            { data: null, error: "rubro_id inválido (se espera UUID)" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }
        const rubroNombre = await rubroNameById(supabase, rubro_id);
        update.rubro_id = rubro_id;
        update.rubro = rubroNombre;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { data: null, error: "No hay campos para actualizar" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await supabase.from("empresas").update(update).eq("id", id).select("*").maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "Iniciativa no encontrada" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ data: null, error: msg }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
