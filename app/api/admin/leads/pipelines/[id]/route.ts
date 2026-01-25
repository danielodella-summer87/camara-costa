import { NextRequest, NextResponse } from "next/server";
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
const SELECT = "id,created_at,updated_at,nombre,posicion,tipo,color";

type PipelineRow = {
  id: string;
  created_at: string;
  updated_at: string;
  nombre: string;
  posicion: number;
  tipo: "normal" | "ganado" | "perdido";
  color: string | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

export async function GET(_req: NextRequest, ctx: { params?: { id?: string } | Promise<{ id?: string }> }) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const id = params.id;

    if (!id || !isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "id inválido (UUID requerido)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "Pipeline no encontrado" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as PipelineRow, error: null } satisfies ApiResp<PipelineRow>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

type UpdateInput = {
  nombre?: string | null;
  posicion?: number | null;
  tipo?: "normal" | "ganado" | "perdido" | null;
  color?: string | null;
};

export async function PATCH(req: NextRequest, ctx: { params?: { id?: string } | Promise<{ id?: string }> }) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const id = params.id;

    if (!id || !isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "id inválido (UUID requerido)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as UpdateInput;
    const supabase = supabaseAdmin();

    // Obtener pipeline actual
    const { data: current, error: currentError } = await supabase
      .from(TABLE)
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();

    if (currentError || !current) {
      return NextResponse.json(
        { data: null, error: "Pipeline no encontrado" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const update: Partial<PipelineRow> = {
      updated_at: new Date().toISOString(),
    };

    // Actualizar nombre si viene
    if (body.nombre !== undefined) {
      const nombre = cleanStr(body.nombre);
      if (!nombre) {
        return NextResponse.json(
          { data: null, error: "El nombre es obligatorio" } satisfies ApiResp<null>,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      // Verificar que no exista otro con el mismo nombre
      const { data: existing } = await supabase
        .from(TABLE)
        .select("id")
        .eq("nombre", nombre)
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { data: null, error: `Ya existe un pipeline con el nombre "${nombre}"` } satisfies ApiResp<null>,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      update.nombre = nombre;
    }

    // Actualizar tipo si viene
    if (body.tipo !== undefined) {
      const tipo = body.tipo === "ganado" || body.tipo === "perdido" ? body.tipo : "normal";

      // Validar que solo existe 1 tipo=ganado y 1 tipo=perdido
      if (tipo === "ganado" || tipo === "perdido") {
        const { data: existing } = await supabase
          .from(TABLE)
          .select("id, nombre")
          .eq("tipo", tipo)
          .neq("id", id)
          .maybeSingle();

        if (existing) {
          return NextResponse.json(
            { data: null, error: `Ya existe un pipeline de tipo "${tipo}" (${existing.nombre}). Solo puede haber uno.` } satisfies ApiResp<null>,
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }
      }
      update.tipo = tipo;
    }

    // Actualizar posicion si viene
    if (body.posicion !== undefined && body.posicion !== null) {
      update.posicion = safeInt(body.posicion, 0);
    }

    // Actualizar color si viene
    if (body.color !== undefined) {
      update.color = cleanStr(body.color);
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? null) as PipelineRow | null, error: null } satisfies ApiResp<PipelineRow>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params?: { id?: string } | Promise<{ id?: string }> }) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const id = params.id;

    if (!id || !isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "id inválido (UUID requerido)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();

    // Obtener pipeline actual para verificar nombre
    const { data: current, error: currentError } = await supabase
      .from(TABLE)
      .select("nombre, tipo")
      .eq("id", id)
      .maybeSingle();

    if (currentError || !current) {
      return NextResponse.json(
        { data: null, error: "Pipeline no encontrado" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // No permitir eliminar "Nuevo", "Ganado" o "Perdido"
    const nombreLower = (current.nombre ?? "").trim().toLowerCase();
    if (nombreLower === "nuevo" || nombreLower === "ganado" || nombreLower === "perdido") {
      return NextResponse.json(
        { data: null, error: `No se puede eliminar el pipeline "${current.nombre}" (es un pipeline del sistema)` } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verificar si hay leads usando este pipeline
    const { data: leadsUsing, error: leadsError } = await supabase
      .from("leads")
      .select("id")
      .eq("pipeline", current.nombre)
      .limit(1);

    if (leadsError) {
      return NextResponse.json(
        { data: null, error: `Error verificando uso: ${leadsError.message}` } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (leadsUsing && leadsUsing.length > 0) {
      return NextResponse.json(
        { data: null, error: `No se puede eliminar el pipeline "${current.nombre}" porque hay leads que lo están usando. Cambiá el pipeline de esos leads primero.` } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Eliminar pipeline
    const { error } = await supabase.from(TABLE).delete().eq("id", id);

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: { success: true }, error: null } satisfies ApiResp<{ success: boolean }>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
