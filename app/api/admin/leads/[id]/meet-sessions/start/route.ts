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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadIdRaw } = await params;
    const leadId = safeStr(leadIdRaw);

    if (!leadId) {
      return NextResponse.json(
        { data: null, error: "Falta id" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isUuidLike(leadId)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (UUID)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const meet_url = safeStr(body?.meet_url);

    if (!meet_url) {
      return NextResponse.json(
        { data: null, error: "meet_url es requerido" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sb = supabaseAdmin();

    // Verificar que existe el lead
    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr) {
      return NextResponse.json(
        { data: null, error: leadErr.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { data: null, error: "Lead no encontrado" } satisfies ApiResp<null>,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Crear la sesión (status active)
    const { data: session, error: insErr } = await sb
      .from("lead_meet_sessions")
      .insert({
        lead_id: leadId,
        meet_url,
        status: "active",
      })
      .select("*")
      .maybeSingle();

    if (insErr) {
      return NextResponse.json(
        { data: null, error: insErr.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!session) {
      return NextResponse.json(
        { data: null, error: "No se pudo crear la sesión" } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1) evento inicial: semáforo en verde
    const { error: eventErr } = await sb
      .from("lead_meet_events")
      .insert({
        meet_session_id: session.id,
        type: "signal",
        reason: "inicio_sesion",
        payload: {
          signal: "green",
          title: "Inicio de sesión",
          detail: "Semáforo inicia en verde",
        },
        event_at: new Date().toISOString(),
      });

    // Si falla el insert del evento, logueamos pero no fallamos la creación de la sesión
    if (eventErr) {
      console.error("Error creando evento inicial de meet:", eventErr);
      // Continuamos igual, la sesión ya está creada
    }

    return NextResponse.json(
      { data: session, error: null } satisfies ApiResp<any>,
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}