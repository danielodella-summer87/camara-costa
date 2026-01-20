import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Inicializa cliente Supabase con service role (admin)
 */
function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

const CONFIG_KEY = "leads_ai_prompt_base";

/**
 * GET /api/admin/config/leads
 * 
 * Obtiene el prompt base de IA para Leads desde public.config
 * 
 * Respuesta OK (200):
 * { "prompt_base": "texto del prompt" }
 * 
 * Si no existe el registro, devuelve string vacío:
 * { "prompt_base": "" }
 */
export async function GET() {
  try {
    const sb = supabaseAdmin();

    // Query: select value from public.config where key = 'leads_ai_prompt_base' limit 1
    const { data, error } = await sb
      .from("config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    // Si hay error y NO es "no rows" (PGRST116), loggear pero devolver vacío
    if (error && error.code !== "PGRST116") {
      console.error("Error leyendo config:", error);
      // Devolver vacío para no bloquear la UI
      return NextResponse.json(
        { prompt_base: "" },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Si no hay filas (PGRST116 o data === null), devolver string vacío
    const promptBase = data?.value ?? "";

    return NextResponse.json(
      { prompt_base: promptBase },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("Error inesperado en GET /api/admin/config/leads:", e);
    // En caso de error, devolver vacío para no bloquear la UI
    return NextResponse.json(
      { prompt_base: "" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * PUT /api/admin/config/leads
 * 
 * Guarda/actualiza el prompt base de IA para Leads en public.config
 * 
 * Body esperado:
 * { "prompt_base": "string" }
 * 
 * Respuesta OK (200):
 * { "prompt_base": "texto actualizado" }
 * 
 * Respuesta ERROR (500):
 * { "error": "mensaje de error" }
 */
export async function PUT(req: NextRequest) {
  try {
    const sb = supabaseAdmin();
    
    // Leer body JSON
    const body = await req.json().catch(() => ({}));

    // Validar que prompt_base sea string (puede ser vacío)
    const promptBase = typeof body.prompt_base === "string" 
      ? body.prompt_base.trim() 
      : "";

    // UPSERT: insert into public.config (key, value) values (...) on conflict (key) do update set value = excluded.value
    const { data, error } = await sb
      .from("config")
      .upsert(
        {
          key: CONFIG_KEY,
          value: promptBase,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "key",
        }
      )
      .select("value")
      .single();

    if (error) {
      console.error("Error guardando config:", error);
      return NextResponse.json(
        { error: error.message ?? "Error guardando configuración" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Devolver el valor guardado
    return NextResponse.json(
      { prompt_base: data.value ?? "" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("Error inesperado en PUT /api/admin/config/leads:", e);
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
