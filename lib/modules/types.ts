export const MODULE_IDS = ["ia_categories", "leads_linkedin_personal"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleReadinessStatus = "ok" | "missing_schema" | "empty";

export type ModuleReadinessResult = {
  module: ModuleId;
  status: ModuleReadinessStatus;
  /** Columnas con las que se puede operar (tras fallback). */
  usableColumns: string[];
  /** Columnas deseadas que faltan en la tabla. */
  missingColumns: string[];
  /** Conteo de filas (catálogo) o de leads, según módulo. */
  rowCount: number | null;
  /** Detalle técnico para logs. */
  lastError?: string;
  details?: {
    table?: string;
    /** Solo leads_linkedin_personal */
    linkedinPersonalAvailable?: boolean;
    fallbackLinkedinColumn?: "linkedin_director" | null;
  };
};

export type InitializeModuleResult = {
  module: ModuleId;
  ok: boolean;
  /** Si true, el cliente debe ejecutar SQL en Supabase (DDL no disponible vía REST). */
  needsSqlInDashboard?: boolean;
  sql?: string;
  message?: string;
  seedInserted?: boolean;
};
