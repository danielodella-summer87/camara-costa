import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isMissingLeadsLinkedinPersonalColumn,
  leadsSelectWithLinkedinVariant,
  shapeLeadRowLinkedinForApi,
} from "@/lib/leads/linkedinLeadFields";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type NextActivityType =
  | "none"
  | "call"
  | "meeting"
  | "proposal"
  | "whatsapp"
  | "email"
  | "followup";

type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;

  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  estado: string | null;
  pipeline: string | null;
  notas: string | null;

  // ✅ nuevos
  rating: number | null;
  next_activity_type: NextActivityType | null;
  next_activity_at: string | null;
  empresa_id: string | null;
  comercial_id: string | null;
  score: number | null;
  score_categoria: string | null;

  comercial?: { id: string; nombre: string } | null;

  // Campos adicionales usados en UI y endpoints
  website?: string | null;
  instagram?: string | null;
  direccion?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  oferta?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  ai_custom_prompt?: string | null;
  ai_report?: string | null;
  ai_report_updated_at?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
  meet_url?: string | null;
  services_count?: number;
};

type LeadsApiResponse = {
  data?: LeadRow[] | null;
  error?: string | null;
};

type LeadApiResponse = {
  data?: LeadRow | null;
  error?: string | null;
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function cleanInt(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function cleanDateToISO(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s.length) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }
  return null;
}

const ALLOWED_ACTIVITY: NextActivityType[] = [
  "none",
  "call",
  "meeting",
  "proposal",
  "whatsapp",
  "email",
  "followup",
];

function cleanActivityType(v: unknown): NextActivityType | null {
  const s = cleanStr(v);
  if (!s) return null;
  const low = s.toLowerCase();
  return (ALLOWED_ACTIVITY as string[]).includes(low)
    ? (low as NextActivityType)
    : null;
}

function isMissingColumnError(message: string | undefined, table: string, column: string): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes(`could not find the '${column.toLowerCase()}' column of '${table.toLowerCase()}'`);
}

const SELECT_WITH_SNAPSHOT =
  "id,created_at,updated_at,nombre,contacto,telefono,email,origen,estado,pipeline,notas,objetivos,audiencia,tamano,website,instagram,direccion,linkedin_empresa,linkedin_personal,ai_report,rating,next_activity_type,next_activity_at,is_member,member_since,empresa_id,comercial_id,score,score_categoria,meet_url,initiative_kind,project_description,proposal_confirmed_at,proposal_sent_at,proposal_doc_url,presentation_doc_url,proposal_reviewed,commercial_stage,commercial_strategy_json,strategy_approved_at,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre)),comerciales:comercial_id(id,nombre)";
const SELECT_LEGACY =
  "id,created_at,updated_at,nombre,contacto,telefono,email,origen,estado,pipeline,notas,objetivos,audiencia,tamano,website,linkedin_empresa,linkedin_personal,ai_report,rating,next_activity_type,next_activity_at,is_member,member_since,empresa_id,comercial_id,score,score_categoria,meet_url,initiative_kind,project_description,proposal_confirmed_at,proposal_sent_at,proposal_doc_url,presentation_doc_url,proposal_reviewed,commercial_stage,commercial_strategy_json,strategy_approved_at,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre)),comerciales:comercial_id(id,nombre)";

type LeadCreateInput = Partial<{
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  estado: string | null;
  pipeline: string | null;
  notas: string | null;
  website: string | null;
  instagram: string | null;
  direccion: string | null;
  objetivos: string | null;
  audiencia: string | null;
  tamano: string | null;
  linkedin_empresa: string | null;
  linkedin_personal: string | null;
  /** Body legacy al crear lead (se mapea a linkedin_personal). */
  linkedin_director?: string | null;
  meet_url: string | null;

  rating: number | string | null;
  next_activity_type: string | null;
  next_activity_at: string | number | null;
  empresa_id: string | null;
  comercial_id: string | null;
  score: number | string | null;
}>;

export async function GET(req: Request) {
  try {
    // Requerir permiso de lectura de leads
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req as any, "leads.read");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies LeadsApiResponse,
        { status: 403 }
      );
    }

    const url = new URL(req.url);

    // Opcional: ?limit=200
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw ?? 500), 1), 2000);

    const supabase = supabaseAdmin();
    
    const { searchParams } = new URL(req.url);
    const pipelineParam = searchParams.get("pipeline");
    const comercialIdParam = searchParams.get("comercial_id")?.trim() ?? null;
    const socioIdParam = searchParams.get("socio_id")?.trim() ?? null;
    const empresaIdParam = searchParams.get("empresa_id")?.trim() ?? null;

    let q = supabase
      .from("leads")
      .select(SELECT_WITH_SNAPSHOT);

    if (pipelineParam && pipelineParam.trim()) {
      q = q.eq("pipeline", pipelineParam.trim());
    }

    if (comercialIdParam) {
      q = q.eq("comercial_id", comercialIdParam);
    }

    if (socioIdParam) {
      q = q.eq("socio_id", socioIdParam);
    }

    if (empresaIdParam) {
      q = q.eq("empresa_id", empresaIdParam);
    }

    let { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error && isMissingLeadsLinkedinPersonalColumn(error.message)) {
      let qLi = supabase
        .from("leads")
        .select(leadsSelectWithLinkedinVariant(SELECT_WITH_SNAPSHOT, "director"));
      if (pipelineParam && pipelineParam.trim()) {
        qLi = qLi.eq("pipeline", pipelineParam.trim());
      }
      if (comercialIdParam) {
        qLi = qLi.eq("comercial_id", comercialIdParam);
      }
      if (socioIdParam) {
        qLi = qLi.eq("socio_id", socioIdParam);
      }
      if (empresaIdParam) {
        qLi = qLi.eq("empresa_id", empresaIdParam);
      }
      const liRes = await qLi.order("created_at", { ascending: false }).limit(limit);
      data = liRes.data as typeof data;
      error = liRes.error;
    }

    if (
      error &&
      (isMissingColumnError(error.message, "leads", "instagram") ||
        isMissingColumnError(error.message, "leads", "direccion"))
    ) {
      let qLegacy = supabase.from("leads").select(SELECT_LEGACY);
      if (pipelineParam && pipelineParam.trim()) {
        qLegacy = qLegacy.eq("pipeline", pipelineParam.trim());
      }
      if (comercialIdParam) {
        qLegacy = qLegacy.eq("comercial_id", comercialIdParam);
      }
      if (socioIdParam) {
        qLegacy = qLegacy.eq("socio_id", socioIdParam);
      }
      if (empresaIdParam) {
        qLegacy = qLegacy.eq("empresa_id", empresaIdParam);
      }
      // Tipado laxo: el segundo intento usa otro .select() y Postgrest infiere tipos distintos.
      let legacyRes: any = await qLegacy.order("created_at", { ascending: false }).limit(limit);
      if (legacyRes.error && isMissingLeadsLinkedinPersonalColumn(legacyRes.error.message)) {
        let qLegLi = supabase
          .from("leads")
          .select(leadsSelectWithLinkedinVariant(SELECT_LEGACY, "director"));
        if (pipelineParam && pipelineParam.trim()) {
          qLegLi = qLegLi.eq("pipeline", pipelineParam.trim());
        }
        if (comercialIdParam) {
          qLegLi = qLegLi.eq("comercial_id", comercialIdParam);
        }
        if (socioIdParam) {
          qLegLi = qLegLi.eq("socio_id", socioIdParam);
        }
        if (empresaIdParam) {
          qLegLi = qLegLi.eq("empresa_id", empresaIdParam);
        }
        legacyRes = await qLegLi.order("created_at", { ascending: false }).limit(limit);
      }
      data = (legacyRes.data ?? []).map((row: any) => ({
        ...row,
        instagram: row?.instagram ?? null,
        direccion: row?.direccion ?? null,
      })) as any;
      error = legacyRes.error;
    }

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadsApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const leadIds = (data ?? []).map((l: any) => l.id).filter(Boolean);
    let servicesCountByLeadId: Record<string, number> = {};
    if (leadIds.length > 0) {
      const { data: countRows } = await supabase
        .from("lead_service_proposals")
        .select("lead_id")
        .in("lead_id", leadIds);
      const counts: Record<string, number> = {};
      for (const row of countRows ?? []) {
        const lid = (row as { lead_id?: string }).lead_id;
        if (lid) counts[lid] = (counts[lid] ?? 0) + 1;
      }
      servicesCountByLeadId = counts;
    }

    /** Próxima fila pendiente en socio_acciones por lead (misma fuente que Agenda). */
    const pendingAgendaByLeadId: Record<string, { tipo: string; fecha_limite: string; hora: string | null }> =
      {};
    if (leadIds.length > 0) {
      const { data: pendRows, error: pendErr } = await supabase
        .from("socio_acciones")
        .select("lead_id,tipo,fecha_limite,hora,created_at")
        .in("lead_id", leadIds)
        .is("realizada_at", null)
        .not("fecha_limite", "is", null)
        .not("lead_id", "is", null);

      if (!pendErr && pendRows?.length) {
        type PendRow = {
          lead_id?: string | null;
          tipo?: string | null;
          fecha_limite?: string | null;
          hora?: string | null;
          created_at?: string | null;
        };
        const byLead = new Map<string, PendRow[]>();
        for (const raw of pendRows as PendRow[]) {
          const lid = raw.lead_id ? String(raw.lead_id) : "";
          if (!lid) continue;
          const arr = byLead.get(lid) ?? [];
          arr.push(raw);
          byLead.set(lid, arr);
        }
        for (const [lid, rows] of byLead) {
          const sorted = [...rows].sort((a, b) => {
            const fa = String(a.fecha_limite ?? "");
            const fb = String(b.fecha_limite ?? "");
            if (fa !== fb) return fa.localeCompare(fb);
            const ha = String(a.hora ?? "00:00");
            const hb = String(b.hora ?? "00:00");
            if (ha !== hb) return ha.localeCompare(hb);
            return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
          });
          const first = sorted[0];
          const fl = String(first.fecha_limite ?? "").trim();
          if (!fl) continue;
          pendingAgendaByLeadId[lid] = {
            tipo: String(first.tipo ?? ""),
            fecha_limite: fl,
            hora: first.hora != null && String(first.hora).trim() ? String(first.hora).trim() : null,
          };
        }
      }
    }

    type FlowDocSlot = { diagnostic?: string; strategy?: string; proposal?: string; presentation?: string };
    const flowDocsByLeadId: Record<string, FlowDocSlot> = {};
    if (leadIds.length > 0) {
      const { data: docRows, error: docErr } = await supabase
        .from("lead_documents")
        .select("lead_id,type,url")
        .eq("is_current", true)
        .in("lead_id", leadIds);
      if (!docErr && docRows) {
        for (const raw of docRows) {
          const row = raw as { lead_id?: string; type?: string; url?: string };
          const lid = row.lead_id;
          const t = row.type;
          const u = typeof row.url === "string" ? row.url.trim() : "";
          if (!lid || !t || !u) continue;
          if (t !== "diagnostic" && t !== "strategy" && t !== "proposal" && t !== "presentation") continue;
          if (!flowDocsByLeadId[lid]) flowDocsByLeadId[lid] = {};
          const slot = flowDocsByLeadId[lid];
          if (t === "diagnostic") slot.diagnostic = u;
          else if (t === "strategy") slot.strategy = u;
          else if (t === "proposal") slot.proposal = u;
          else slot.presentation = u;
        }
      }
    }

    const normalizedData = (data ?? []).map((lead: any) => {
      const shaped = shapeLeadRowLinkedinForApi(lead as Record<string, unknown>);
      const pipelineStr =
        typeof shaped.pipeline === "string" && shaped.pipeline.trim() ? shaped.pipeline.trim() : "";
      const etapaDb =
        typeof lead.etapa_actual === "string" && lead.etapa_actual.trim() ? lead.etapa_actual.trim() : "";
      return {
        ...shaped,
        etapa_actual: etapaDb || pipelineStr || null,
        comercial: Array.isArray(lead.comerciales)
          ? lead.comerciales[0] ?? null
          : lead.comerciales ?? null,
        comerciales: undefined,
        services_count: servicesCountByLeadId[lead.id] ?? 0,
        flow_documents: flowDocsByLeadId[lead.id] ?? {},
        pending_agenda_accion: pendingAgendaByLeadId[lead.id] ?? null,
      };
    });

    return NextResponse.json(
      { data: normalizedData as unknown as LeadRow[], error: null } satisfies LeadsApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadsApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Requerir permiso de creación de leads
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req as any, "leads.write");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies LeadApiResponse,
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as LeadCreateInput;

    // ✅ nombre obligatorio (evita leads vacíos)
    const nombre = cleanStr(body.nombre);
    if (!nombre) {
      return NextResponse.json(
        { data: null, error: "El nombre es obligatorio." } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ default pipeline
    const pipeline = cleanStr(body.pipeline) ?? "Nuevo";

    // rating
    const ratingParsed = body.rating === undefined ? undefined : cleanInt(body.rating);
    if (ratingParsed !== undefined) {
      if (ratingParsed !== null && (ratingParsed < 0 || ratingParsed > 5)) {
        return NextResponse.json(
          { data: null, error: "rating inválido (0 a 5)" } satisfies LeadApiResponse,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // activity type
    const activityParsed =
      body.next_activity_type === undefined
        ? undefined
        : cleanActivityType(body.next_activity_type);

    if (activityParsed !== undefined) {
      const raw = body.next_activity_type;
      const rawStr = typeof raw === "string" ? raw.trim() : null;
      if (rawStr && rawStr.length && activityParsed === null) {
        return NextResponse.json(
          {
            data: null,
            error:
              "next_activity_type inválido (none|call|meeting|proposal|whatsapp|email|followup)",
          } satisfies LeadApiResponse,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // activity at
    const nextAtParsed =
      body.next_activity_at === undefined ? undefined : cleanDateToISO(body.next_activity_at);

    if (nextAtParsed !== undefined) {
      const raw = body.next_activity_at;
      const rawHasValue =
        (typeof raw === "string" && raw.trim().length) ||
        (typeof raw === "number" && Number.isFinite(raw));
      if (rawHasValue && nextAtParsed === null) {
        return NextResponse.json(
          { data: null, error: "next_activity_at inválido (fecha/hora)" } satisfies LeadApiResponse,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Validar empresa_id si viene (debe ser UUID válido o null)
    const empresaId = body.empresa_id === null || body.empresa_id === undefined 
      ? null 
      : (typeof body.empresa_id === "string" && body.empresa_id.trim().length > 0 
          ? body.empresa_id.trim() 
          : null);

    // Validar comercial_id si viene (debe ser UUID válido o null)
    const comercialId = body.comercial_id === null || body.comercial_id === undefined 
      ? null 
      : (typeof body.comercial_id === "string" && body.comercial_id.trim().length > 0 
          ? body.comercial_id.trim() 
          : null);

    // Validar score (0-10 o null)
    const scoreParsed = body.score === null || body.score === undefined 
      ? null 
      : cleanInt(body.score);
    if (scoreParsed !== null && (scoreParsed < 0 || scoreParsed > 10)) {
      return NextResponse.json(
        { data: null, error: "score inválido (debe ser 0-10 o null)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validar meet_url (opcional, pero si viene debe ser string válido)
    const meetUrlRaw = body.meet_url === null || body.meet_url === undefined 
      ? null 
      : cleanStr(body.meet_url);
    
    // Validación opcional: si viene meet_url, verificar que empiece con https://meet.google.com/
    if (meetUrlRaw !== null && !meetUrlRaw.startsWith("https://meet.google.com/")) {
      return NextResponse.json(
        { data: null, error: "meet_url debe empezar con https://meet.google.com/" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const insert: Partial<LeadRow> = {
      nombre,
      contacto: cleanStr(body.contacto),
      telefono: cleanStr(body.telefono),
      email: cleanStr(body.email),
      origen: cleanStr(body.origen),
      estado: cleanStr(body.estado),
      pipeline,
      notas: cleanStr(body.notas),
      website: cleanStr(body.website),
      instagram: cleanStr(body.instagram),
      direccion: cleanStr(body.direccion),
      objetivos: cleanStr(body.objetivos),
      audiencia: cleanStr(body.audiencia),
      tamano: cleanStr(body.tamano),
      linkedin_empresa: cleanStr(body.linkedin_empresa),
      linkedin_personal: cleanStr(body.linkedin_personal) ?? cleanStr(body.linkedin_director),
      meet_url: meetUrlRaw,

      rating: ratingParsed ?? 0,
      next_activity_type: activityParsed ?? null,
      next_activity_at: nextAtParsed ?? null,
      empresa_id: empresaId,
      comercial_id: comercialId,
      score: scoreParsed,

      updated_at: new Date().toISOString(),
    };

    const supabase = supabaseAdmin();
    let { data, error } = await supabase
      .from("leads")
      .insert(insert)
      .select(SELECT_WITH_SNAPSHOT)
      .maybeSingle();
    if (
      error &&
      (isMissingColumnError(error.message, "leads", "instagram") ||
        isMissingColumnError(error.message, "leads", "direccion"))
    ) {
      const fallbackInsert = { ...insert };
      delete (fallbackInsert as { instagram?: string | null }).instagram;
      delete (fallbackInsert as { direccion?: string | null }).direccion;
      const legacyRes = await supabase
        .from("leads")
        .insert(fallbackInsert)
        .select(SELECT_LEGACY)
        .maybeSingle();
      data = legacyRes.data
        ? ({
            ...(legacyRes.data as any),
            instagram: (legacyRes.data as any)?.instagram ?? null,
            direccion: (legacyRes.data as any)?.direccion ?? null,
          } as any)
        : null;
      error = legacyRes.error;
    }

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? null) as LeadRow | null, error: null } satisfies LeadApiResponse,
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}