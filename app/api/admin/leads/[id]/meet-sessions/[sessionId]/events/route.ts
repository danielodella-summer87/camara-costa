import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ApiResp<T> = { data: T | null; error: string | null };

function json<T>(data: ApiResp<T>, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error("Faltan env vars: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: leadId, sessionId } = await context.params;

    if (!isUuidLike(leadId)) return json({ data: null, error: "Id inválido (UUID)" }, 400);
    if (!isUuidLike(sessionId)) return json({ data: null, error: "sessionId inválido (UUID)" }, 400);

    const supabase = supabaseAdmin();

    // Seguridad lógica: validar que la sesión pertenece al lead
    const { data: session, error: sErr } = await supabase
      .from("lead_meet_sessions")
      .select("id, lead_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sErr) return json({ data: null, error: sErr.message }, 500);
    if (!session) return json({ data: null, error: "Sesión no encontrada" }, 404);
    if (session.lead_id !== leadId) return json({ data: null, error: "Sesión no pertenece al lead" }, 403);

    const { data, error } = await supabase
      .from("lead_meet_events")
      .select("id, meet_session_id, type, reason, payload, event_at, created_at")
      .eq("meet_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) return json({ data: null, error: error.message }, 500);

    return json({ data: data ?? [], error: null }, 200);
  } catch (e: any) {
    return json({ data: null, error: e?.message ?? "Error inesperado" }, 500);
  }
}