import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function safeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function isUuidLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * GET /api/admin/meet-sessions/:sessionId
 * Devuelve una sesión individual por su ID.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { sessionId: rawSessionId } = await context.params;

    const sessionId = safeStr(rawSessionId);
    if (!sessionId) {
      return NextResponse.json(
        { data: null, error: "sessionId requerido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isUuidLike(sessionId)) {
      return NextResponse.json(
        { data: null, error: "sessionId inválido (UUID)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: session, error } = await sb
      .from("lead_meet_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!session) {
      return NextResponse.json(
        { data: null, error: "Sesión no encontrada" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: session, error: null } satisfies ApiResp<any>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
