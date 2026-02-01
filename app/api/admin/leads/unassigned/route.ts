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

export async function GET(req: NextRequest) {
  try {
    // ✅ Solo admin: usá tu sistema actual de permisos
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req as any, "config.admin");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const sb = supabaseAdmin();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 500);

    // Traer leads sin comercial
    const { data, error } = await sb
      .from("leads")
      .select("id,nombre,created_at,empresa_id,empresas:empresa_id(id,nombre)")
      .is("comercial_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? []), error: null } satisfies ApiResp<any[]>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
