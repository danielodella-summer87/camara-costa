import type { SupabaseClient } from "@supabase/supabase-js";
import { isLeadActive } from "@/lib/leads/leadStatusPolicy";

const CONFIG_KEY = "allow_multiple_leads_per_initiative";

function isMissingColumnError(message: string | undefined, table: string, column: string): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes(`could not find the '${column.toLowerCase()}' column of '${table.toLowerCase()}'`);
}

/**
 * Lee `public.config`: si falta la fila o el valor, equivale a `false` (un solo lead activo por iniciativa).
 */
export async function getAllowMultipleLeadsPerInitiative(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.from("config").select("value").eq("key", CONFIG_KEY).maybeSingle();
  const v = (data?.value ?? "false").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Primer lead activo (`isLeadActive`, ver `leadStatusPolicy`) con `iniciativa_id` o `empresa_id` = id de iniciativa.
 */
export async function findActiveLeadIdForInitiative(
  sb: SupabaseClient,
  initiativeEmpresaId: string
): Promise<string | null> {
  const id = initiativeEmpresaId.trim();
  if (!id) return null;

  let res = await sb
    .from("leads")
    .select("id,pipeline")
    .or(`iniciativa_id.eq.${id},empresa_id.eq.${id}`);

  if (res.error && isMissingColumnError(res.error.message, "leads", "iniciativa_id")) {
    res = await sb.from("leads").select("id,pipeline").eq("empresa_id", id);
  }

  if (res.error || !res.data?.length) return null;

  for (const row of res.data as { id: string; pipeline: string | null }[]) {
    if (isLeadActive(row.pipeline)) return row.id;
  }
  return null;
}
