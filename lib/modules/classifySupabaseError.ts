/**
 * Clasifica errores típicos de PostgREST / Postgres expuestos por supabase-js.
 */

export type SchemaErrorKind = "missing_table" | "missing_column" | "unknown";

export function classifySchemaError(err: { message?: string; code?: string } | null | undefined): {
  kind: SchemaErrorKind;
  hint?: string;
} {
  if (!err) return { kind: "unknown" };
  const msg = (err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("relation ") && msg.includes(" does not exist") ||
    (msg.includes("schema cache") && msg.includes("table"))
  ) {
    return { kind: "missing_table", hint: err.message };
  }

  if (
    code === "42703" ||
    code === "PGRST204" ||
    (msg.includes("column ") && msg.includes(" does not exist")) ||
    (msg.includes("could not find") && msg.includes("column")) ||
    (msg.includes("schema cache") && msg.includes("column"))
  ) {
    return { kind: "missing_column", hint: err.message };
  }

  return { kind: "unknown", hint: err.message };
}

export function logModuleSchemaIssue(module: string, context: string, err: unknown): void {
  if (process.env.NODE_ENV === "production") {
    console.error(`[module:${module}] ${context}`, err instanceof Error ? err.message : err);
  } else {
    console.warn(`[module:${module}] ${context}`, err);
  }
}
