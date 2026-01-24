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
    // Logs al inicio del handler
    console.log("[transcribe] method:", req.method);
    console.log("[transcribe] content-type:", req.headers.get("content-type"));
    console.log("[transcribe] content-length:", req.headers.get("content-length"));
    console.log("[transcribe] user-agent:", req.headers.get("user-agent"));

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
    if (!deepgramApiKey || deepgramApiKey.trim().length === 0) {
      return NextResponse.json(
        { 
          data: null, 
          error: "DEEPGRAM_API_KEY no configurada. Por favor, configura la variable de entorno DEEPGRAM_API_KEY en .env.local (local) o en las variables de entorno de Vercel (producción)." 
        } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // DEBUG TRANSCRIBE: Logs de diagnóstico en servidor antes de procesar
    const contentTypeHeader = req.headers.get("content-type");
    const contentLengthHeader = req.headers.get("content-length");
    console.log("[DEBUG TRANSCRIBE SERVER] Headers recibidos:", {
      "content-type": contentTypeHeader,
      "content-length": contentLengthHeader,
      "user-agent": req.headers.get("user-agent"),
    });

    // Leer body como ArrayBuffer
    const audioBuffer = await req.arrayBuffer();
    
    // Log tamaño real recibido (justo después de leer el buffer)
    console.log("[transcribe] buffer byteLength:", audioBuffer.byteLength);
    
    // DEBUG TRANSCRIBE: Log del buffer recibido
    console.log("[DEBUG TRANSCRIBE SERVER] Buffer recibido:", {
      byteLength: audioBuffer.byteLength,
      sizeKB: (audioBuffer.byteLength / 1024).toFixed(2),
      sizeMB: (audioBuffer.byteLength / (1024 * 1024)).toFixed(2),
      isEmpty: audioBuffer.byteLength === 0,
    });

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.error("[DEBUG TRANSCRIBE SERVER] Error: Body vacío o inválido");
      return NextResponse.json(
        { data: null, error: "Body vacío o inválido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // DEBUG TRANSCRIBE: Validación de tamaño mínimo
    if (audioBuffer.byteLength < 2000) {
      const errorMsg = `Audio demasiado corto: ${audioBuffer.byteLength} bytes. Se requiere al menos 2000 bytes.`;
      console.error("[DEBUG TRANSCRIBE SERVER]", errorMsg);
      return NextResponse.json(
        { data: null, error: errorMsg } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Obtener Content-Type del request (o usar default)
    const contentType = contentTypeHeader || "audio/wav";
    
    // DEBUG TRANSCRIBE: Log del contentType que se usará
    console.log("[DEBUG TRANSCRIBE SERVER] ContentType a usar:", contentType);

    // DEBUG TRANSCRIBE: Log antes de llamar a Deepgram
    console.log("[DEBUG TRANSCRIBE SERVER] Enviando a Deepgram:", {
      url: "https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true",
      bufferSize: audioBuffer.byteLength,
      bufferSizeKB: (audioBuffer.byteLength / 1024).toFixed(2),
      contentType: contentType,
      hasApiKey: !!deepgramApiKey,
      apiKeyLength: deepgramApiKey?.length || 0,
    });

    // Logs justo antes de llamar a Deepgram
    console.log("[transcribe] buffer.length (byteLength):", audioBuffer.byteLength);
    console.log("[transcribe] tipo final enviando:", contentType);
    console.log("[transcribe] enviando bytes (ArrayBuffer):", audioBuffer instanceof ArrayBuffer);

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

    // DEBUG TRANSCRIBE: Log respuesta de Deepgram
    console.log("[DEBUG TRANSCRIBE SERVER] Respuesta de Deepgram:", {
      ok: deepgramRes.ok,
      status: deepgramRes.status,
      statusText: deepgramRes.statusText,
      headers: Object.fromEntries(deepgramRes.headers.entries()),
    });

    if (!deepgramRes.ok) {
      const errorText = await deepgramRes.text().catch(() => "Error desconocido");
      console.error("[DEBUG TRANSCRIBE SERVER] Error de Deepgram:", {
        status: deepgramRes.status,
        statusText: deepgramRes.statusText,
        errorText: errorText.substring(0, 500), // Limitar a 500 chars para no saturar logs
      });
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
    console.error("[transcribe] ERROR:", e);
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
