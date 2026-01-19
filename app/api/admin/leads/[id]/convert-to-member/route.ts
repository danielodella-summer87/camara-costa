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
 * - Actualiza lead: is_member=true, member_since=now()
 * - Crea o actualiza registro en tabla socios con datos del lead
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // 1. Obtener datos completos del lead
    const leadCheck = await sb
      .from("leads")
      .select("id, nombre, email, telefono, is_member, empresa_id")
      .eq("id", id)
      .maybeSingle();

    if (leadCheck.error || !leadCheck.data) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const lead = leadCheck.data;
    const now = new Date().toISOString();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 2. Actualizar lead: is_member=true, member_since=now()
    const updateLead = await sb
      .from("leads")
      .update({
        is_member: true,
        member_since: now,
      })
      .eq("id", id)
      .select("id, nombre, is_member, member_since")
      .maybeSingle();

    if (updateLead.error) {
      return NextResponse.json(
        { data: null, error: `Error actualizando lead: ${updateLead.error.message}` } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    // 3. Calcular socioId de forma segura
    // 3.1 Buscar socio existente por lead_id
    const existingSocio = await sb
      .from("socios")
      .select("id")
      .eq("lead_id", id)
      .maybeSingle();

    let socioId: string;

    if (existingSocio.data?.id) {
      // Si ya existe, usar su id
      socioId = existingSocio.data.id;
    } else {
      // Si no existe, generar uno nuevo tipo S-001, S-002...
      // Buscar el último socio ordenando por id desc (o created_at desc)
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
          const nextNum = num + 1;
          socioId = `S-${String(nextNum).padStart(3, "0")}`;
        }
      }
    }

    // 4. Preparar socioData con id SIEMPRE presente
    const socioDataBase: any = {
      id: socioId,
      lead_id: id,
      nombre: lead.nombre ?? null,
      email: lead.email ?? null,
      telefono: lead.telefono ?? null,
      empresa_id: lead.empresa_id ?? null,
      plan: "Bronce",
      estado: "Activo",
      fecha_alta: today,
      proxima_accion: null,
    };

    // 5. Intentar upsert con codigo (si existe la columna)
    let upsertSocio;
    let socioData = { ...socioDataBase, codigo: socioId };

    upsertSocio = await sb
      .from("socios")
      .upsert(socioData, { onConflict: "lead_id" })
      .select("id, codigo, lead_id, empresa_id, plan, estado, fecha_alta, proxima_accion, nombre, email, telefono")
      .maybeSingle();

    // Si falla por columna codigo, reintentar sin codigo
    if (upsertSocio.error && upsertSocio.error.message?.includes("codigo")) {
      socioData = socioDataBase; // Sin codigo
      upsertSocio = await sb
        .from("socios")
        .upsert(socioData, { onConflict: "lead_id" })
        .select("id, lead_id, empresa_id, plan, estado, fecha_alta, proxima_accion, nombre, email, telefono")
        .maybeSingle();
    }

    if (upsertSocio.error) {
      return NextResponse.json(
        { data: null, error: `Error creando/actualizando socio: ${upsertSocio.error.message}` } satisfies ApiResp<null>,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: {
          lead: updateLead.data,
          socio: upsertSocio.data,
        },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}
