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

function cleanNombre(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // trim + colapsar espacios internos
  const s = v.trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("rubros")
      .select("id,nombre,activo,created_at")
      .order("nombre", { ascending: true });

    if (error) {
      return NextResponse.json<ApiResponse<Rubro[]>>(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json<ApiResponse<Rubro[]>>(
      { data: (data ?? []) as Rubro[], error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json<ApiResponse<Rubro[]>>(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const nombre = cleanNombre(body?.nombre);

    if (!nombre) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: "Falta 'nombre' (string)" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // evitar duplicados exactos (case-insensitive)
    const dup = await supabase
      .from("rubros")
      .select("id")
      .ilike("nombre", nombre)
      .maybeSingle();

    if (dup?.data?.id) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: "Ya existe un rubro con ese nombre" },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await supabase
      .from("rubros")
      .insert({ nombre, activo: true })
      .select("id,nombre,activo,created_at")
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<Rubro>>(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json<ApiResponse<Rubro>>(
      { data: data as Rubro, error: null },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json<ApiResponse<Rubro>>(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}