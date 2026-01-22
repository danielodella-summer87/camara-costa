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
 * POST /api/admin/meet-sessions/:sessionId/transcribe
 * Transcribe audio usando Deepgram y guarda el resultado como evento.
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

    // Validar DEEPGRAM_API_KEY
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { data: null, error: "DEEPGRAM_API_KEY no configurada" } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Leer body como ArrayBuffer
    const audioBuffer = await req.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json(
        { data: null, error: "Body vacío o inválido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Obtener Content-Type del request (o usar default)
    const contentType = req.headers.get("content-type") || "audio/wav";

    // Llamar a Deepgram
    const deepgramUrl = "https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true";
    const deepgramRes = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        "Content-Type": contentType,
      },
      body: audioBuffer,
    });

    if (!deepgramRes.ok) {
      const errorText = await deepgramRes.text().catch(() => "Error desconocido");
      return NextResponse.json(
        { data: null, error: `Deepgram error: ${deepgramRes.status} ${errorText}` } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Parsear respuesta de Deepgram
    const deepgramData = await deepgramRes.json().catch(() => null);
    if (!deepgramData) {
      return NextResponse.json(
        { data: null, error: "Error parseando respuesta de Deepgram" } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Extraer transcript y confidence
    // Estructura típica: { results: { channels: [{ alternatives: [{ transcript, confidence }] }] } }
    let text = "";
    let confidence: number | null = null;

    try {
      const results = deepgramData.results;
      if (results?.channels?.[0]?.alternatives?.[0]) {
        const alt = results.channels[0].alternatives[0];
        text = alt.transcript || "";
        confidence = typeof alt.confidence === "number" ? alt.confidence : null;
      }
    } catch (e) {
      // Si falla el parseo, intentar extraer texto de otra forma
      console.error("Error parseando respuesta Deepgram:", e);
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { data: null, error: "No se pudo extraer transcript del audio" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Insertar evento en lead_meet_events
    const { data: event, error: insertErr } = await sb
      .from("lead_meet_events")
      .insert({
        meet_session_id: sessionId,
        type: "transcript",
        reason: "deepgram",
        payload: {
          text: text.trim(),
          confidence,
          is_final: true,
          source: "mic",
        },
        event_at: new Date().toISOString(),
      })
      .select("id, meet_session_id, type, reason, payload, event_at, created_at")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { data: null, error: insertErr.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Responder con éxito
    return NextResponse.json(
      { data: { text: text.trim(), confidence }, error: null } satisfies ApiResp<{ text: string; confidence: number | null }>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
