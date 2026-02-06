import { NextRequest, NextResponse } from "next/server";
import { getAppUserFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MEETING_TYPES = ["descubrimiento", "propuesta", "cierre"] as const;

function isUuid(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type CreateSessionPayload = {
  lead_id: string;
  meeting_type: string;
  emotional_state?: string | null;
  conviction?: string | null;
  next_objective?: string | null;
  checklist_state?: Record<string, unknown> | null;
  log?: unknown[] | null;
};

/**
 * POST /api/admin/reuniones/sessions/create
 * Crea una nueva sesión. Auth: sesión interna. created_by = app_users.id.
 */
export async function POST(req: NextRequest) {
  const appUser = await getAppUserFromRequest();
  if (!appUser) {
    return NextResponse.json(
      { data: null, error: "No autorizado" } satisfies ApiResp<null>,
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateSessionPayload;
  const leadId = safeStr(body.lead_id);
  const meetingType = safeStr(body.meeting_type);

  if (!leadId) {
    return NextResponse.json(
      { data: null, error: "lead_id requerido" } satisfies ApiResp<null>,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!isUuid(leadId)) {
    return NextResponse.json(
      { data: null, error: "lead_id inválido (UUID)" } satisfies ApiResp<null>,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!meetingType || !MEETING_TYPES.includes(meetingType as (typeof MEETING_TYPES)[number])) {
    return NextResponse.json(
      { data: null, error: "meeting_type debe ser descubrimiento, propuesta o cierre" } satisfies ApiResp<null>,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const createdBy = appUser.id;

  // Validar que existe el lead
  const { data: lead, error: leadErr } = await supabaseServer
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) {
    return NextResponse.json(
      { data: null, error: leadErr.message } satisfies ApiResp<null>,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!lead?.id) {
    return NextResponse.json(
      { data: null, error: "Lead no encontrado" } satisfies ApiResp<null>,
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const emotionalState = safeStr(body.emotional_state);
  const conviction = safeStr(body.conviction);
  const nextObjective = safeStr(body.next_objective);
  const checklistState =
    body.checklist_state != null && typeof body.checklist_state === "object" ? body.checklist_state : {};
  const log = Array.isArray(body.log) ? body.log : [];

  const { data, error } = await supabaseServer
    .from("lead_meeting_sessions")
    .insert({
      lead_id: leadId,
      meeting_type: meetingType,
      emotional_state: emotionalState ?? null,
      conviction: conviction ?? null,
      next_objective: nextObjective ?? null,
      checklist_state: checklistState ?? {},
      log: log ?? [],
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message } satisfies ApiResp<null>,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { data, error: null } satisfies ApiResp<typeof data>,
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
