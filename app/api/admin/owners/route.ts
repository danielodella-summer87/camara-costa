import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type OwnerType = "lead" | "socio";

type OwnerOption = {
  id: string;
  owner_type: OwnerType;
  label: string;
  subtitle?: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("query") ?? "").trim();
    const ownerType = (searchParams.get("owner_type") ?? "lead") as OwnerType;
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

    if (!q) return NextResponse.json({ data: [], error: null }, { status: 200 });

    if (ownerType === "lead") {
      const { data, error } = await supabase
        .from("leads")
        .select("id,nombre,email,telefono")
        .or(`nombre.ilike.%${q}%,email.ilike.%${q}%,telefono.ilike.%${q}%`)
        .order("nombre", { ascending: true })
        .limit(limit);

      if (error) throw error;

      const out: OwnerOption[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        owner_type: "lead",
        label: r.nombre ? String(r.nombre) : "(Sin nombre)",
        subtitle: r.email ?? r.telefono ?? null,
      }));

      return NextResponse.json({ data: out, error: null }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("socios")
      .select("id,nombre,email,telefono,codigo")
      .or(`nombre.ilike.%${q}%,email.ilike.%${q}%,telefono.ilike.%${q}%,codigo.ilike.%${q}%`)
      .order("nombre", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const out: OwnerOption[] = (data ?? []).map((r: any) => ({
      id: String(r.id),
      owner_type: "socio",
      label: r.nombre ? String(r.nombre) : "(Sin nombre)",
      subtitle: r.codigo ?? r.email ?? r.telefono ?? null,
    }));

    return NextResponse.json({ data: out, error: null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error buscando owners" },
      { status: 500 }
    );
  }
}
