export type IATabKey = "dashboard_ia" | "configuracion" | "prompts_activos" | "categorias" | "perfiles_analisis";

export type PromptTypeKey =
  | "investigacion"
  | "foda"
  | "oportunidades"
  | "plan_72h"
  | "plan_30_90";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type PromptRow = {
  id: string;
  name: string;
  type: string;
  category_id: string;
  description: string | null;
  prompt_content: string;
  role_persona?: string | null;
  context_environment?: string | null;
  objective?: string | null;
  specific_task?: string | null;
  constraints?: string | null;
  output_format?: string | null;
  target_audience?: string | null;
  status: "draft" | "validated";
  created_at: string;
  updated_at: string;
  ai_categories?: { id: string; name: string } | null;
  prompt_health?: "ok" | "mejorable" | "error";
  pending_suggestions_count?: number;
  missing_required_blocks?: string[];
};

export type AnalysisProfileRow = {
  id: string;
  name: string;
  description: string | null;
  target_client_type: string | null;
  target_industries: string[];
  base_instructions: string;
  /** Oferta principal para prompts de cierre ({{oferta_principal_nuestra_organizacion}}). */
  cierre_oferta_principal?: string | null;
  /** Tipo de org. vendedora ({{tipo_organizacion_vendedora}}). */
  tipo_organizacion_vendedora?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AnalysisProfilePromptRow = {
  id: string;
  profile_id: string;
  prompt_id: string;
  enabled_by_default: boolean;
  execution_order: number;
  created_at: string;
};

export const PROMPT_TYPE_OPTIONS: Array<{ key: PromptTypeKey; label: string }> = [
  { key: "investigacion", label: "Investigación" },
  { key: "foda", label: "FODA" },
  { key: "oportunidades", label: "Oportunidades" },
  { key: "plan_72h", label: "Plan 72h" },
  { key: "plan_30_90", label: "Plan 30-90" },
];
