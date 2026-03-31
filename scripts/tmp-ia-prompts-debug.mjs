/**
 * Réplica de los logs [IA PROMPTS DEBUG] de getProfileExecutionConfig + chequeo config IA (UI).
 * Uso: node scripts/tmp-ia-prompts-debug.mjs
 * Lee .env.local (no commitear secretos).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const raw = readFileSync(envPath, "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  env[k] = v;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

function toFlexibleModuleId(name, id) {
  const n = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return n || `prompt_${String(id).slice(0, 8)}`;
}

function isPromptStatusValidated(status) {
  return String(status ?? "").trim().toLowerCase() === "validated";
}

function log(label, payload) {
  console.log(`[IA PROMPTS DEBUG] ${label}`, JSON.stringify(payload, null, 0));
}

const { data: leadRow } = await sb.from("leads").select("id").limit(1).maybeSingle();
const leadId = leadRow?.id ?? null;

const { data: profiles } = await sb
  .from("ai_analysis_profiles")
  .select("id,name,is_active")
  .ilike("name", "Easy");

const easyProfile =
  (profiles || []).find((p) => String(p.name || "").trim().toLowerCase() === "easy" && p.is_active === true) ||
  (profiles || []).find((p) => String(p.name || "").trim().toLowerCase() === "easy") ||
  (profiles || [])[0] ||
  null;

const profileId = easyProfile?.id ?? null;

console.log("--- IDs para POST de prueba ---");
console.log("lead_id:", leadId);
console.log("profile_id (Easy):", profileId);
console.log("profile row:", JSON.stringify(easyProfile));

if (!profileId) {
  console.error("No se encontró perfil Easy");
  process.exit(1);
}

log("getProfileExecutionConfig:input", {
  profile_id: profileId,
  note: "No hay string de perfil tipo Easy/easy en el query; solo UUID de ai_analysis_profiles.",
});

const { data: profile, error: profileError } = await sb
  .from("ai_analysis_profiles")
  .select("id,name,base_instructions,is_active,cierre_oferta_principal,tipo_organizacion_vendedora")
  .eq("id", profileId)
  .maybeSingle();

log("getProfileExecutionConfig:profileRow", {
  error: profileError?.message ?? null,
  profile_name: profile?.name ?? null,
  is_active: profile?.is_active ?? null,
});

const { data: profilePrompts, error: promptsError } = await sb
  .from("ai_profile_prompts")
  .select(
    `
    prompt_id,
    execution_order,
    enabled_by_default,
    ai_prompts (
      id,
      name,
      prompt_content,
      status
    )
  `
  )
  .eq("profile_id", profileId)
  .eq("enabled_by_default", true)
  .order("execution_order", { ascending: true });

const rawRowCount = Array.isArray(profilePrompts) ? profilePrompts.length : 0;

log("getProfileExecutionConfig:profilePromptsQuery", {
  error: promptsError?.message ?? null,
  rawRowCount,
});

const rows = Array.isArray(profilePrompts) ? profilePrompts : [];
const skipReasons = [];
const modules = [];

for (const row of rows) {
  const p = row?.ai_prompts;
  const pid = row?.prompt_id ?? p?.id ?? "?";
  if (!p) {
    skipReasons.push(`prompt_id=${pid}: join ai_prompts vacío`);
    continue;
  }
  if (!isPromptStatusValidated(p.status)) {
    skipReasons.push(
      `prompt_id=${pid} name=${String(p.name ?? "").slice(0, 40)}: status="${String(p.status)}" (requiere validated)`
    );
    continue;
  }
  const promptText = typeof p.prompt_content === "string" ? p.prompt_content.trim() : "";
  if (!promptText) {
    skipReasons.push(`prompt_id=${pid}: prompt_content vacío`);
    continue;
  }
  const moduleId = toFlexibleModuleId(String(p.name ?? ""), String(p.id ?? row.prompt_id ?? ""));
  modules.push({ id: moduleId, label: String(p.name ?? "Prompt") });
}

log("getProfileExecutionConfig:modulesResolved", {
  count: modules.length,
  moduleIds: modules.map((m) => m.id),
  skipped: skipReasons,
  skippedTotal: skipReasons.length,
});

// También: filas del perfil Easy con enabled_by_default false (no entran al query)
const { data: allLinks } = await sb
  .from("ai_profile_prompts")
  .select("prompt_id, enabled_by_default, ai_prompts(name,status)")
  .eq("profile_id", profileId);

const disabled = (allLinks || []).filter((r) => r.enabled_by_default !== true);
log("getProfileExecutionConfig:linksDisabledNotInQuery", {
  count: disabled.length,
  prompt_ids: disabled.map((d) => d.prompt_id),
});

// Config IA cliente (origen del mensaje "No hay prompts de módulos")
const { data: cfgRow } = await sb.from("config").select("value").eq("key", "ai_prompts_v1").maybeSingle();
let modulosKeys = [];
if (cfgRow?.value) {
  try {
    const j = JSON.parse(cfgRow.value);
    modulosKeys = j.modulos && typeof j.modulos === "object" ? Object.keys(j.modulos) : [];
    const nonEmpty = modulosKeys.filter((k) => String(j.modulos[k] || "").trim());
    log("config/ia ai_prompts_v1 (para UI)", {
      totalModuloKeys: modulosKeys.length,
      nonEmptyModuloKeys: nonEmpty.length,
      sampleKeys: modulosKeys.slice(0, 15),
    });
  } catch {
    log("config/ia ai_prompts_v1", { parseError: true });
  }
} else {
  log("config/ia ai_prompts_v1", { missing: true });
}
