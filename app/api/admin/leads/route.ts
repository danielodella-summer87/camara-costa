import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  score: number | null;
  score_categoria: string | null;
  
  // Campos adicionales usados en UI y endpoints
  website?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  oferta?: string | null;
  linkedin_empresa?: string | null;
  linkedin_director?: string | null;
  ai_custom_prompt?: string | null;
  ai_report?: string | null;
  ai_report_updated_at?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
  meet_url?: string | null;
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

const SELECT =
  "id,created_at,updated_at,nombre,contacto,telefono,email,origen,estado,pipeline,notas,website,rating,next_activity_type,next_activity_at,is_member,member_since,empresa_id,score,score_categoria,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))";

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
  meet_url: string | null;

  rating: number | string | null;
  next_activity_type: string | null;
  next_activity_at: string | number | null;
  empresa_id: string | null;
  score: number | string | null;
}>;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Opcional: ?limit=200
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw ?? 500), 1), 2000);

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadsApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? []) as LeadRow[], error: null } satisfies LeadsApiResponse,
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
      meet_url: meetUrlRaw,

      rating: ratingParsed ?? 0,
      next_activity_type: activityParsed ?? null,
      next_activity_at: nextAtParsed ?? null,
      empresa_id: empresaId,
      score: scoreParsed,

      updated_at: new Date().toISOString(),
    };

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .insert(insert)
      .select(SELECT)
      .maybeSingle();

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