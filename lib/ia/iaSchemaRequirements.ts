/**
 * Columnas que el módulo /admin/ia y las rutas /api/admin/ia/* esperan.
 * Fuente: migrations 048–051, 049, 050, 054 y selects en app/api/admin/ia.
 */
export const IA_ADMIN_REQUIRED_SCHEMA: Record<string, readonly string[]> = {
  ai_categories: ["id", "name", "description", "is_active", "created_at"],
  ai_prompts: [
    "id",
    "name",
    "type",
    "category_id",
    "description",
    "prompt_content",
    "status",
    "created_at",
    "updated_at",
    "role_persona",
    "context_environment",
    "objective",
    "specific_task",
    "constraints",
    "output_format",
    "target_audience",
  ],
  ai_analysis_profiles: [
    "id",
    "name",
    "description",
    "target_client_type",
    "target_industries",
    "base_instructions",
    "is_active",
    "created_at",
    "updated_at",
    "cierre_oferta_principal",
    "tipo_organizacion_vendedora",
  ],
  ai_profile_prompts: [
    "id",
    "profile_id",
    "prompt_id",
    "enabled_by_default",
    "execution_order",
    "created_at",
  ],
  ai_prompt_suggestions: [
    "id",
    "prompt_id",
    "suggested_content",
    "suggestion_type",
    "reason",
    "status",
    "created_at",
    "applied_at",
    "discarded_at",
  ],
} as const;

export type IaAdminTableName = keyof typeof IA_ADMIN_REQUIRED_SCHEMA;
