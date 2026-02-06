import { NextRequest, NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MEETING_TYPES = ["descubrimiento", "propuesta", "cierre"] as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function isUuid(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * GET /api/admin/reuniones/sessions?leadId=<uuid>&type=descubrimiento|propuesta|cierre&limit=50
 * Lista últimas N sesiones del lead. Auth: sesión interna.
 */
export async function GET(req: NextRequest) {
  const userId = await getInternalUserIdFromRequest();
  if (!userId) {
    return NextResponse.json(
      { data: null, error: "No autorizado" } satisfies ApiResp<null>,
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const url = new URL(req.url);
    const leadId =
      (url.searchParams.get("leadId") ?? url.searchParams.get("lead_id") ?? "").trim();
    const type = url.searchParams.get("type")?.trim() ?? "";
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(
      Math.max(1, parseInt(limitRaw ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT
    );

    if (!leadId) {
      return NextResponse.json(
        { data: null, error: "leadId requerido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUuid(leadId)) {
      return NextResponse.json(
        { data: null, error: "leadId inválido (UUID)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (type && !MEETING_TYPES.includes(type as (typeof MEETING_TYPES)[number])) {
      return NextResponse.json(
        { data: null, error: "type debe ser descubrimiento, propuesta o cierre" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    let q = supabaseServer
      .from("lead_meeting_sessions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type) {
      q = q.eq("meeting_type", type);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const list = Array.isArray(data) ? data : [];
    return NextResponse.json(
      { data: list, error: null } satisfies ApiResp<unknown[]>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json(
      { data: null, error: msg } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
