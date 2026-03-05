import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export const dynamic = "force-dynamic";

// Si falta la columna facebook en empresas: ALTER TABLE empresas ADD COLUMN IF NOT EXISTS facebook text;

type Ctx = {
  params?: { id?: string } | Promise<{ id?: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

async function getId(req: Request, ctx: Ctx) {
  const params = ctx?.params ? await Promise.resolve(ctx.params as any) : undefined;
  const idFromParams = params?.id;

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idFromPath = parts[parts.length - 1];

  const id = idFromParams || idFromPath;

  if (!id || id === "empresas") return null;
  return id;
}

async function rubroNameById(supabase: ReturnType<typeof supabaseAdmin>, rubro_id: string) {
  const { data, error } = await supabase
    .from("rubros")
    .select("nombre")
    .eq("id", rubro_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.nombre ?? null;
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const id = await getId(req, ctx);

    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("empresas")
      .select("*,rubro_id,rubros:rubro_id(id,nombre),import_batch_id")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "Empresa no encontrada" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Si tiene import_batch_id, traer los datos del batch
    if (data.import_batch_id) {
      const { data: batchData, error: batchError } = await supabase
        .from("entity_import_batches")
        .select("id,concepto,created_at,filename")
        .eq("id", data.import_batch_id)
        .maybeSingle();

      if (!batchError && batchData) {
        (data as any).entity_import_batches = batchData;
      }
    }

    return NextResponse.json(
      { data, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

type EmpresaPatchInput = {
  nombre?: string;
  tipo?: "empresa" | "profesional" | "institucion" | null;
  rubro_id?: string | null;
  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  direccion?: string | null;
  celular?: string | null;
  rut?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  contacto_nombre?: string | null;
  contacto_celular?: string | null;
  contacto_email?: string | null;
  etiquetas?: string | null;
  descripcion?: string | null;
  aprobada?: boolean | null;
  estado?: string | null;
};

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = await getId(req, ctx);

    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as EmpresaPatchInput;

    const supabase = supabaseAdmin();

    const rubro_id = body.rubro_id === undefined ? undefined : cleanStr(body.rubro_id);
    const nombre = body.nombre === undefined ? undefined : cleanStr(body.nombre);
    const tipo = body.tipo === undefined ? undefined : (body.tipo ?? "empresa");
    const telefono = body.telefono === undefined ? undefined : cleanStr(body.telefono);
    const email = body.email === undefined ? undefined : cleanStr(body.email);
    const web = body.web === undefined ? undefined : cleanStr(body.web);
    const instagram = body.instagram === undefined ? undefined : cleanStr(body.instagram);
    const facebook = body.facebook === undefined ? undefined : cleanStr(body.facebook);
    const direccion = body.direccion === undefined ? undefined : cleanStr(body.direccion);
    const celular = body.celular === undefined ? undefined : cleanStr(body.celular);
    const rut = body.rut === undefined ? undefined : cleanStr(body.rut);
    const ciudad = body.ciudad === undefined ? undefined : cleanStr(body.ciudad);
    const pais = body.pais === undefined ? undefined : cleanStr(body.pais);
    const contacto_nombre = body.contacto_nombre === undefined ? undefined : cleanStr(body.contacto_nombre);
    const contacto_celular = body.contacto_celular === undefined ? undefined : cleanStr(body.contacto_celular);
    const contacto_email = body.contacto_email === undefined ? undefined : cleanStr(body.contacto_email);
    const etiquetas = body.etiquetas === undefined ? undefined : cleanStr(body.etiquetas);
    const descripcion = body.descripcion === undefined ? undefined : cleanStr(body.descripcion);
    const estado = body.estado === undefined ? undefined : cleanStr(body.estado);

    const update: Record<string, any> = {};

    if (nombre !== undefined) update.nombre = nombre;
    if (tipo !== undefined) update.tipo = tipo;
    if (telefono !== undefined) update.telefono = telefono;
    if (email !== undefined) update.email = email;
    if (web !== undefined) update.web = web;
    if (instagram !== undefined) update.instagram = instagram;
    if (facebook !== undefined) update.facebook = facebook;
    if (direccion !== undefined) update.direccion = direccion;
    if (celular !== undefined) update.celular = celular;
    if (rut !== undefined) update.rut = rut;
    if (ciudad !== undefined) update.ciudad = ciudad;
    if (pais !== undefined) update.pais = pais;
    if (contacto_nombre !== undefined) update.contacto_nombre = contacto_nombre;
    if (contacto_celular !== undefined) update.contacto_celular = contacto_celular;
    if (contacto_email !== undefined) update.contacto_email = contacto_email;
    if (etiquetas !== undefined) update.etiquetas = etiquetas;
    if (descripcion !== undefined) update.descripcion = descripcion;
    if (estado !== undefined) update.estado = estado;
    if (body.aprobada !== undefined) update.aprobada = body.aprobada;

    // rubro_id -> además guardamos "rubro" (nombre)
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

    const { data, error } = await supabase
      .from("empresas")
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "Empresa no encontrada" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}