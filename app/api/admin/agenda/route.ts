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

type AgendaItem = {
  id: string;
  tipo: string;
  fecha_limite: string; // YYYY-MM-DD
  nota: string | null;
  created_at: string;
  lead_id: string | null;
  socio_id: string | null;
  owner_type: "lead" | "socio";
  owner_name: string | null;

  // NUEVO: datos para acciones rápidas
  owner_email?: string | null;
  owner_phone?: string | null;
  owner_whatsapp?: string | null;
  owner_meet_url?: string | null;
};

function pickFirstString(obj: any, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function inferOwnerName(obj: any): string | null {
  return (
    pickFirstString(obj, ["nombre", "razon_social", "empresa", "title"]) ??
    null
  );
}

/**
 * GET /api/admin/agenda
 * Devuelve acciones pendientes (realizada_at IS NULL) con fecha_limite en rango configurable
 * Parámetros querystring:
 * - pastDays: número de días hacia atrás (default: 30)
 * - futureDays: número de días hacia adelante (default: 14)
 * - overdueOnly: 1 para solo vencidas (fecha_limite < hoy)
 * - todayOnly: 1 para solo hoy (fecha_limite = hoy)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    // Parsear querystring
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
      // Solo hoy
      startDateStr = todayStr;
      endDateStr = todayStr;
    } else if (overdueOnly) {
      // Solo vencidas (fecha_limite < hoy)
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - pastDays);
      startDate.setHours(0, 0, 0, 0);
      startDateStr = startDate.toISOString().split("T")[0];
      endDateStr = todayStr; // Hasta hoy (exclusivo en query)
    } else {
      // Default / Todas: rango normal
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - pastDays);
      startDate.setHours(0, 0, 0, 0);
      startDateStr = startDate.toISOString().split("T")[0];

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + futureDays);
      endDate.setHours(23, 59, 59, 999);
      endDateStr = endDate.toISOString().split("T")[0];
    }

    // Construir query base
    let query = supabase
      .from("socio_acciones")
      .select("id,tipo,nota,fecha_limite,realizada_at,created_at,lead_id,socio_id")
      .is("realizada_at", null) // Solo pendientes
      .not("fecha_limite", "is", null); // Solo con fecha_limite definida

    // Aplicar filtros de fecha según el caso
    if (todayOnly) {
      query = query.eq("fecha_limite", todayStr);
    } else if (overdueOnly) {
      query = query.lt("fecha_limite", todayStr); // fecha_limite < hoy
      if (startDateStr) {
        query = query.gte("fecha_limite", startDateStr); // Opcional: limitar a últimos N días
      }
    } else {
      query = query.gte("fecha_limite", startDateStr).lte("fecha_limite", endDateStr);
    }

    // Ordenar: fecha_limite ASC, luego created_at ASC
    query = query.order("fecha_limite", { ascending: true }).order("created_at", { ascending: true });

    const accionesRes = await query;

    if (accionesRes.error) {
      console.error("[Agenda] Error query socio_acciones:", accionesRes.error);
      return NextResponse.json(
        { data: null, error: accionesRes.error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const acciones = (accionesRes.data ?? []) as any[];

    // IDs únicos
    const leadIds = Array.from(
      new Set(acciones.map((a) => a.lead_id).filter(Boolean))
    ) as string[];

    const socioIds = Array.from(
      new Set(acciones.map((a) => a.socio_id).filter(Boolean))
    ) as string[];

    // Fetch owners (defensivo: select * para evitar romper por columnas desconocidas)
    const leadMap = new Map<string, any>();
    const socioMap = new Map<string, any>();
    const empresaMap = new Map<string, any>();

    if (leadIds.length) {
      const leadsRes = await supabase.from("leads").select("*").in("id", leadIds);
      if (leadsRes.error) {
        console.error("[Agenda] Error query leads:", leadsRes.error);
      } else {
        for (const l of leadsRes.data ?? []) leadMap.set(String(l.id), l);
      }
    }

    if (socioIds.length) {
      // Intento 1: traer socio + empresa (si existe relación)
      const sociosRes = await supabase
        .from("socios")
        .select("*, empresas:empresa_id(*)")
        .in("id", socioIds);

      if (sociosRes.error) {
        console.error("[Agenda] Error query socios (join empresas) — fallback:", sociosRes.error);

        // Fallback: socio solo
        const sociosFallback = await supabase.from("socios").select("*").in("id", socioIds);
        if (sociosFallback.error) {
          console.error("[Agenda] Error query socios fallback:", sociosFallback.error);
        } else {
          for (const s of sociosFallback.data ?? []) socioMap.set(String(s.id), s);
        }
      } else {
        for (const s of sociosRes.data ?? []) {
          socioMap.set(String(s.id), s);
          const emp = (s as any).empresas;
          if (emp && emp.id) empresaMap.set(String(emp.id), emp);
        }
      }
    }

    // Normalizar agenda
    const agendaItems: AgendaItem[] = [];

    for (const a of acciones) {
      const leadId = a.lead_id ? String(a.lead_id) : null;
      const socioId = a.socio_id ? String(a.socio_id) : null;

      let owner_type: "lead" | "socio" = leadId ? "lead" : "socio";
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
        const emp = (s as any)?.empresas;

        // Preferimos nombre de empresa si existe
        owner_name = inferOwnerName(emp) ?? inferOwnerName(s);

        owner_email = pickFirstString(emp, ["email", "correo", "mail"]) ?? pickFirstString(s, ["email"]);
        owner_phone =
          pickFirstString(emp, ["telefono", "tel", "phone", "celular", "movil", "mobile"]) ??
          pickFirstString(s, ["telefono", "celular", "phone"]);
        owner_whatsapp =
          pickFirstString(emp, ["whatsapp", "telefono_whatsapp", "wa"]) ?? pickFirstString(s, ["whatsapp"]);
        owner_meet_url = pickFirstString(emp, ["meet_url", "meet_link", "google_meet"]) ?? pickFirstString(s, ["meet_url", "meet_link"]);
      }

      agendaItems.push({
        id: String(a.id),
        tipo: String(a.tipo ?? ""),
        fecha_limite: String(a.fecha_limite),
        nota: a.nota ? String(a.nota) : null,
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

    // Orden: fecha_limite ASC, y desempate por created_at ASC
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
  } catch (e: any) {
    console.error("[Agenda] Error inesperado:", e);
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error obteniendo agenda" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
