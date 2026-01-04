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

type ListResponse = {
  data?: PipelineRow[] | null;
  error?: string | null;
};

type OneResponse = {
  data?: PipelineRow | null;
  error?: string | null;
};

type ReorderResponse = {
  data?: { updated: number; rows: Array<{ id: string; posicion: number; updated_at: string }> } | null;
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

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .order("posicion", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ListResponse,
        { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? []) as PipelineRow[], error: null } satisfies ListResponse,
      { status: 200, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ListResponse,
      { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
    );
  }
}

type CreateInput = {
  nombre?: string | null;
  posicion?: number | null;
  color?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as CreateInput;

    const nombre = cleanStr(body.nombre);
    if (!nombre) {
      return NextResponse.json(
        { data: null, error: "El nombre es obligatorio." } satisfies OneResponse,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
      );
    }

    const color = cleanStr(body.color);
    const supabase = supabaseAdmin();

    // si no mandan posicion, la ponemos al final (max+1)
    let posicion = body.posicion === undefined || body.posicion === null ? null : safeInt(body.posicion, 0);

    if (posicion === null) {
      const { data: last } = await supabase
        .from(TABLE)
        .select("posicion")
        .order("posicion", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastPos = safeInt((last as any)?.posicion, -1);
      posicion = lastPos + 1;
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        nombre,
        posicion,
        color,
        updated_at: now,
      })
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies OneResponse,
        { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? null) as PipelineRow | null, error: null } satisfies OneResponse,
      { status: 201, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies OneResponse,
      { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
    );
  }
}

type ReorderInput = {
  order?: string[] | null; // array de UUIDs en el orden final (posicion = índice)
};

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ReorderInput;
    const order = Array.isArray(body.order) ? body.order : [];

    // validación dura
    const cleaned = order
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);

    const uniq = Array.from(new Set(cleaned));

    if (!uniq.length || uniq.length !== cleaned.length || !uniq.every(isUUID)) {
      return NextResponse.json(
        { data: null, error: "order inválido o vacío" } satisfies ReorderResponse,
        { status: 400, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
      );
    }

    const supabase = supabaseAdmin();
    const now = new Date().toISOString();

    // actualizamos posiciones en paralelo
    const updates = await Promise.all(
      uniq.map(async (id, idx) => {
        const { data, error } = await supabase
          .from(TABLE)
          .update({ posicion: idx, updated_at: now })
          .eq("id", id)
          .select("id,posicion,updated_at")
          .maybeSingle();

        if (error) throw new Error(error.message);
        return data as { id: string; posicion: number; updated_at: string } | null;
      })
    );

    const rows = updates.filter(Boolean) as Array<{ id: string; posicion: number; updated_at: string }>;

    return NextResponse.json(
      { data: { updated: rows.length, rows }, error: null } satisfies ReorderResponse,
      { status: 200, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ReorderResponse,
      { status: 500, headers: { "Cache-Control": "no-store", "x-handler": "pipelines-v1" } }
    );
  }
}