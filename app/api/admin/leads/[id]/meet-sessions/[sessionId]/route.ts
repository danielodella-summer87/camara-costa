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
 * GET /api/admin/leads/:id/meet-sessions/:sessionId
 * Devuelve una sesión específica validando que pertenece al lead.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId, sessionId: rawSessionId } = await context.params;

    const leadId = safeStr(rawId);
    if (!leadId) {
      return NextResponse.json(
        { data: null, error: "id requerido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isUuidLike(leadId)) {
      return NextResponse.json(
        { data: null, error: "id inválido (UUID)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

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

    // Consultar sesión validando que pertenece al lead
    const { data: session, error } = await sb
      .from("lead_meet_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("lead_id", leadId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!session) {
      return NextResponse.json(
        { data: null, error: "Sesión no encontrada o no pertenece al lead" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: session, error: null } satisfies ApiResp<any>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error("Error desconocido");
    return NextResponse.json(
      { data: null, error: error.message } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
