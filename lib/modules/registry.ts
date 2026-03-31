import type { ModuleId } from "./types";

export type ModuleRegistryEntry = {
  table: string;
  /** Orden: primero el conjunto más completo; se prueba hasta que una consulta funcione. */
  columnSets: string[][];
  /** Si true, status `empty` cuando rowCount === 0 y el esquema es válido. */
  treatEmptyAsModuleState: boolean;
};

export const MODULE_REGISTRY: Record<ModuleId, ModuleRegistryEntry> = {
  ia_categories: {
    table: "ai_categories",
    columnSets: [
      ["id", "name", "description", "is_active", "created_at"],
      ["id", "name", "is_active", "created_at"],
      ["id", "name", "created_at"],
      ["id", "name"],
    ],
    treatEmptyAsModuleState: true,
  },
  leads_linkedin_personal: {
    table: "leads",
    columnSets: [
      ["id", "linkedin_personal", "linkedin_director"],
      ["id", "linkedin_personal"],
      ["id", "linkedin_director"],
      ["id"],
    ],
    treatEmptyAsModuleState: false,
  },
};
