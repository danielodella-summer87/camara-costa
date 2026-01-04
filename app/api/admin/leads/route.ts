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
  contacto: string | null; // ✅ NUEVO
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
};

type LeadsApiResponse = {
  data?: LeadRow[] | null;
  error?: string | null;
};

type LeadApiResponse = {
  data?: LeadRow | null;
  error?: string | null;
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("leads")
      .select("id,created_at,updated_at,nombre,contacto,telefono,email,origen,pipeline,notas")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadsApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? []) as LeadRow[], error: null } satisfies LeadsApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadsApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

type LeadCreateInput = {
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  origen?: string | null;
  pipeline?: string | null;
  notas?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as LeadCreateInput;

    // ✅ REGLA A: nombre obligatorio (evita leads vacíos por curl/UI)
    const nombre = cleanStr(body.nombre);
    if (!nombre) {
      return NextResponse.json(
        { data: null, error: "El nombre es obligatorio." } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ DEFAULT A: si no mandan pipeline, usamos "Nuevo"
    const pipeline = cleanStr(body.pipeline) ?? "Nuevo";

    const insert = {
      nombre,
      contacto: cleanStr(body.contacto),
      telefono: cleanStr(body.telefono),
      email: cleanStr(body.email),
      origen: cleanStr(body.origen),
      pipeline,
      notas: cleanStr(body.notas),
    };

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("leads")
      .insert(insert)
      .select("id,created_at,updated_at,nombre,contacto,telefono,email,origen,pipeline,notas")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? null) as LeadRow | null, error: null } satisfies LeadApiResponse,
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}