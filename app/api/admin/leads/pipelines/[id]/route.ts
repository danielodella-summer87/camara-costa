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

const TABLE = "leads_pipelines";
const SELECT = "id,created_at,updated_at,nombre,posicion,color";

type PipelineRow = {
  id: string;
  created_at: string;
  updated_at: string;
  nombre: string;
  posicion: number;
  color: string | null;
};

type ApiResponse<T> = {
  data?: T | null;
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

function safeInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// ultra defensivo (por turbopack/dev cache)
function getIdFromReq(req: Request, params?: { id?: string | string[] }) {
  const fromParams = params?.id;
  const candidate = Array.isArray(fromParams) ? fromParams[0] : fromParams;
  if (candidate && typeof candidate === "string") return candidate;

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last || null;
}

export async function GET(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies ApiResponse<PipelineRow>,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies ApiResponse<PipelineRow>,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from(TABLE).select(SELECT).eq("id", id).maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResponse<PipelineRow>,
        { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró la pipeline" } satisfies ApiResponse<PipelineRow>,
        { status: 404, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    return NextResponse.json(
      { data: data as PipelineRow, error: null } satisfies ApiResponse<PipelineRow>,
      { status: 200, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResponse<PipelineRow>,
      { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
    );
  }
}

type PatchInput = Partial<{
  nombre: string | null;
  posicion: number | null;
  color: string | null;
}>;

export async function PATCH(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies ApiResponse<PipelineRow>,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies ApiResponse<PipelineRow>,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as PatchInput;

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre !== undefined) update.nombre = cleanStr(body.nombre);
    if (body.posicion !== undefined) update.posicion = safeInt(body.posicion, 0);
    if (body.color !== undefined) update.color = cleanStr(body.color);

    const hasAny =
      update.nombre !== undefined ||
      update.posicion !== undefined ||
      update.color !== undefined;

    const supabase = supabaseAdmin();

    if (!hasAny) {
      const { data, error } = await supabase.from(TABLE).select(SELECT).eq("id", id).maybeSingle();
      if (error) {
        return NextResponse.json(
          { data: null, error: error.message } satisfies ApiResponse<PipelineRow>,
          { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
        );
      }
      if (!data) {
        return NextResponse.json(
          { data: null, error: "No se encontró la pipeline" } satisfies ApiResponse<PipelineRow>,
          { status: 404, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
        );
      }
      return NextResponse.json(
        { data: data as PipelineRow, error: null } satisfies ApiResponse<PipelineRow>,
        { status: 200, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResponse<PipelineRow>,
        { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró la pipeline" } satisfies ApiResponse<PipelineRow>,
        { status: 404, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    return NextResponse.json(
      { data: data as PipelineRow, error: null } satisfies ApiResponse<PipelineRow>,
      { status: 200, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResponse<PipelineRow>,
      { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
    );
  }
}

export async function DELETE(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies ApiResponse<PipelineRow>,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies ApiResponse<PipelineRow>,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResponse<PipelineRow>,
        { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró la pipeline" } satisfies ApiResponse<PipelineRow>,
        { status: 404, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
      );
    }

    return NextResponse.json(
      { data: data as PipelineRow, error: null } satisfies ApiResponse<PipelineRow>,
      { status: 200, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResponse<PipelineRow>,
      { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-[id]-v1" } }
    );
  }
}