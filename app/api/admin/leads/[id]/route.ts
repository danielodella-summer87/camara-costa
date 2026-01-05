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

  rating: number | null;
  next_activity_type: NextActivityType | null;
  next_activity_at: string | null;
};

type LeadApiResponse = {
  data?: LeadRow | null;
  error?: string | null;
};

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

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
  return (ALLOWED_ACTIVITY as string[]).includes(low) ? (low as NextActivityType) : null;
}

function getIdFromReq(req: Request, params?: { id?: string | string[] }) {
  const fromParams = params?.id;
  const candidate = Array.isArray(fromParams) ? fromParams[0] : fromParams;
  if (candidate && typeof candidate === "string") return candidate;

  // fallback defensivo
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last || null;
}

const SELECT =
  "id,created_at,updated_at,nombre,contacto,telefono,email,origen,estado,pipeline,notas,rating,next_activity_type,next_activity_at";

export async function GET(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params ?? undefined);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("leads").select(SELECT).eq("id", id).maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as LeadRow, error: null } satisfies LeadApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

type LeadPatchInput = Partial<{
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

export async function PATCH(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params ?? undefined);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as LeadPatchInput;

    const ratingParsed = body.rating === undefined ? undefined : cleanInt(body.rating);
    if (ratingParsed !== undefined) {
      if (ratingParsed !== null && (ratingParsed < 0 || ratingParsed > 5)) {
        return NextResponse.json(
          { data: null, error: "rating inválido (0 a 5)" } satisfies LeadApiResponse,
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const activityParsed =
      body.next_activity_type === undefined ? undefined : cleanActivityType(body.next_activity_type);

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

    const update: Partial<LeadRow> = {
      nombre: body.nombre === undefined ? undefined : cleanStr(body.nombre),
      contacto: body.contacto === undefined ? undefined : cleanStr(body.contacto),
      telefono: body.telefono === undefined ? undefined : cleanStr(body.telefono),
      email: body.email === undefined ? undefined : cleanStr(body.email),
      origen: body.origen === undefined ? undefined : cleanStr(body.origen),
      estado: body.estado === undefined ? undefined : cleanStr(body.estado),
      pipeline: body.pipeline === undefined ? undefined : cleanStr(body.pipeline),
      notas: body.notas === undefined ? undefined : cleanStr(body.notas),

      rating: ratingParsed === undefined ? undefined : ratingParsed,
      next_activity_type: activityParsed === undefined ? undefined : activityParsed,
      next_activity_at: nextAtParsed === undefined ? undefined : nextAtParsed,

      updated_at: new Date().toISOString(),
    };

    const hasAny = Object.values(update).some((v) => v !== undefined);
    const supabase = supabaseAdmin();

    if (!hasAny) {
      const { data, error } = await supabase.from("leads").select(SELECT).eq("id", id).maybeSingle();
      if (error) {
        return NextResponse.json(
          { data: null, error: error.message } satisfies LeadApiResponse,
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (!data) {
        return NextResponse.json(
          { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { data: data as LeadRow, error: null } satisfies LeadApiResponse,
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await supabase.from("leads").update(update).eq("id", id).select(SELECT).maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as LeadRow, error: null } satisfies LeadApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(req: Request, ctx: { params?: { id?: string | string[] } }) {
  try {
    const id = getIdFromReq(req, ctx?.params ?? undefined);
    if (!id) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isUUID(id)) {
      return NextResponse.json(
        { data: null, error: "Id inválido (se espera UUID)" } satisfies LeadApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("leads").delete().eq("id", id).select(SELECT).maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies LeadApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: "No se encontró el lead" } satisfies LeadApiResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data as LeadRow, error: null } satisfies LeadApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies LeadApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}