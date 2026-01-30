import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data: T | null; error: string | null };

function cleanStr(v: unknown) {
  return typeof v === "string" ? v.trim() : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ data: null, error: "Falta id" } satisfies ApiResp<null>, {
        status: 400,
      });
    }

    const body = await req.json().catch(() => ({}));

    const patch: any = {};
    const nombre = cleanStr(body?.nombre);
    const email = cleanStr(body?.email);
    const telefono = cleanStr(body?.telefono);

    if (nombre !== null) patch.nombre = nombre;
    if (body?.email !== undefined) patch.email = email || null;
    if (body?.telefono !== undefined) patch.telefono = telefono || null;
    if (typeof body?.activo === "boolean") patch.activo = body.activo;

    if (!patch.nombre) {
      // si mandó nombre vacío, rechazamos
      if (body?.nombre !== undefined) {
        return NextResponse.json({ data: null, error: "nombre es obligatorio" } satisfies ApiResp<null>, {
          status: 400,
        });
      }
      // si no mandó nombre, ok
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("comerciales")
      .update(patch)
      .eq("id", id)
      .select("id,nombre,email,telefono,activo,created_at,updated_at")
      .single();

    if (error) {
      console.error("[Comerciales][PATCH] supabase error:", error);
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
      });
    }

    return NextResponse.json({ data, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    console.error("[Comerciales][PATCH] Error:", e);
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, {
      status: 500,
    });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ data: null, error: "Falta id" } satisfies ApiResp<null>, {
        status: 400,
      });
    }

    const { error } = await supabase.from("comerciales").delete().eq("id", id);

    if (error) {
      console.error("[Comerciales][DELETE] supabase error:", error);
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
      });
    }

    return NextResponse.json({ data: { ok: true }, error: null } satisfies ApiResp<{ ok: true }>, {
      status: 200,
    });
  } catch (e: any) {
    console.error("[Comerciales][DELETE] Error:", e);
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, {
      status: 500,
    });
  }
}
