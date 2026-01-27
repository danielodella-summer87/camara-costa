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
};

/**
 * GET /api/admin/agenda
 * Devuelve acciones pendientes (realizada_at IS NULL) con fecha_limite en rango: (hoy - 7 días) → (hoy + 14 días)
 * Incluye acciones de leads y socios, ordenadas por fecha_limite asc
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    // Calcular rango de fechas: (hoy - 7 días) → (hoy + 14 días)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7); // 7 días atrás
    startDate.setHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 14); // 14 días adelante
    endDate.setHours(23, 59, 59, 999);
    const endDateStr = endDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // Obtener acciones pendientes (realizada_at IS NULL)
    // Filtrar por fecha_limite en el rango: (hoy - 7 días) → (hoy + 14 días)
    // Ordenar por fecha_limite asc

    // Query para acciones de leads
    const leadsQuery = supabase
      .from("socio_acciones")
      .select(`
        id,
        tipo,
        nota,
        fecha_limite,
        realizada_at,
        created_at,
        lead_id,
        socio_id,
        leads:lead_id(nombre)
      `)
      .not("lead_id", "is", null)
      .is("socio_id", null)
      .is("realizada_at", null) // Solo pendientes
      .not("fecha_limite", "is", null) // Solo acciones con fecha_limite definida
      .gte("fecha_limite", startDateStr) // Desde (hoy - 7 días)
      .lte("fecha_limite", endDateStr) // Hasta (hoy + 14 días)
      .order("fecha_limite", { ascending: true });

    // Query para acciones de socios
    const sociosQuery = supabase
      .from("socio_acciones")
      .select(`
        id,
        tipo,
        nota,
        fecha_limite,
        realizada_at,
        created_at,
        lead_id,
        socio_id,
        socios:socio_id(nombre)
      `)
      .not("socio_id", "is", null)
      .is("lead_id", null)
      .is("realizada_at", null) // Solo pendientes
      .not("fecha_limite", "is", null) // Solo acciones con fecha_limite definida
      .gte("fecha_limite", startDateStr) // Desde (hoy - 7 días)
      .lte("fecha_limite", endDateStr) // Hasta (hoy + 14 días)
      .order("fecha_limite", { ascending: true });

    const [leadsResult, sociosResult] = await Promise.all([
      leadsQuery,
      sociosQuery,
    ]);

    // IMPORTANTE: Si hay errores en las queries, devolver 500 (no devolver [] silenciosamente)
    if (leadsResult.error) {
      console.error("[Agenda] Error obteniendo acciones de leads:", leadsResult.error);
      return NextResponse.json(
        { 
          data: null, 
          error: `Error obteniendo acciones de leads: ${leadsResult.error.message}` 
        } satisfies ApiResp<null>,
        { status: 500 }
      );
    }
    if (sociosResult.error) {
      console.error("[Agenda] Error obteniendo acciones de socios:", sociosResult.error);
      return NextResponse.json(
        { 
          data: null, 
          error: `Error obteniendo acciones de socios: ${sociosResult.error.message}` 
        } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    const leadsAcciones = (leadsResult.data || []) as any[];
    const sociosAcciones = (sociosResult.data || []) as any[];

    // Normalizar y combinar resultados
    const agendaItems: AgendaItem[] = [];

    // Procesar acciones de leads
    for (const accion of leadsAcciones) {
      // Validar que fecha_limite existe (ya filtrado en query, pero por seguridad)
      const fechaLimite = accion.fecha_limite;
      if (!fechaLimite || typeof fechaLimite !== "string") {
        continue;
      }

      agendaItems.push({
        id: String(accion.id),
        tipo: String(accion.tipo),
        fecha_limite: fechaLimite,
        nota: accion.nota ? String(accion.nota) : null,
        created_at: String(accion.created_at),
        lead_id: accion.lead_id ? String(accion.lead_id) : null,
        socio_id: null,
        owner_type: "lead" as const,
        owner_name: (accion.leads as any)?.nombre ? String((accion.leads as any).nombre) : null,
      });
    }

    // Procesar acciones de socios
    for (const accion of sociosAcciones) {
      // Validar que fecha_limite existe (ya filtrado en query, pero por seguridad)
      const fechaLimite = accion.fecha_limite;
      if (!fechaLimite || typeof fechaLimite !== "string") {
        continue;
      }

      agendaItems.push({
        id: String(accion.id),
        tipo: String(accion.tipo),
        fecha_limite: fechaLimite,
        nota: accion.nota ? String(accion.nota) : null,
        created_at: String(accion.created_at),
        lead_id: null,
        socio_id: accion.socio_id ? String(accion.socio_id) : null,
        owner_type: "socio" as const,
        owner_name: (accion.socios as any)?.nombre ? String((accion.socios as any).nombre) : null,
      });
    }

    // Ya están ordenadas por fecha_limite asc desde la query, pero ordenar por created_at como fallback si hay empate
    agendaItems.sort((a, b) => {
      const dateA = new Date(a.fecha_limite).getTime();
      const dateB = new Date(b.fecha_limite).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return NextResponse.json(
      { data: agendaItems, error: null } satisfies ApiResp<AgendaItem[]>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("[Agenda] Error inesperado:", e);
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error obteniendo agenda" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
