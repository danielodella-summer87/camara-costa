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
  "id,created_at,updated_at,nombre,contacto,telefono,email,origen,estado,pipeline,notas,rating,next_activity_type,next_activity_at,is_member,member_since";

type LeadCreateInput = Partial<{
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  estado: string | null;
  pipeline: string | null;
  notas: string | null;

  rating: number | string | null;
  next_activity_type: string | null;
  next_activity_at: string | number | null;
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

    const insert: Partial<LeadRow> = {
      nombre,
      contacto: cleanStr(body.contacto),
      telefono: cleanStr(body.telefono),
      email: cleanStr(body.email),
      origen: cleanStr(body.origen),
      estado: cleanStr(body.estado),
      pipeline,
      notas: cleanStr(body.notas),

      rating: ratingParsed ?? 0,
      next_activity_type: activityParsed ?? null,
      next_activity_at: nextAtParsed ?? null,

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