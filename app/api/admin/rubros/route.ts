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

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("rubros")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data ?? [], error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
