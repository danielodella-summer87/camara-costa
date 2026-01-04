import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  estado: string | null;
  pipeline: string | null;
  notas: string | null;
};

type LeadApiResponse = {
  data?: LeadRow | null;
  error?: string | null;
};

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function getIdFromReq(req: Request, params?: { id?: string | string[] }) {
  const fromParams = params?.id;
  const candidate = Array.isArray(fromParams) ? fromParams[0] : fromParams;

  if (candidate && typeof candidate === "string") return candidate;

  // Fallback ultra defensivo (por si turbopack/dev cache mete lío)
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last || null;
}

const SELECT =
  "id,created_at,updated_at,nombre,contacto,telefono,email,origen,estado,pipeline,notas";

export async function GET(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params ?? undefined);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("leads").select(SELECT).eq("id", id).maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as LeadRow, error: null } satisfies LeadApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

type LeadPatchInput = Partial<{
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  estado: string | null;
  pipeline: string | null;
  notas: string | null;
}>;

export async function PATCH(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params ?? undefined);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as LeadPatchInput;

    const update: Partial<LeadRow> = {
      nombre: body.nombre === undefined ? undefined : cleanStr(body.nombre),
      contacto: body.contacto === undefined ? undefined : cleanStr(body.contacto),
      telefono: body.telefono === undefined ? undefined : cleanStr(body.telefono),
      email: body.email === undefined ? undefined : cleanStr(body.email),
      origen: body.origen === undefined ? undefined : cleanStr(body.origen),
      estado: body.estado === undefined ? undefined : cleanStr(body.estado),
      pipeline: body.pipeline === undefined ? undefined : cleanStr(body.pipeline),
      notas: body.notas === undefined ? undefined : cleanStr(body.notas),
      updated_at: new Date().toISOString(),
    };

    // Si no hay nada para actualizar, devolvemos el registro actual (o 404)
    const hasAny =
      update.nombre !== undefined ||
      update.contacto !== undefined ||
      update.telefono !== undefined ||
      update.email !== undefined ||
      update.origen !== undefined ||
      update.estado !== undefined ||
      update.pipeline !== undefined ||
      update.notas !== undefined;

    const supabase = supabaseAdmin();

    if (!hasAny) {
      const { data, error } = await supabase.from("leads").select(SELECT).eq("id", id).maybeSingle();
      if (error) {
        return NextResponse.json(
          { data: null, error: error.message } satisfies LeadApiResponse,
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (!data) {
        return NextResponse.json(
          { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { data: data as LeadRow, error: null } satisfies LeadApiResponse,
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update(update)
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as LeadRow, error: null } satisfies LeadApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params ?? undefined);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as LeadRow, error: null } satisfies LeadApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}