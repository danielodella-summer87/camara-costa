import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type OwnerType = "lead" | "socio";

type SocioAccionRow = {
  id: string;
  tipo: string | null;
  nota: string | null;
  fecha_limite: string | null;
  lugar: string | null;
  realizada_at: string | null;
  created_at: string;
  lead_id: string | null;
  socio_id: string | null;
};

type AgendaItem = {
  id: string;
  tipo: string;
  fecha_limite: string; // YYYY-MM-DD
  nota: string | null;
  lugar: string | null;
  created_at: string;
  lead_id: string | null;
  socio_id: string | null;
  owner_type: OwnerType;
  owner_name: string | null;

  // datos para acciones rápidas
  owner_email?: string | null;
  owner_phone?: string | null;
  owner_whatsapp?: string | null;
  owner_meet_url?: string | null;
};

type RowObj = Record<string, unknown>;

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error desconocido";
  }
}

function pickFirstString(obj: RowObj | null | undefined, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function inferOwnerName(obj: RowObj | null | undefined): string | null {
  return pickFirstString(obj, ["nombre", "razon_social", "razonSocial", "empresa", "title"]);
}

/**
 * GET /api/admin/agenda
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    // Querystring
    const { searchParams } = new URL(req.url);
    const overdueOnly = searchParams.get("overdueOnly") === "1";
    const todayOnly = searchParams.get("todayOnly") === "1";

    // Defaults: últimos 30 días + próximos 14 días
    const pastDays = overdueOnly ? 365 : parseInt(searchParams.get("pastDays") || "30", 10);
    const futureDays = overdueOnly ? 0 : parseInt(searchParams.get("futureDays") || "14", 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    let startDateStr: string;
    let endDateStr: string;

    if (todayOnly) {
      startDateStr = todayStr;
      endDateStr = todayStr;
    } else if (overdueOnly) {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - pastDays);
      startDate.setHours(0, 0, 0, 0);
      startDateStr = startDate.toISOString().split("T")[0];
      endDateStr = todayStr;
    } else {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - pastDays);
      startDate.setHours(0, 0, 0, 0);
      startDateStr = startDate.toISOString().split("T")[0];

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + futureDays);
      endDate.setHours(23, 59, 59, 999);
      endDateStr = endDate.toISOString().split("T")[0];
    }

    // Query base
    let query = supabase
      .from("socio_acciones")
      .select("id,tipo,nota,fecha_limite,lugar,realizada_at,created_at,lead_id,socio_id")
      .is("realizada_at", null)
      .not("fecha_limite", "is", null);

    if (todayOnly) {
      query = query.eq("fecha_limite", todayStr);
    } else if (overdueOnly) {
      query = query.lt("fecha_limite", todayStr).gte("fecha_limite", startDateStr);
    } else {
      query = query.gte("fecha_limite", startDateStr).lte("fecha_limite", endDateStr);
    }

    query = query.order("fecha_limite", { ascending: true }).order("created_at", { ascending: true });

    const accionesRes = await query;

    if (accionesRes.error) {
      console.error("[Agenda] Error query socio_acciones:", accionesRes.error);
      return NextResponse.json(
        { data: null, error: accionesRes.error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const acciones = (accionesRes.data ?? []) as unknown as SocioAccionRow[];

    const leadIds = Array.from(new Set(acciones.map((a) => a.lead_id).filter(Boolean))) as string[];
    const socioIds = Array.from(new Set(acciones.map((a) => a.socio_id).filter(Boolean))) as string[];

    const leadMap = new Map<string, RowObj>();
    const socioMap = new Map<string, RowObj>();
    const empresaMap = new Map<string, RowObj>();

    if (leadIds.length) {
      const leadsRes = await supabase.from("leads").select("*").in("id", leadIds);
      if (leadsRes.error) {
        console.error("[Agenda] Error query leads:", leadsRes.error);
      } else {
        for (const l of leadsRes.data ?? []) leadMap.set(String((l as RowObj).id), l as RowObj);
      }
    }

    if (socioIds.length) {
      // Intento 1: socio + empresa
      const sociosRes = await supabase
        .from("socios")
        .select("*, empresas:empresa_id(*)")
        .in("id", socioIds);

      if (sociosRes.error) {
        console.error("[Agenda] Error query socios (join empresas) — fallback:", sociosRes.error);

        const sociosFallback = await supabase.from("socios").select("*").in("id", socioIds);
        if (sociosFallback.error) {
          console.error("[Agenda] Error query socios fallback:", sociosFallback.error);
        } else {
          for (const s of sociosFallback.data ?? []) socioMap.set(String((s as RowObj).id), s as RowObj);
        }
      } else {
        for (const s of sociosRes.data ?? []) {
          const sObj = s as RowObj;
          socioMap.set(String(sObj.id), sObj);

          const emp = sObj.empresas as RowObj | null | undefined;
          if (emp?.id) empresaMap.set(String(emp.id), emp);
        }
      }
    }

    const agendaItems: AgendaItem[] = [];

    for (const a of acciones) {
      const leadId = a.lead_id ? String(a.lead_id) : null;
      const socioId = a.socio_id ? String(a.socio_id) : null;

      const owner_type: OwnerType = leadId ? "lead" : "socio";

      let owner_name: string | null = null;
      let owner_email: string | null = null;
      let owner_phone: string | null = null;
      let owner_whatsapp: string | null = null;
      let owner_meet_url: string | null = null;

      if (owner_type === "lead" && leadId) {
        const l = leadMap.get(leadId);
        owner_name = inferOwnerName(l);
        owner_email = pickFirstString(l, ["email", "correo", "mail"]);
        owner_phone = pickFirstString(l, ["telefono", "tel", "phone", "celular", "movil", "mobile"]);
        owner_whatsapp = pickFirstString(l, ["whatsapp", "telefono_whatsapp", "wa"]);
        owner_meet_url = pickFirstString(l, ["meet_url", "meet_link", "google_meet", "google_meet_link", "meet"]);
      }

      if (owner_type === "socio" && socioId) {
        const s = socioMap.get(socioId);
        const emp = (s?.empresas as RowObj | null | undefined) ?? null;

        owner_name = inferOwnerName(emp) ?? inferOwnerName(s);

        owner_email = pickFirstString(emp, ["email", "correo", "mail"]) ?? pickFirstString(s, ["email"]);
        owner_phone =
          pickFirstString(emp, ["telefono", "tel", "phone", "celular", "movil", "mobile"]) ??
          pickFirstString(s, ["telefono", "celular", "phone"]);
        owner_whatsapp =
          pickFirstString(emp, ["whatsapp", "telefono_whatsapp", "wa"]) ?? pickFirstString(s, ["whatsapp"]);
        owner_meet_url =
          pickFirstString(emp, ["meet_url", "meet_link", "google_meet"]) ??
          pickFirstString(s, ["meet_url", "meet_link"]);
      }

      if (!a.fecha_limite) continue;

      agendaItems.push({
        id: String(a.id),
        tipo: String(a.tipo ?? ""),
        fecha_limite: String(a.fecha_limite),
        nota: a.nota ? String(a.nota) : null,
        lugar: a.lugar ? String(a.lugar) : null,
        created_at: String(a.created_at),
        lead_id: leadId,
        socio_id: socioId,
        owner_type,
        owner_name,
        owner_email,
        owner_phone,
        owner_whatsapp,
        owner_meet_url,
      });
    }

    agendaItems.sort((x, y) => {
      const ax = new Date(x.fecha_limite).getTime();
      const ay = new Date(y.fecha_limite).getTime();
      if (ax !== ay) return ax - ay;
      return new Date(x.created_at).getTime() - new Date(y.created_at).getTime();
    });

    return NextResponse.json(
      { data: agendaItems, error: null } satisfies ApiResp<AgendaItem[]>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    console.error("[Agenda] Error inesperado:", e);
    return NextResponse.json(
      { data: null, error: toErrorMessage(e) } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/agenda
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const body = (await req.json()) as Record<string, unknown>;

    const ownerType = body?.owner_type as OwnerType;
    const leadId = (body?.lead_id ?? null) as string | null;
    const socioId = (body?.socio_id ?? null) as string | null;

    const tipo = String(body?.tipo ?? "").trim();
    const fechaLimite = String(body?.fecha_limite ?? "").trim(); // YYYY-MM-DD
    const nota = body?.nota ? String(body.nota) : null;
    const lugar = body?.lugar ? String(body.lugar) : null;

    if (!tipo) throw new Error("Falta tipo");
    if (!fechaLimite) throw new Error("Falta fecha_limite");

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fechaLimite)) throw new Error("fecha_limite debe tener formato YYYY-MM-DD");

    if (ownerType === "lead") {
      if (!leadId) throw new Error("Falta lead_id");
      if (socioId) throw new Error("No puede venir socio_id si owner_type=lead");
    } else if (ownerType === "socio") {
      if (!socioId) throw new Error("Falta socio_id");
      if (leadId) throw new Error("No puede venir lead_id si owner_type=socio");
    } else {
      throw new Error("owner_type inválido");
    }

    // pendiente => realizada_at queda NULL (no lo enviamos)
    const insertPayload = {
      tipo,
      nota,
      fecha_limite: fechaLimite,
      lugar,
      lead_id: ownerType === "lead" ? leadId : null,
      socio_id: ownerType === "socio" ? socioId : null,
    };

    const { data, error } = await supabase
      .from("socio_acciones")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[Agenda][POST] supabase error:", error);
      throw new Error(error.message);
    }

    return NextResponse.json({ data, error: null } satisfies ApiResp<{ id: string }>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: unknown) {
    console.error("[Agenda][POST] Error:", e);
    return NextResponse.json(
      { data: null, error: toErrorMessage(e) } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
