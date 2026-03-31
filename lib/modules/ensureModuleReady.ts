import type { SupabaseClient } from "@supabase/supabase-js";
import { classifySchemaError, logModuleSchemaIssue } from "./classifySupabaseError";
import { MODULE_REGISTRY } from "./registry";
import type { ModuleId, ModuleReadinessResult, ModuleReadinessStatus } from "./types";

function desiredColumns(moduleId: ModuleId): string[] {
  const sets = MODULE_REGISTRY[moduleId].columnSets;
  return sets[0] ?? [];
}

export async function ensureModuleReady(
  sb: SupabaseClient,
  moduleId: ModuleId
): Promise<ModuleReadinessResult> {
  const def = MODULE_REGISTRY[moduleId];
  const table = def.table;
  const fullDesired = desiredColumns(moduleId);

  let lastErr: string | undefined;

  for (const cols of def.columnSets) {
    const selectList = cols.join(",");
    const { error, count } = await sb.from(table).select(selectList, { count: "exact", head: true });
    if (!error) {
      const rowCount = count ?? 0;
      const missing = fullDesired.filter((c) => !cols.includes(c));

      let status: ModuleReadinessStatus = "ok";
      if (def.treatEmptyAsModuleState && rowCount === 0) {
        status = "empty";
      }

      const base: ModuleReadinessResult = {
        module: moduleId,
        status,
        usableColumns: cols,
        missingColumns: missing,
        rowCount,
        details: { table },
      };

      if (moduleId === "leads_linkedin_personal") {
        const hasPersonal = cols.includes("linkedin_personal");
        const hasDirector = cols.includes("linkedin_director");
        base.details = {
          ...base.details,
          linkedinPersonalAvailable: hasPersonal,
          fallbackLinkedinColumn: hasPersonal ? null : hasDirector ? "linkedin_director" : null,
        };
        if (!hasPersonal && missing.includes("linkedin_personal")) {
          logModuleSchemaIssue(
            moduleId,
            "Columna linkedin_personal ausente; UI usará linkedin_director si existe.",
            new Error("missing linkedin_personal")
          );
        }
      }

      if (missing.length > 0) {
        logModuleSchemaIssue(
          moduleId,
          `Fallback de columnas: operando con [${cols.join(", ")}], faltan [${missing.join(", ")}]`,
          new Error(lastErr ?? "column fallback")
        );
      }

      return base;
    }

    lastErr = error.message;
    const c = classifySchemaError(error);
    if (c.kind === "missing_table") {
      return {
        module: moduleId,
        status: "missing_schema",
        usableColumns: [],
        missingColumns: fullDesired,
        rowCount: null,
        lastError: error.message,
        details: { table },
      };
    }
    if (c.kind !== "missing_column") {
      return {
        module: moduleId,
        status: "missing_schema",
        usableColumns: [],
        missingColumns: fullDesired,
        rowCount: null,
        lastError: error.message,
        details: { table },
      };
    }
    /* missing_column: probar siguiente columnSet */
  }

  return {
    module: moduleId,
    status: "missing_schema",
    usableColumns: [],
    missingColumns: fullDesired,
    rowCount: null,
    lastError: lastErr,
    details: { table },
  };
}
