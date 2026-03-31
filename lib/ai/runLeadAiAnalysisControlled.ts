/**
 * Flujo controlado de análisis IA por lead: un prompt del perfil por llamada, trazable.
 * No reemplaza al legacy: se activa solo con LEAD_AI_CONTROLLED_FLOW=1 en el route.
 */

import {
  buildLeadReportPromptShell,
  type LeadReportPromptShellCtx,
  type LeadReportPromptShellLead,
} from "@/lib/ai/leadReportPromptShell";

export type ControlledPromptStepStatus = "pending" | "running" | "done" | "error";

export type ControlledPromptStepRecord = {
  order: number;
  prompt_id: string;
  prompt_name: string;
  module_id: string;
  status: ControlledPromptStepStatus;
  output: string | null;
  error_message: string | null;
};

/** Módulos del perfil ya resueltos (solo validated + texto; orden = execution_order). */
export type ProfileModuleForControlledRun = {
  id: string;
  label: string;
  prompt: string;
  prompt_id: string;
  execution_order: number;
};

export type ProfileExecutionConfigForControlled = {
  basePrompt: string;
  modules: ProfileModuleForControlledRun[];
  cierreOfertaPrincipal?: string | null;
  tipoOrganizacionVendedora?: string | null;
};

export type ControlledLeadAiResult = {
  ai_report: string;
  steps: ControlledPromptStepRecord[];
};

const MEMORY_MODULE_IDS = new Set([
  "oportunidades",
  "vision_estrategica",
  "plan_de_crecimiento",
  "propuesta_de_crecimiento_easy",
]);

function stripTabHeaderForMemory(raw: string): string {
  return raw.replace(/^###\s+TAB:[^\s]+\s*\n+/i, "").trim();
}

function buildAccumulatedMemoryBlock(
  moduleResults: string[],
  modules: Array<{ id: string; label: string }>,
  currentIndex: number,
  maxCharsPerModule = 500,
  maxTotalChars = 7500
): string {
  if (currentIndex === 0) return "";
  const parts: string[] = [];
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

function moduleReceivesAccumulatedMemory(moduleId: string): boolean {
  return MEMORY_MODULE_IDS.has(String(moduleId || "").toLowerCase());
}

function isCierreVentaModuleId(moduleId: string): boolean {
  const id = String(moduleId || "").toLowerCase();
  return id === "cierre_venta" || id === "cierre_de_venta";
}

function applyCierrePromptVars(
  prompt: string,
  oferta: string | null | undefined,
  tipoOrg: string | null | undefined
): string {
  const o =
    (oferta ?? "").trim() ||
    "[Configurar en perfil: oferta principal — campo cierre_oferta_principal]";
  const t =
    (tipoOrg ?? "").trim() ||
    "[Configurar en perfil: tipo de organización vendedora — campo tipo_organizacion_vendedora]";
  return prompt
    .replace(/\{\{oferta_principal_nuestra_organizacion\}\}/g, o)
    .replace(/\{\{tipo_organizacion_vendedora\}\}/g, t);
}

function buildPersonalizacionIABlock(customPrompt: string | null | undefined, moduleId?: string): string | null {
  if (!customPrompt || !customPrompt.trim()) return null;
  let normalized = customPrompt.trim();
  normalized = normalized.replace(/\s{3,}/g, " ").replace(/\n{3,}/g, "\n\n");
  const MAX_LENGTH = 15000;
  if (normalized.length > MAX_LENGTH) {
    normalized = normalized.slice(0, MAX_LENGTH) + "\n\n(truncado)";
  }
  const moduleInstructions: Record<string, string> = {
    INVESTIGACION_DIGITAL:
      "Si no hay website disponible, usa este contexto como 'activo base' y propone estructura futura basada en la información proporcionada.",
    REDES_SOCIALES:
      "Si no hay redes sociales detectadas, propone estrategia de lanzamiento desde este contexto.",
    FODA: "Deriva fortalezas y diferenciadores del pitch/nota/proyecto descrito aquí.",
    OPORTUNIDADES: "Identifica oportunidades basadas en el proyecto/visión/roadmap descrito.",
    ACCIONES: "Genera acciones concretas basadas en el proyecto y objetivos descritos.",
    MATERIALES_LISTOS: "Usa mensajes y propuesta real del proyecto para crear materiales.",
    CIERRE_VENTA: "Usa la propuesta y mensajes del proyecto para construir argumentos de cierre.",
    PAUTA_PUBLICITARIA: "Considera el proyecto y audiencia objetivo descritos para proponer pauta.",
    PRESTIGIO_IA: "Evalúa el prestigio basado en el proyecto y contexto proporcionado.",
    POSICIONAMIENTO: "Deriva el posicionamiento del proyecto y diferenciadores descritos.",
    COMPETENCIA: "Analiza competencia considerando el proyecto y propuesta de valor descritos.",
  };
  const moduleInstruction = moduleId ? moduleInstructions[moduleId] || "" : "";
  const blockParts: string[] = [];
  blockParts.push("=== LEAD STRATEGIC CONTEXT (PRIMARY SOURCE) ===");
  blockParts.push("Este contenido fue provisto por el usuario y debe priorizarse.");
  blockParts.push("Si contradice inferencias basadas en ausencia de web/redes, prioriza este contexto.");
  blockParts.push("No lo ignores.");
  if (moduleInstruction) {
    blockParts.push(`\nInstrucción específica para este módulo: ${moduleInstruction}`);
  }
  blockParts.push(`\n${normalized}`);
  return blockParts.join("\n");
}

async function callOpenAiModule(params: {
  apiKey: string;
  systemPrompt: string;
  userContent: string;
}): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userContent },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI HTTP: ${JSON.stringify(err)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Ejecuta solo módulos del perfil con prompt no vacío; orden = execution_order.
 * Recompone `ai_report` uniendo bloques ### TAB:<module_id>.
 */
export type LeadReportShellContact = {
  nombre?: string | null;
  cargo?: string | null;
  telefono?: string | null;
  email?: string | null;
  is_primary?: boolean | null;
  es_principal?: boolean | null;
  principal?: boolean | null;
  notas?: string | null;
};

export type LeadAiModuleProgressInfo = {
  moduleKey: string;
  moduleLabel: string;
  index: number;
  total: number;
  phase: "start" | "done";
};

export async function runLeadAiAnalysisControlled(input: {
  apiKey: string;
  lead: LeadReportPromptShellLead;
  resolvedCtx: LeadReportPromptShellCtx;
  contacts: LeadReportShellContact[];
  ya_es_cliente_agencia: boolean;
  customPrompts?: { base?: string };
  executionProfile: ProfileExecutionConfigForControlled;
  getPromptBase: () => Promise<string>;
  /** Actualización de progreso en BD (POST async + polling). */
  onModuleProgress?: (info: LeadAiModuleProgressInfo) => void | Promise<void>;
}): Promise<ControlledLeadAiResult> {
  const {
    apiKey,
    lead,
    resolvedCtx,
    contacts,
    ya_es_cliente_agencia,
    customPrompts,
    executionProfile,
    getPromptBase,
    onModuleProgress,
  } = input;

  console.log("[IA CONTROLLED RUNNER] start", {
    leadId: lead.id,
    at: new Date().toISOString(),
  });

  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const modulesOrdered = [...executionProfile.modules]
    .filter((m) => typeof m.prompt === "string" && m.prompt.trim().length > 0)
    .sort((a, b) => a.execution_order - b.execution_order);

  console.log("[IA CONTROLLED RUNNER] prompts:total", {
    total: modulesOrdered.length,
    leadId: lead.id,
    module_ids: modulesOrdered.map((m) => m.id),
    execution_orders: modulesOrdered.map((m) => m.execution_order),
  });

  const steps: ControlledPromptStepRecord[] = modulesOrdered.map((m) => ({
    order: m.execution_order,
    prompt_id: m.prompt_id,
    prompt_name: m.label,
    module_id: m.id,
    status: "pending" as ControlledPromptStepStatus,
    output: null,
    error_message: null,
  }));

  console.log("[IA CONTROLLED RUNNER] before-shell", { leadId: lead.id, at: new Date().toISOString() });
  const { systemPrompt, userPrompt, cierreFrameExtra } = await buildLeadReportPromptShell({
    lead,
    resolvedCtx,
    contacts,
    ya_es_cliente_agencia,
    customPrompts,
    executionProfile,
    getPromptBase,
  });
  console.log("[IA CONTROLLED RUNNER] after-shell", {
    leadId: lead.id,
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
    at: new Date().toISOString(),
  });

  const moduleResults: string[] = [];
  const shellModules = modulesOrdered.map((m) => ({ id: m.id, label: m.label }));

  for (let i = 0; i < modulesOrdered.length; i++) {
    const mod = modulesOrdered[i];
    const step = steps[i];
    step.status = "running";

    console.log("[IA CONTROLLED RUNNER] step:start", {
      order: mod.execution_order,
      prompt_name: mod.label,
      module_id: mod.id,
      prompt_id: mod.prompt_id,
      index: i,
      at: new Date().toISOString(),
    });

    try {
      await onModuleProgress?.({
        moduleKey: mod.id,
        moduleLabel: mod.label ?? mod.id,
        index: i,
        total: modulesOrdered.length,
        phase: "start",
      });
      let modulePromptOriginal = mod.prompt;
      if (isCierreVentaModuleId(mod.id)) {
        modulePromptOriginal = applyCierrePromptVars(
          modulePromptOriginal,
          executionProfile.cierreOfertaPrincipal,
          executionProfile.tipoOrganizacionVendedora
        );
      }
      const modulePromptFinal = isCierreVentaModuleId(mod.id)
        ? `${modulePromptOriginal}\n\n${cierreFrameExtra}`
        : modulePromptOriginal;

      const personalizacionBlock = buildPersonalizacionIABlock(lead.custom_prompt ?? null, mod.id);
      const moduleContextParts: string[] = [];
      if (personalizacionBlock) moduleContextParts.push(personalizacionBlock);
      moduleContextParts.push(userPrompt);
      if (moduleReceivesAccumulatedMemory(mod.id) && i > 0) {
        const mem = buildAccumulatedMemoryBlock(moduleResults, shellModules, i);
        if (mem) moduleContextParts.push(mem);
      }
      moduleContextParts.push(`**TAREA ESPECÍFICA:**\n${modulePromptFinal}`);
      const baseModuleUserPrompt =
        moduleContextParts.join("\n\n") +
        `\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${mod.id}\n\nY luego el contenido del análisis. NO incluyas otros tabs ni texto fuera de este bloque.`;

      console.log("[IA CONTROLLED RUNNER] openai:await:start", {
        order: mod.execution_order,
        module_id: mod.id,
        userContentChars: baseModuleUserPrompt.length,
        at: new Date().toISOString(),
      });
      let moduleContent = await callOpenAiModule({
        apiKey,
        systemPrompt,
        userContent: baseModuleUserPrompt,
      });
      console.log("[IA CONTROLLED RUNNER] openai:await:done", {
        order: mod.execution_order,
        module_id: mod.id,
        contentChars: (moduleContent ?? "").length,
        at: new Date().toISOString(),
      });

      if (!moduleContent) {
        moduleContent = `### TAB:${mod.id}\n\nSin contenido generado.`;
      } else if (!moduleContent.startsWith(`### TAB:${mod.id}`)) {
        moduleContent = `### TAB:${mod.id}\n\n${moduleContent}`;
      }

      moduleResults.push(moduleContent);
      step.status = "done";
      step.output = moduleContent;
      step.error_message = null;
      console.log("[IA CONTROLLED RUNNER] step:done", {
        order: mod.execution_order,
        prompt_name: mod.label,
        module_id: mod.id,
        at: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[IA CONTROLLED RUNNER] step:error", {
        order: mod.execution_order,
        prompt_name: mod.label,
        module_id: mod.id,
        error: msg,
        at: new Date().toISOString(),
      });
      step.status = "error";
      step.output = null;
      step.error_message = msg;
      const placeholder = `### TAB:${mod.id}\n\nError generando este módulo: ${msg}`;
      moduleResults.push(placeholder);
    } finally {
      await onModuleProgress?.({
        moduleKey: mod.id,
        moduleLabel: mod.label ?? mod.id,
        index: i,
        total: modulesOrdered.length,
        phase: "done",
      });
    }
  }

  const finalReport = moduleResults.join("\n\n");
  const hasCustomization = !!(lead.custom_prompt && String(lead.custom_prompt).trim());
  const ai_report = hasCustomization
    ? `*Se aplicó personalización adicional: Sí*\n\n${finalReport}`
    : finalReport;

  console.log("[IA CONTROLLED RUNNER] end", {
    leadId: lead.id,
    done: steps.filter((s) => s.status === "done").length,
    errors: steps.filter((s) => s.status === "error").length,
    at: new Date().toISOString(),
  });

  return { ai_report, steps };
}
