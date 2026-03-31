import type { SupabaseClient } from "@supabase/supabase-js";
import { classifySchemaError } from "./classifySupabaseError";
import { INIT_SQL_IA_CATEGORIES, INIT_SQL_LEADS_LINKEDIN_PERSONAL } from "./moduleInitSql";
import { ensureModuleReady } from "./ensureModuleReady";
import type { InitializeModuleResult, ModuleId } from "./types";

const SEED_CATEGORY_NAME = "General (seed)";
const SEED_CATEGORY_DESC = "Categoría inicial eliminable; creada por Inicializar módulo.";

export async function initializeModule(
  sb: SupabaseClient,
  moduleId: ModuleId,
  opts?: { seed?: boolean }
): Promise<InitializeModuleResult> {
  const seed = opts?.seed !== false;

  if (moduleId === "ia_categories") {
    const ready = await ensureModuleReady(sb, "ia_categories");
    if (ready.status === "missing_schema") {
      return {
        module: moduleId,
        ok: false,
        needsSqlInDashboard: true,
        sql: INIT_SQL_IA_CATEGORIES,
        message:
          "La tabla ai_categories no existe. Copiá el SQL en el editor SQL de Supabase y ejecutalo; luego volvé a pulsar Inicializar para el seed opcional.",
      };
    }

    if (!seed) {
      return { module: moduleId, ok: true, message: "Tabla ya disponible; seed omitido." };
    }

    if (ready.rowCount !== null && ready.rowCount > 0) {
      return { module: moduleId, ok: true, message: "Ya hay categorías en la tabla." };
    }

    const { data: existing } = await sb.from("ai_categories").select("id").eq("name", SEED_CATEGORY_NAME).maybeSingle();
    if (existing?.id) {
      return { module: moduleId, ok: true, message: "Seed ya presente (categoría General).", seedInserted: false };
    }

    const insertBody: Record<string, unknown> = {
      name: SEED_CATEGORY_NAME,
      description: SEED_CATEGORY_DESC,
      is_active: true,
    };

    let { error } = await sb.from("ai_categories").insert(insertBody).select("id").single();
    if (error && classifySchemaError(error).kind === "missing_column") {
      delete insertBody.description;
      const r2 = await sb.from("ai_categories").insert(insertBody).select("id").single();
      error = r2.error;
    }
    if (error) {
      return { module: moduleId, ok: false, message: error.message };
    }
    return { module: moduleId, ok: true, seedInserted: true, message: "Categoría seed creada (eliminable)." };
  }

  if (moduleId === "leads_linkedin_personal") {
    const ready = await ensureModuleReady(sb, "leads_linkedin_personal");
    if (ready.status === "missing_schema" && classifySchemaError({ message: ready.lastError }).kind === "missing_table") {
      return {
        module: moduleId,
        ok: false,
        needsSqlInDashboard: true,
        sql: "-- La tabla public.leads no existe. Aplicá primero el esquema base del proyecto (estructura_base.sql o migraciones).",
        message: "La tabla leads no existe; hace falta el esquema completo, no solo una columna.",
      };
    }

    if (ready.details?.linkedinPersonalAvailable) {
      return { module: moduleId, ok: true, message: "La columna linkedin_personal ya existe." };
    }

    return {
      module: moduleId,
      ok: false,
      needsSqlInDashboard: true,
      sql: INIT_SQL_LEADS_LINKEDIN_PERSONAL,
      message:
        "Agregá la columna linkedin_personal ejecutando el SQL en Supabase (ALTER TABLE …). Luego recargá la página.",
    };
  }

  return { module: moduleId, ok: false, message: "Módulo no soportado." };
}
