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

const CONFIG_KEY = "portal_config";

type PortalConfig = {
  nombre_camara?: string;
  moneda?: "USD" | "UYU";
  timezone?: string;
  titulo_header?: string | null;
  logo_url?: string | null;
  label_member_singular?: string | null;
  label_member_plural?: string | null;
};

const DEFAULT_CONFIG: PortalConfig = {
  nombre_camara: "Cámara Costa",
  moneda: "USD",
  timezone: "America/Montevideo",
  titulo_header: null,
  logo_url: null,
  label_member_singular: "Socio",
  label_member_plural: "Socios",
};

/**
 * GET /api/admin/config/portal
 * 
 * Obtiene la configuración del portal desde public.config
 */
export async function GET() {
  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error leyendo portal config:", error);
      return NextResponse.json(
        { data: DEFAULT_CONFIG },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Si no existe, devolver defaults
    if (!data?.value) {
      return NextResponse.json(
        { data: DEFAULT_CONFIG },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Parsear JSON
    try {
      const config = JSON.parse(data.value) as PortalConfig;
      // Mergear con defaults para asegurar que todos los campos existan
      const merged = { ...DEFAULT_CONFIG, ...config };
      return NextResponse.json(
        { data: merged },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    } catch (parseError) {
      console.error("Error parseando portal config JSON:", parseError);
      return NextResponse.json(
        { data: DEFAULT_CONFIG },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (e: any) {
    console.error("Error inesperado en GET /api/admin/config/portal:", e);
    return NextResponse.json(
      { data: DEFAULT_CONFIG },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * PATCH /api/admin/config/portal
 * 
 * Actualiza la configuración del portal en public.config
 * 
 * Body esperado:
 * { "nombre_camara": "string", "moneda": "USD"|"UYU", "timezone": "string", "titulo_header": "string|null", "logo_url": "string|null", "label_member_singular": "string|null", "label_member_plural": "string|null" }
 */
export async function PATCH(req: NextRequest) {
  try {
    const sb = supabaseAdmin();
    
    const body = await req.json().catch(() => ({}));

    // Validar y normalizar campos
    const updates: Partial<PortalConfig> = {};
    
    if (typeof body.nombre_camara === "string") {
      updates.nombre_camara = body.nombre_camara.trim() || DEFAULT_CONFIG.nombre_camara;
    }
    
    if (body.moneda === "USD" || body.moneda === "UYU") {
      updates.moneda = body.moneda;
    }
    
    if (typeof body.timezone === "string") {
      updates.timezone = body.timezone.trim() || DEFAULT_CONFIG.timezone;
    }
    
    if (body.titulo_header === null || typeof body.titulo_header === "string") {
      updates.titulo_header = body.titulo_header === "" ? null : body.titulo_header;
    }
    
    if (body.logo_url === null || typeof body.logo_url === "string") {
      updates.logo_url = body.logo_url === "" ? null : body.logo_url;
    }
    
    if (body.label_member_singular === null || typeof body.label_member_singular === "string") {
      updates.label_member_singular = body.label_member_singular === "" || !body.label_member_singular.trim()
        ? DEFAULT_CONFIG.label_member_singular
        : body.label_member_singular.trim();
    }
    
    if (body.label_member_plural === null || typeof body.label_member_plural === "string") {
      updates.label_member_plural = body.label_member_plural === "" || !body.label_member_plural.trim()
        ? DEFAULT_CONFIG.label_member_plural
        : body.label_member_plural.trim();
    }

    // Obtener config actual para mergear
    const { data: currentData } = await sb
      .from("config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    let currentConfig: PortalConfig = DEFAULT_CONFIG;
    if (currentData?.value) {
      try {
        currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(currentData.value) };
      } catch {
        // Si falla el parse, usar defaults
      }
    }

    // Mergear con updates
    const mergedConfig: PortalConfig = { ...currentConfig, ...updates };

    // Guardar como JSON
    const { data, error } = await sb
      .from("config")
      .upsert(
        {
          key: CONFIG_KEY,
          value: JSON.stringify(mergedConfig),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "key",
        }
      )
      .select("value")
      .single();

    if (error) {
      console.error("Error guardando portal config:", error);
      return NextResponse.json(
        { error: error.message ?? "Error guardando configuración" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Parsear y devolver
    try {
      const savedConfig = JSON.parse(data.value) as PortalConfig;
      return NextResponse.json(
        { data: { ...DEFAULT_CONFIG, ...savedConfig } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      return NextResponse.json(
        { data: mergedConfig },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (e: any) {
    console.error("Error inesperado en PATCH /api/admin/config/portal:", e);
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
