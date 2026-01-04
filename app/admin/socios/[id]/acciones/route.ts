import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

type Params = { id: string };

export async function GET(_req: NextRequest, ctx: { params: Params | Promise<Params> }) {
  const { id } = await Promise.resolve(ctx.params);
  const socioId = (id ?? "").toString();

  if (!socioId) {
    return NextResponse.json(
      { data: [], error: "Missing socio id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("socio_acciones")
    .select("id,socio_id,tipo,nota,realizada_at,creada_por")
    .eq("socio_id", socioId)
    .order("realizada_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { data: [], error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { data, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}