/**
 * Valida el motor IA con perfil "Agencia de Marketing / MODO EASY" sin pasar por HTTP.
 * Uso: node scripts/validate-mod-easy-motor.mjs [lead_id]
 * Requiere: .env.local con OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dirname, "..", ".env.local");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  /* optional */
}

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

function resolveLeadContext(lead) {
  const empresa = lead.empresas;
  const websiteFromLead = (lead.website ?? "").trim();
  const websiteFromEmpresa = (empresa?.web ?? "").trim() || "";
  const resolvedWebsite = websiteFromLead || websiteFromEmpresa || "";
  const instagramFromEmpresa = (empresa?.instagram ?? "").trim() || "";
  const objetivos = Array.isArray(lead.objetivos) ? lead.objetivos.join(", ") : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) ? lead.audiencia.join(", ") : (lead.audiencia ?? "").trim();
  return {
    nombre: lead.nombre ?? "Lead",
    origen: lead.origen ?? "No especificado",
    pipeline: lead.pipeline ?? "No especificado",
    notas: lead.notas ?? "",
    website: resolvedWebsite,
    websiteSource: websiteFromLead ? "Lead" : websiteFromEmpresa ? "Entidad" : "N/A",
    instagram: instagramFromEmpresa,
    instagramSource: instagramFromEmpresa ? "Entidad" : "N/A",
    facebook: (empresa?.facebook ?? "").trim() || "",
    linkedinEmpresa: (lead.linkedin_empresa ?? "").trim() || "",
    linkedinDirector: (lead.linkedin_director ?? "").trim() || "",
    meetUrl: (lead.meet_url ?? "").trim() || "",
    tamano: (lead.tamano ?? "").trim(),
    objetivos,
    audiencia,
    oferta: (lead.oferta ?? "").trim(),
    rubro: empresa?.rubros?.nombre?.trim() || "",
    direccion: (empresa?.direccion ?? "").trim(),
    ciudad: (empresa?.ciudad ?? "").trim(),
    pais: (empresa?.pais ?? "").trim(),
    clienteHistorial: "",
  };
}

const MODULE_IDS_WITH_ACCUMULATED_MEMORY = new Set([
  "oportunidades",
  "vision_estrategica",
  "plan_de_crecimiento",
  "propuesta_de_crecimiento_easy",
]);

function stripTabHeaderForMemory(raw) {
  return raw.replace(/^###\s+TAB:[^\s]+\s*\n+/i, "").trim();
}

function buildAccumulatedMemoryBlock(moduleResults, modules, currentIndex, maxCharsPerModule = 500, maxTotalChars = 7500) {
  if (currentIndex === 0) return "";
  const parts = [];
  let total = 0;
  for (let j = 0; j < currentIndex; j++) {
    const label = modules[j]?.label ?? `Módulo ${j + 1}`;
    let raw = stripTabHeaderForMemory(moduleResults[j] ?? "");
    let brief = raw.length > maxCharsPerModule ? raw.slice(0, maxCharsPerModule) + "…" : raw;
    const chunk = `**[${label}]**\n${brief}`;
    if (total + chunk.length > maxTotalChars) {
      const room = Math.max(0, maxTotalChars - total - 80);
      brief = brief.slice(0, room) + "…";
      parts.push(`**[${label}]**\n${brief}`);
      break;
    }
    total += chunk.length;
    parts.push(chunk);
  }
  const detectedLines = parts
    .map((chunk, idx) => {
      const firstLine = String(chunk).split("\n").slice(1).join(" ").trim().slice(0, 150);
      return `${idx + 1}) ${firstLine || "Hallazgo previo resumido"}`;
    })
    .join("\n");
  return `**MEMORIA ACUMULADA (módulos anteriores):**\n\n${parts.join("\n\n---\n\n")}\n\n**LÍNEAS YA DETECTADAS (NO repetir literal):**\n${detectedLines}\n\n**REGLA OBLIGATORIA DE NO REPETICIÓN:**\n- Está PROHIBIDO repetir tácticas/diagnósticos de esta memoria como hallazgo nuevo.\n- Si un punto previo se vuelve prioritario, solo puede aparecer como re-priorización explícita con evidencia nueva y justificación de cambio de prioridad.`;
}

function moduleReceivesAccumulatedMemory(moduleId) {
  return MODULE_IDS_WITH_ACCUMULATED_MEMORY.has(String(moduleId || "").toLowerCase());
}

function isCierreVentaModuleId(moduleId) {
  const id = String(moduleId || "").toLowerCase();
  return id === "cierre_venta" || id === "cierre_de_venta";
}

function applyCierrePromptVars(prompt, oferta, tipoOrg) {
  const o =
    String(oferta ?? "").trim() ||
    "[Configurar en perfil: oferta principal — campo cierre_oferta_principal]";
  const t =
    String(tipoOrg ?? "").trim() ||
    "[Configurar en perfil: tipo de organización vendedora — campo tipo_organizacion_vendedora]";
  return prompt
    .replace(/\{\{oferta_principal_nuestra_organizacion\}\}/g, o)
    .replace(/\{\{tipo_organizacion_vendedora\}\}/g, t);
}

async function getProfileExecution(sb, profileId) {
  let { data: profile, error: e1 } = await sb
    .from("ai_analysis_profiles")
    .select("id,name,base_instructions,is_active,cierre_oferta_principal,tipo_organizacion_vendedora")
    .eq("id", profileId)
    .maybeSingle();
  if (e1 && String(e1.message || "").includes("does not exist")) {
    // Compatibilidad cuando aún no está aplicada la migración 054 en la BD objetivo.
    const fallback = await sb
      .from("ai_analysis_profiles")
      .select("id,name,base_instructions,is_active")
      .eq("id", profileId)
      .maybeSingle();
    profile = fallback.data
      ? {
          ...fallback.data,
          cierre_oferta_principal: null,
          tipo_organizacion_vendedora: null,
        }
      : null;
    e1 = fallback.error;
  }
  if (e1 || !profile || profile.is_active !== true) return null;

  const { data: profilePrompts, error: e2 } = await sb
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

  if (e2) return null;
  const rows = Array.isArray(profilePrompts) ? profilePrompts : [];
  const modules = rows
    .map((row) => {
      const p = row?.ai_prompts;
      if (!p || p.status !== "validated") return null;
      const promptText = typeof p.prompt_content === "string" ? p.prompt_content.trim() : "";
      if (!promptText) return null;
      return {
        id: toFlexibleModuleId(String(p.name ?? ""), String(p.id ?? row.prompt_id ?? "")),
        label: String(p.name ?? "Prompt"),
        prompt: promptText,
      };
    })
    .filter(Boolean);

  return {
    basePrompt: String(profile.base_instructions ?? "").trim(),
    modules,
    profileName: profile.name,
    cierreOfertaPrincipal: profile.cierre_oferta_principal != null ? String(profile.cierre_oferta_principal) : null,
    tipoOrganizacionVendedora: profile.tipo_organizacion_vendedora != null ? String(profile.tipo_organizacion_vendedora) : null,
  };
}

async function openaiChat(apiKey, systemPrompt, userContent) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || JSON.stringify(err));
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

function buildUserPromptBase(resolvedCtx, lead, contacts, fecha) {
  const empresa = lead.empresas;
  const websiteDisplay = resolvedCtx.website ? `${resolvedCtx.website} (${resolvedCtx.websiteSource})` : "No proporcionado";
  const parts = [];
  parts.push(`## DATOS DE ENTIDAD (empresa vinculada)
${empresa?.nombre ? `- Nombre: ${empresa.nombre}` : ""}
${resolvedCtx.rubro ? `- Rubro: ${resolvedCtx.rubro}` : ""}
${resolvedCtx.direccion ? `- Dirección: ${resolvedCtx.direccion}` : ""}
${resolvedCtx.ciudad ? `- Ciudad: ${resolvedCtx.ciudad}` : ""}
${resolvedCtx.pais ? `- País: ${resolvedCtx.pais}` : ""}
- Website: ${resolvedCtx.website || "—"}
- Instagram: ${resolvedCtx.instagram || "—"}
- Facebook: ${resolvedCtx.facebook || "—"}
${!empresa ? "- No hay entidad vinculada" : ""}

## DATOS DEL LEAD (nuevos)
- Empresa/Nombre: ${resolvedCtx.nombre}
- Lead ID: ${lead.id}
- Origen: ${resolvedCtx.origen}
- Pipeline: ${resolvedCtx.pipeline}
- Website (efectivo): ${websiteDisplay}
- Tamaño: ${resolvedCtx.tamano || "No especificado"}
- Objetivos: ${resolvedCtx.objetivos || "No especificados"}
- ¿Ya es cliente de la Agencia?: ${resolvedCtx.audiencia || "No especificado"}
- Notas de prensa e info adicional.: ${resolvedCtx.oferta || "No especificado"}
- LinkedIn Empresa: ${resolvedCtx.linkedinEmpresa || "—"}
- LinkedIn Director: ${resolvedCtx.linkedinDirector || "—"}
- Meet URL: ${resolvedCtx.meetUrl || "—"}
- Notas: ${resolvedCtx.notas || "Sin notas"}

${contacts?.length ? `## CONTACTOS DEL LEAD\n${contacts.map((c, i) => `${i + 1}) ${c.nombre}${c.cargo ? ` (${c.cargo})` : ""}`).join("\n")}` : ""}

Fecha: ${fecha}`);
  return parts.join("\n\n");
}

function parseTabs(report) {
  const tabs = {};
  const re = /###\s+TAB:\s*([^\s]+)\s*\n([\s\S]*?)(?=###\s+TAB:|$)/gi;
  let m;
  while ((m = re.exec(report)) !== null) {
    tabs[m[1]] = m[2].trim();
  }
  return tabs;
}

const leadSelect =
  "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_custom_prompt,empresa_id,linkedin_empresa,linkedin_director,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(nombre))";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!url || !key) throw new Error("Faltan variables Supabase");
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: prof } = await sb
    .from("ai_analysis_profiles")
    .select("id,name")
    .ilike("name", "%MODO EASY%")
    .eq("is_active", true)
    .maybeSingle();

  if (!prof?.id) throw new Error('Perfil "Agencia de Marketing / MODO EASY" no encontrado');

  const exec = await getProfileExecution(sb, prof.id);
  if (!exec?.modules?.length) throw new Error("Perfil sin módulos ejecutables");

  let leadId = process.argv[2];
  if (!leadId) {
    const { data: l } = await sb.from("leads").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    leadId = l?.id;
  }
  if (!leadId) throw new Error("No hay lead_id");

  const { data: lead, error: le } = await sb.from("leads").select(leadSelect).eq("id", leadId).maybeSingle();
  if (le || !lead) throw new Error(le?.message || "Lead no encontrado");

  let contacts = [];
  try {
    const { data: c } = await sb.from("lead_contacts").select("nombre,cargo,telefono,email,is_primary,notas").eq("lead_id", leadId);
    contacts = Array.isArray(c) ? c : [];
  } catch {
    contacts = [];
  }

  const resolvedCtx = resolveLeadContext(lead);
  const fecha = new Date().toLocaleDateString("es-UY", { year: "numeric", month: "long", day: "numeric" });
  const userPrompt = buildUserPromptBase(resolvedCtx, lead, contacts, fecha);

  const fallbackNeutro = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

  let systemPrompt = (exec.basePrompt || "").trim() || fallbackNeutro;
  if (exec.basePrompt?.trim() && !exec.basePrompt.toLowerCase().includes("no mencionar cámara")) {
    systemPrompt = `${systemPrompt}\n\nREGLAS ESTRICTAS:\n- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.\n- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;
  }

  const sellerHintFromSystem = systemPrompt.toLowerCase().includes("cámara")
    ? "cámara"
    : systemPrompt.toLowerCase().includes("agencia")
      ? "agencia"
      : systemPrompt.toLowerCase().includes("consultora")
        ? "consultora"
        : "organización";

  const sellerHint = String(exec.tipoOrganizacionVendedora ?? "").trim() || sellerHintFromSystem;

  const cierreFrameExtra = `
CONTEXTO DEL VENDEDOR:
- Nuestra organización tipo: ${sellerHint}.

ACLARACIÓN CRÍTICA (NO NEGOCIABLE):
- Este módulo trata sobre cómo "NOSOTROS" (el usuario del CRM / nuestra organización) cerramos la venta con ESTE lead.
- NO expliques cómo el lead cierra ventas con sus clientes.

ENTREGABLES:
1) Objetivo de cierre
2) Estrategia de cierre paso a paso
3) Guión de cierre
4) Objeciones y respuestas
5) Follow-up 72h
6) Señales de avance y riesgo
`;

  const results = [];
  const fullChunks = [];
  const moduleResults = [];

  for (let i = 0; i < exec.modules.length; i++) {
    const mod = exec.modules[i];
    let modulePromptOriginal = mod.prompt;
    if (isCierreVentaModuleId(mod.id)) {
      modulePromptOriginal = applyCierrePromptVars(
        modulePromptOriginal,
        exec.cierreOfertaPrincipal,
        exec.tipoOrganizacionVendedora
      );
    }
    let modulePromptFinal = modulePromptOriginal;
    if (isCierreVentaModuleId(mod.id)) {
      modulePromptFinal = `${modulePromptOriginal}\n\n${cierreFrameExtra}`;
    }

    const mem =
      moduleReceivesAccumulatedMemory(mod.id) && i > 0
        ? buildAccumulatedMemoryBlock(moduleResults, exec.modules, i)
        : "";
    const moduleUserPrompt =
      `${userPrompt}${mem ? `\n\n${mem}` : ""}\n\n**TAREA ESPECÍFICA:**\n${modulePromptFinal}\n\n` +
      `**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${mod.id}\n\nY luego el contenido del análisis.`;

    const content = await openaiChat(apiKey, systemPrompt, moduleUserPrompt);
    let formatted = content;
    if (!formatted.startsWith(`### TAB:${mod.id}`)) {
      formatted = `### TAB:${mod.id}\n\n${formatted}`;
    }
    fullChunks.push(formatted);
    moduleResults.push(formatted);
    results.push({
      order: results.length + 1,
      module_id: mod.id,
      label: mod.label,
      content: formatted.replace(/^###\s+TAB:\S+\s*\n+/, "").trim(),
    });
  }

  const fullReport = fullChunks.join("\n\n");
  const tabs = parseTabs(fullReport);

  const out = {
    meta: {
      profile: exec.profileName,
      profile_id: prof.id,
      lead_id: leadId,
      lead_nombre: lead.nombre,
      modules_run: exec.modules.map((m) => ({ order: exec.modules.indexOf(m) + 1, id: m.id, label: m.label })),
    },
    grouped_by_prompt: results,
    full_report_markdown: fullReport,
    tab_keys_parsed: Object.keys(tabs),
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
