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

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("comerciales")
      .select("id,nombre,email,telefono,activo,created_at,updated_at")
      .order("activo", { ascending: false })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("[Comerciales][GET] supabase error:", error);
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
      });
    }

    return NextResponse.json({ data: data ?? [], error: null } satisfies ApiResp<any>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("[Comerciales][GET] Error:", e);
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, {
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const nombre = cleanStr(body?.nombre);
    const email = cleanStr(body?.email);
    const telefono = cleanStr(body?.telefono);
    const activo = typeof body?.activo === "boolean" ? body.activo : true;

    if (!nombre) {
      return NextResponse.json({ data: null, error: "nombre es obligatorio" } satisfies ApiResp<null>, {
        status: 400,
      });
    }

    const { data, error } = await supabase
      .from("comerciales")
      .insert({
        nombre,
        email: email || null,
        telefono: telefono || null,
        activo,
      })
      .select("id,nombre,email,telefono,activo,created_at,updated_at")
      .single();

    if (error) {
      console.error("[Comerciales][POST] supabase error:", error);
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
      });
    }

    return NextResponse.json({ data, error: null } satisfies ApiResp<any>, { status: 201 });
  } catch (e: any) {
    console.error("[Comerciales][POST] Error:", e);
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, {
      status: 500,
    });
  }
}
