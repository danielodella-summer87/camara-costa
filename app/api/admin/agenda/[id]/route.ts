import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error desconocido";
  }
}

/**
 * DELETE /api/admin/agenda/:id
 * Borra una actividad (socio_acciones) por id
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta id" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const { error } = await supabase.from("socio_acciones").delete().eq("id", id);

    if (error) {
      console.error("[Agenda][DELETE] supabase error:", error);
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: { ok: true }, error: null } satisfies ApiResp<{ ok: true }>,
      { status: 200 }
    );
  } catch (e: unknown) {
    console.error("[Agenda][DELETE] Error:", e);
    return NextResponse.json(
      { data: null, error: toErrorMessage(e) } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
