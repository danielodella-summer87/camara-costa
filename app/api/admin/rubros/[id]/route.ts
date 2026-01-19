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

type Rubro = {
  id: string;
  nombre: string;
  activo: boolean;
  created_at?: string;
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

type Ctx = {
  params?: { id?: string } | Promise<{ id?: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanNombre(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

async function getId(ctx: Ctx): Promise<string | null> {
  const p: any = await (ctx?.params instanceof Promise ? ctx.params : ctx?.params);
  const id = p?.id;
  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  return id;
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = await getId(ctx);
    if (!id) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: "ID inválido" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const nombre = body?.nombre !== undefined ? cleanNombre(body.nombre) : null;

    // Traer rubro actual (para rollback si falla la actualización en empresas)
    const current = await supabase
      .from("rubros")
      .select("id,nombre,activo,created_at")
      .eq("id", id)
      .single();

    if (current.error || !current.data) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: current.error?.message ?? "Rubro no encontrado" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Si viene nombre, validar duplicado (excluyendo este id)
    if (nombre) {
      const dup = await supabase
        .from("rubros")
        .select("id")
        .ilike("nombre", nombre)
        .neq("id", id)
        .maybeSingle();

      if (dup?.data?.id) {
        return NextResponse.json<ApiResponse<Rubro>>(
          { data: null, error: "Ya existe otro rubro con ese nombre" },
          { status: 409, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Construir update payload
    const updateData: any = {};
    if (nombre !== null) updateData.nombre = nombre;
    if (body.activo !== undefined && body.activo !== null) {
      updateData.activo = Boolean(body.activo);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: "No hay campos para actualizar" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1) actualizar rubro
    const upd = await supabase
      .from("rubros")
      .update(updateData)
      .eq("id", id)
      .select("id,nombre,activo,created_at")
      .single();

    if (upd.error) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: upd.error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) Si se actualizó el nombre, mantener consistencia en empresas (si guardás rubro como texto también)
    if (nombre && nombre !== current.data.nombre) {
      const updEmp = await supabase
        .from("empresas")
        .update({ rubro: nombre })
        .eq("rubro_id", id);

      if (updEmp.error) {
        // rollback
        await supabase.from("rubros").update({ nombre: current.data.nombre }).eq("id", id);

        return NextResponse.json<ApiResponse<Rubro>>(
          {
            data: null,
            error:
              "No pude actualizar empresas relacionadas (rollback aplicado). Detalle: " +
              updEmp.error.message,
          },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    return NextResponse.json<ApiResponse<Rubro>>(
      { data: upd.data as Rubro, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json<ApiResponse<Rubro>>(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const id = await getId(ctx);
    if (!id) {
      return NextResponse.json<ApiResponse<{ ok: boolean }>>(
        { data: null, error: "ID inválido" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();

    // Bloquear borrado si hay empresas usando este rubro
    const used = await supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("rubro_id", id);

    const count = used.count ?? 0;
    if (count > 0) {
      return NextResponse.json<ApiResponse<{ ok: boolean }>>(
        { data: null, error: `No se puede eliminar: hay ${count} empresa(s) usando este rubro.` },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const del = await supabase.from("rubros").delete().eq("id", id);

    if (del.error) {
      return NextResponse.json<ApiResponse<{ ok: boolean }>>(
        { data: null, error: del.error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json<ApiResponse<{ ok: boolean }>>(
      { data: { ok: true }, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json<ApiResponse<{ ok: boolean }>>(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}