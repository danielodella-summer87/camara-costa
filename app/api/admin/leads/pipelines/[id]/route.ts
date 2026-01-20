import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// UUID “suave” (8-4-4-4-12)
function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type PipelineRow = {
  id: string;
  label: string | null;
  sort: number | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// Ajustá el nombre si tu tabla se llama distinto.
// (En el resto del proyecto venimos usando “lead_*”)
const TABLE = "lead_pipelines";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pipelineId = (id ?? "").trim();

    if (!pipelineId) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!isUuidLike(pipelineId)) {
      return NextResponse.json({ data: null, error: "Id inválido (UUID)" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb.from(TABLE).select("*").eq("id", pipelineId).single();
    if (error) throw error;

    return NextResponse.json({ data: data as PipelineRow, error: null } satisfies ApiResp<PipelineRow>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}