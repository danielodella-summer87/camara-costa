import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data: T | null; error: string | null };

type ResetResponse = {
  deleted: Record<string, number>;
  status: "ok" | "partial";
  failed?: string[];
};

/**
 * POST /api/admin/config/reset-db
 * 
 * Borra todas las tablas en orden seguro (hijas → padres).
 * 
 * Requiere:
 * - Header: x-reset-token (debe coincidir con RESET_DB_TOKEN)
 * - Body: { "confirm": "BORRAR TODO" }
 * 
 * Devuelve:
 * - deleted: { tabla: cantidad }
 * - status: "ok" | "partial"
 * - failed?: [tablas que fallaron]
 */
export async function POST(req: NextRequest) {
  try {
    // Requerir permiso system.danger (más restrictivo que config.admin)
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req, "system.danger");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado. Se requiere permiso system.danger" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    console.log(
      "RESET_DB_TOKEN:",
      process.env.RESET_DB_TOKEN ? "OK" : "MISSING"
    );
    
    // Validar token desde header (doble validación: RBAC + token)
    const tokenHeader = req.headers.get("x-reset-token") || "";
    const tokenEnv = process.env.RESET_DB_TOKEN || "";

    if (!tokenEnv || tokenEnv.trim().length === 0) {
      console.error("[reset-db] RESET_DB_TOKEN no configurado en servidor");
      return NextResponse.json(
        { data: null, error: "Operación no disponible" } satisfies ApiResp<null>,
        { status: 503 }
      );
    }

    if (tokenHeader !== tokenEnv) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    // Validar confirmación
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "BORRAR TODO") {
      return NextResponse.json(
        { data: null, error: 'Confirmación inválida. Enviar confirm="BORRAR TODO"' } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const supabase = supabaseAdmin();

    // Orden de eliminación: hijas → padres
    // 1. Tablas que dependen de otras (hijas)
    // 2. Tablas intermedias
    // 3. Tablas padre
    const tables = [
      "lead_meet_events",      // depende de lead_meet_sessions
      "lead_meet_sessions",    // depende de leads
      "lead_proposals",        // depende de leads
      "lead_contacts",         // depende de leads
      "lead_docs",             // depende de leads
      "socio_acciones",        // depende de leads o socios
      "socios",                // depende de leads (ON DELETE RESTRICT - importante borrar antes)
      "leads",                 // depende de empresas (ON DELETE SET NULL)
      "empresas",              // tabla padre
    ];

    const deleted: Record<string, number> = {};
    const failed: string[] = [];

    // Borrar cada tabla en orden
    for (const table of tables) {
      try {
        // Primero contar filas
        const { count: countBefore } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        // Intentar borrar todas las filas usando condición siempre verdadera
        // Estrategia: usar id >= '00000000-0000-0000-0000-000000000000' (siempre verdadero para UUIDs)
        
        // Intentar con id primero (la mayoría de tablas lo tienen como UUID)
        const { error: errorId } = await supabase
          .from(table)
          .delete()
          .gte("id", "00000000-0000-0000-0000-000000000000");
        
        let error = errorId;
        
        // Si falla con id, intentar con created_at (algunas tablas pueden no tener id UUID)
        if (error) {
          const { error: errorCreated } = await supabase
            .from(table)
            .delete()
            .gte("created_at", "1970-01-01T00:00:00Z");
          error = errorCreated;
        }

        if (error) {
          console.error(`[reset-db] Error borrando ${table}:`, error);
          failed.push(table);
          continue;
        }

        const deletedCount = countBefore ?? 0;
        deleted[table] = deletedCount;
        console.log(`[reset-db] ✅ ${table}: ${deletedCount} filas borradas`);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`[reset-db] Excepción borrando ${table}:`, errorMsg);
        failed.push(table);
      }
    }

    const status: "ok" | "partial" = failed.length === 0 ? "ok" : "partial";

    const response: ResetResponse = {
      deleted,
      status,
      ...(failed.length > 0 && { failed }),
    };

    if (status === "partial") {
      return NextResponse.json(
        { data: response, error: `Algunas tablas fallaron: ${failed.join(", ")}` } satisfies ApiResp<ResetResponse>,
        { status: 207 } // 207 Multi-Status
      );
    }

    return NextResponse.json(
      { data: response, error: null } satisfies ApiResp<ResetResponse>,
      { status: 200 }
    );
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Error inesperado";
    console.error("[reset-db] Error inesperado:", errorMsg);
    return NextResponse.json(
      { data: null, error: errorMsg } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
