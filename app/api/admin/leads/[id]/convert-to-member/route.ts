import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeStr(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * POST /api/admin/leads/:id/convert-to-member
 * Convierte un lead en socio:
 * - Si ya existe socio para esa empresa_id → no crear; setear lead (socio_id, is_member, member_since).
 * - Si no existe socio → crear y luego setear lead.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // 1. Obtener lead (incluyendo empresa_id)
    const leadCheck = await sb
      .from("leads")
      .select("id, nombre, email, telefono, is_member, empresa_id")
      .eq("id", id)
      .maybeSingle();

    if (leadCheck.error || !leadCheck.data) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const lead = leadCheck.data;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 2. Si no hay empresa_id → error claro
    if (lead.empresa_id == null || lead.empresa_id === "") {
      return NextResponse.json(
        { data: null, error: "empresa_id requerido para convertir a socio" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    // 3. Buscar socio existente
    const existing = await sb
      .from("socios")
      .select("id")
      .eq("empresa_id", lead.empresa_id)
      .maybeSingle();

    // 4. socioId = existing?.data?.id ?? (crear socio y tomar id)
    let socioId: string | undefined = existing?.data?.id ?? undefined;
    let socioForResponse: { id: string; [k: string]: unknown } | null = existing?.data ?? null;

    if (socioId == null) {
      const lastSocio = await sb
        .from("socios")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      socioId = "S-001";
      if (lastSocio.data?.id) {
        const match = String(lastSocio.data.id).match(/^S-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          socioId = `S-${String(num + 1).padStart(3, "0")}`;
        }
      }

      const socioDataBase: Record<string, unknown> = {
        id: socioId,
        lead_id: id,
        nombre: lead.nombre ?? null,
        email: lead.email ?? null,
        telefono: lead.telefono ?? null,
        empresa_id: lead.empresa_id,
        plan: "Bronce",
        estado: "Activo",
        fecha_alta: today,
        proxima_accion: null,
      };

      let upsertSocio = await sb
        .from("socios")
        .upsert({ ...socioDataBase, codigo: socioId }, { onConflict: "lead_id" })
        .select("id, codigo, lead_id, empresa_id, plan, estado, fecha_alta, proxima_accion, nombre, email, telefono")
        .maybeSingle();

      if (upsertSocio.error?.message?.includes("codigo")) {
        upsertSocio = await sb
          .from("socios")
          .upsert(socioDataBase, { onConflict: "lead_id" })
          .select("id, lead_id, empresa_id, plan, estado, fecha_alta, proxima_accion, nombre, email, telefono")
          .maybeSingle();
      }

      if (upsertSocio.error) {
        return NextResponse.json(
          { data: null, error: `Error creando socio: ${upsertSocio.error.message}` } satisfies ApiResp<null>,
          { status: 500 }
        );
      }
      socioForResponse = upsertSocio.data ?? null;
    } else if (socioForResponse && Object.keys(socioForResponse).length <= 1) {
      const full = await sb
        .from("socios")
        .select("id, codigo, lead_id, empresa_id, plan, estado, fecha_alta, proxima_accion, nombre, email, telefono")
        .eq("id", socioId)
        .maybeSingle();
      if (full.data) socioForResponse = full.data as { id: string; [k: string]: unknown };
    }

    if (!socioId) {
      return NextResponse.json(
        { data: null, error: "Error obteniendo o creando socio" } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    // 5. Actualizar lead
    const updateLead = await sb
      .from("leads")
      .update({
        socio_id: socioId,
        is_member: true,
        member_since: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, nombre, is_member, member_since, socio_id")
      .maybeSingle();

    if (updateLead.error) {
      return NextResponse.json(
        { data: null, error: `Error actualizando lead: ${updateLead.error.message}` } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    // 6. Migrar acciones del lead al socio
    // Buscar todas las acciones del lead
    const accionesLead = await sb
      .from("socio_acciones")
      .select("id")
      .eq("lead_id", id)
      .is("socio_id", null);

    if (accionesLead.error) {
      console.error(`[convert-to-member] Error obteniendo acciones del lead: ${accionesLead.error.message}`);
      // No fallar la conversión si hay error obteniendo acciones, solo loguear
    } else if (accionesLead.data && accionesLead.data.length > 0) {
      // Actualizar todas las acciones: limpiar lead_id y setear socio_id
      const accionesIds = accionesLead.data.map((a) => a.id);
      
      const updateAcciones = await sb
        .from("socio_acciones")
        .update({
          lead_id: null,
          socio_id: socioId,
        })
        .in("id", accionesIds)
        .select("id");

      if (updateAcciones.error) {
        console.error(`[convert-to-member] Error migrando acciones: ${updateAcciones.error.message}`);
        // No fallar la conversión si hay error migrando acciones, solo loguear
      } else {
        console.log(`[convert-to-member] Migradas ${updateAcciones.data?.length ?? 0} acciones del lead al socio`);
      }
    }

    return NextResponse.json(
      {
        data: {
          lead: updateLead.data,
          socio: socioForResponse,
        },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}
