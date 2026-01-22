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
 * GET /api/admin/meet-sessions/:sessionId/events
 * Devuelve los eventos de una sesión.
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

    const { data: events, error } = await sb
      .from("lead_meet_events")
      .select("id, meet_session_id, type, reason, payload, event_at, created_at")
      .eq("meet_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: events ?? [], error: null } satisfies ApiResp<any[]>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/meet-sessions/:sessionId/events
 * Crea un nuevo evento para la sesión.
 */
export async function POST(
  req: NextRequest,
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

    // Validar que la sesión existe
    const { data: session, error: sessionErr } = await sb
      .from("lead_meet_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionErr) {
      return NextResponse.json(
        { data: null, error: sessionErr.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!session) {
      return NextResponse.json(
        { data: null, error: "Sesión no encontrada" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Parsear body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { data: null, error: "Body JSON inválido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validar type requerido
    const type = safeStr(body.type);
    if (!type) {
      return NextResponse.json(
        { data: null, error: "type requerido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validar que type sea uno de los valores permitidos
    if (!["signal", "note", "action"].includes(type)) {
      return NextResponse.json(
        { data: null, error: "type debe ser 'signal', 'note' o 'action'" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const reason = safeStr(body.reason) || null;
    const payload = body.payload && typeof body.payload === "object" ? body.payload : null;
    
    // event_at: si viene, validar ISO; si no, usar now()
    let eventAt: string;
    if (body.event_at && typeof body.event_at === "string") {
      const parsed = new Date(body.event_at);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { data: null, error: "event_at debe ser una fecha ISO válida" } satisfies ApiResp<null>,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      eventAt = parsed.toISOString();
    } else {
      eventAt = new Date().toISOString();
    }

    // Insertar evento
    const { data: event, error: insertErr } = await sb
      .from("lead_meet_events")
      .insert({
        meet_session_id: sessionId,
        type,
        reason,
        payload,
        event_at: eventAt,
      })
      .select("id, meet_session_id, type, reason, payload, event_at, created_at")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { data: null, error: insertErr.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: event, error: null } satisfies ApiResp<any>,
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
