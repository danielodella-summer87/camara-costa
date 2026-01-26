import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

console.log(
  "[AI DEBUG] OPENAI_API_KEY presente:",
  !!process.env.OPENAI_API_KEY
);


function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type LeadRow = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;

  website?: string | null;
  objetivos?: string | any | null; // text (puede venir como array por backward compatibility)
  audiencia?: string | any | null; // text (puede venir como array por backward compatibility)
  tamano?: string | null;
  oferta?: string | null;

  ai_context?: string | null;
  ai_report?: string | null;
  ai_report_updated_at?: string | null;
  ai_custom_prompt?: string | null;
};

function safeId(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function extractUrls(text: string) {
  const m = text.match(/https?:\/\/[^\s)]+/gi);
  return m ? Array.from(new Set(m)) : [];
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Genera un informe técnico fallback cuando falla la IA
 */
function generateFallbackReport(lead: LeadRow): string {
  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim();
  const tamano = lead.tamano ?? "No especificado";
  // Soportar tanto string como array (backward compatibility)
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  const notas = lead.notas ?? "";
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `# Informe Técnico de Oportunidades — ${nombre}

Fecha: ${fecha}
Lead ID: ${leadId}

> ⚠️ **Nota:** La generación automática con IA no está disponible. Este es un informe técnico básico basado en los datos disponibles.

## Resumen ejecutivo (decisión)
- Completar información faltante en la ficha para habilitar diagnóstico completo (impacto: alto — permite identificar oportunidades reales)
- ${website ? `Validar rubro y propuesta de valor mediante análisis de ${website}` : "Solicitar website para validar rubro y propuesta de valor"} (impacto: alto — confirma fit estratégico)
- Mapear contactos compatibles por objetivos y audiencia (impacto: medio — acelera networking efectivo)
- Definir métricas de éxito para la relación (impacto: medio — permite medir ROI)
- Agendar welcome call para validar expectativas y objetivos (impacto: alto — establece relación desde el inicio)

## Diagnóstico técnico

### Hechos confirmados
${objetivos ? `- Objetivos declarados: ${objetivos}` : "- No se especificaron objetivos"}
${audiencia ? `- Audiencia objetivo: ${audiencia}` : "- No se especificó audiencia"}
${website ? `- Website disponible: ${website}` : "- No se proporcionó website"}
${oferta ? `- Oferta: ${oferta}` : "- No se especificó oferta"}
- Pipeline: ${pipeline}
- Tamaño: ${tamano}
- Origen: ${origen}

### Hipótesis
- ${!objetivos ? "Falta definir objetivos claros de afiliación — limita identificación de oportunidades específicas" : "Objetivos identificados — requiere validación y priorización"}
- ${!audiencia ? "Falta definir audiencia objetivo — dificulta mapeo de contactos compatibles" : "Audiencia definida — posible mapeo de contactos con fit"}
- ${!website ? "Falta website — no se puede validar rubro ni propuesta de valor sin análisis" : "Website disponible — requiere análisis de contenido para inferir rubro y propuesta"}
- ${!oferta ? "Falta oferta específica — no se puede evaluar valor para la comunidad" : "Oferta definida — requiere validación de impacto y viabilidad"}

## Oportunidades priorizadas

| Prioridad | Oportunidad | Impacto | Evidencia/Señal | Primer paso | Métrica |
|-----------|-------------|---------|-----------------|-------------|---------|
| Alta | Completar información faltante | Alto — habilita diagnóstico completo | Campos vacíos en ficha | Solicitar datos faltantes al lead | % de campos completados |
| Alta | ${website ? `Validar rubro y propuesta mediante ${website}` : "Solicitar website para análisis"} | Alto — confirma fit estratégico | ${website ? "Website disponible" : "Website faltante"} | ${website ? `Revisar ${website}` : "Solicitar URL"} | Validación de rubro (sí/no) |
| Media | Mapear contactos compatibles | Medio — acelera networking | Objetivos y audiencia ${audiencia ? "definidos" : "faltantes"} | Identificar 3-5 contactos con fit | Número de contactos mapeados |
| Media | Definir métricas de éxito | Medio — permite medir ROI | Objetivos ${objetivos ? "identificados" : "pendientes"} | Establecer KPIs con el lead | Métricas definidas (número) |
| Baja | Plan de contenido y visibilidad | Bajo — complementa estrategia | Oferta ${oferta ? "disponible" : "pendiente"} | Evaluar oportunidades de co-marketing | Acciones de contenido (número) |

## Acciones en 72 horas
- [ ] Validar información faltante en la ficha del lead
- [ ] ${website ? `Revisar website: ${website}` : "Solicitar website al lead"}
- [ ] Identificar 3-5 contactos potenciales con fit por objetivos y audiencia
- [ ] Agendar welcome call inicial para validar expectativas
- [ ] Definir métricas de éxito preliminares

## Plan 30–90 días

### 30 días
- Onboarding completo del lead
- Validación de objetivos y priorización
- Primeras conexiones con 3-5 contactos identificados
- Establecimiento de métricas base

### 60 días
- Activación de beneficios principales
- Seguimiento de métricas y ajuste de estrategia
- Segunda ronda de conexiones con contactos
- Evaluación de impacto inicial

### 90 días
- Evaluación completa de impacto de la afiliación
- Planificación de próximos pasos y escalamiento
- Renovación o ajuste de estrategia según resultados
- Documentación de aprendizajes

## Riesgos y bloqueos
- **Información incompleta:** La ficha tiene campos faltantes que limitan el diagnóstico (mitigación: solicitar datos faltantes prioritarios)
- **Falta de contexto:** Sin website o información adicional, es difícil validar fit estratégico (mitigación: solicitar website y contexto adicional)
- **Objetivos no priorizados:** ${objetivos ? "Objetivos identificados pero requieren priorización" : "Falta definir objetivos"} (mitigación: welcome call para validar y priorizar)

## Datos faltantes
${!website ? "- ¿Cuál es el website de la empresa? (crítico para validar rubro y propuesta)" : ""}
${!objetivos ? "- ¿Cuáles son los objetivos principales?" : ""}
${!audiencia ? "- ¿A qué audiencia le vende la empresa? (B2B, B2C, Gobierno, etc.)" : ""}
${!oferta ? "- ¿Qué ofrece específicamente?" : ""}
${!notas ? "- ¿Hay notas adicionales o contexto relevante sobre el lead?" : ""}
${website && objetivos && audiencia && oferta ? "- Todos los campos principales están completos" : ""}

${website ? `## Hipótesis por website

⚠️ **Inferencias basadas en dominio, sin navegación ni análisis de contenido real**

- Dominio: ${website}
- Posible rubro: Inferir basado en dominio (requiere análisis de contenido)
- Propuesta de valor: Requiere revisión de contenido del sitio
- Audiencia objetivo: Validar con análisis de website
- Fit estratégico: Requiere validación con información completa

*Nota: Estas son inferencias preliminares. Se requiere análisis real del contenido del website para confirmar.*` : ""}

---
*Informe generado automáticamente. Para un análisis más profundo, se requiere generación con IA.*
`;
}

/**
 * Genera un informe técnico usando OpenAI
 */
/**
 * Lee el prompt base desde la tabla config
 */
async function getPromptBase(): Promise<string> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("config")
      .select("value")
      .eq("key", "leads_ai_prompt_base")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (ok si no existe)
      console.error("Error leyendo prompt base desde config:", error);
      return "";
    }

    return (data?.value ?? "").trim();
  } catch (e: any) {
    console.error("Error inesperado leyendo prompt base:", e);
    return "";
  }
}

/**
 * Genera un solo módulo del informe usando prompt recibido directamente
 */
async function generateSingleModuleWithPrompt(
  lead: LeadRow & { custom_prompt?: string | null },
  moduleId: string,
  basePrompt: string,
  modulePrompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  // Usar prompt base recibido directamente (no re-leer del server)
  const fallbackNeutro = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

  let systemPrompt = basePrompt.trim() || fallbackNeutro;
  if (basePrompt.trim() && !basePrompt.toLowerCase().includes("no mencionar cámara")) {
    systemPrompt = `${systemPrompt}\n\nREGLAS ESTRICTAS:\n- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.\n- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;
  }

  // Construir user prompt
  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim();
  const tamano = lead.tamano ?? "No especificado";
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  const notas = lead.notas ?? "";
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userPromptParts: string[] = [];
  userPromptParts.push(`## DATOS DEL LEAD (CRM)
- Empresa: ${nombre}
- Lead ID: ${leadId}
- Origen: ${origen}
- Pipeline: ${pipeline}
- Website: ${website || "No proporcionado"}
- Tamaño de empresa: ${tamano}
- Objetivos declarados: ${objetivos || "No especificados"}
- A quién le vende: ${audiencia || "No especificado"}
- Qué ofrece: ${oferta || "No especificado"}
- Notas internas: ${notas || "Sin notas"}

Fecha: ${fecha}`);

  const userPrompt = userPromptParts.join("\n\n");

  // Construir prompt del módulo incluyendo personalización IA si existe
  let moduleUserPrompt = `${userPrompt}\n\n**TAREA ESPECÍFICA:**\n${modulePrompt}`;
  
  // Agregar personalización IA al prompt del módulo (si existe) - formato unificado
  if (lead.custom_prompt && lead.custom_prompt.trim()) {
    moduleUserPrompt += `\n\n### PERSONALIZACION IA (del usuario)\n${lead.custom_prompt.trim()}`;
  }
  
  moduleUserPrompt += `\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${moduleId}\n\nY luego el contenido del análisis. NO incluyas otros tabs ni texto fuera de este bloque.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: moduleUserPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Error generando módulo ${moduleId}: ${JSON.stringify(errorData)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const moduleContent = data?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!moduleContent) {
    throw new Error(`Módulo ${moduleId} devolvió contenido vacío`);
  }

  // Asegurar formato correcto
  let formattedContent = moduleContent;
  if (!formattedContent.startsWith(`### TAB:${moduleId}`)) {
    formattedContent = `### TAB:${moduleId}\n\n${formattedContent}`;
  }

  return formattedContent;
}

/**
 * Genera un solo módulo del informe (versión legacy con customPrompts)
 */
async function generateSingleModule(
  lead: LeadRow & { custom_prompt?: string | null },
  moduleId: string,
  customPrompts?: { base?: string; modules?: Record<string, string> }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  // PRIORIDAD 1: Leer prompt base (customPrompts > DB > fallback)
  let promptBase = "";
  if (customPrompts?.base) {
    promptBase = customPrompts.base;
  } else {
    promptBase = await getPromptBase();
  }

  // FALLBACK: Prompt neutro
  const fallbackNeutro = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

  let systemPrompt = promptBase.trim() || fallbackNeutro;
  if (promptBase.trim() && !promptBase.toLowerCase().includes("no mencionar cámara")) {
    systemPrompt = `${systemPrompt}\n\nREGLAS ESTRICTAS:\n- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.\n- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;
  }

  // Construir user prompt
  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim();
  const tamano = lead.tamano ?? "No especificado";
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  const notas = lead.notas ?? "";
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userPromptParts: string[] = [];
  userPromptParts.push(`## DATOS DEL LEAD (CRM)
- Empresa: ${nombre}
- Lead ID: ${leadId}
- Origen: ${origen}
- Pipeline: ${pipeline}
- Website: ${website || "No proporcionado"}
- Tamaño de empresa: ${tamano}
- Objetivos declarados: ${objetivos || "No especificados"}
- A quién le vende: ${audiencia || "No especificado"}
- Qué ofrece: ${oferta || "No especificado"}
- Notas internas: ${notas || "Sin notas"}

Fecha: ${fecha}`);

  if (lead.custom_prompt && lead.custom_prompt.trim()) {
    userPromptParts.push(`**INSTRUCCIONES ADICIONALES DEL USUARIO:**\n${lead.custom_prompt.trim()}`);
  }

  const userPrompt = userPromptParts.join("\n\n");

  // Definir módulos y encontrar el módulo solicitado
  const defaultModules = [
    { id: "INVESTIGACION_DIGITAL", label: "Investigación Digital", prompt: "Genera un análisis de investigación digital: presencia web, SEO, contenido, autoridad digital. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales." },
    { id: "REDES_SOCIALES", label: "Redes Sociales", prompt: "Genera un análisis de redes sociales: presencia, engagement, estrategia de contenido, audiencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "PAUTA_PUBLICITARIA", label: "Pauta Publicitaria", prompt: "Genera un análisis de pauta publicitaria: inversión, canales, mensajes, ROI potencial. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "PRESTIGIO_IA", label: "Prestigio IA", prompt: "Genera un análisis de prestigio usando IA: reputación, menciones, reviews, señales de calidad. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "POSICIONAMIENTO", label: "Posicionamiento", prompt: "Genera un análisis de posicionamiento: mercado, diferenciación, propuesta de valor, competencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "COMPETENCIA", label: "Competencia", prompt: "Genera un análisis de competencia: competidores directos, ventajas competitivas, amenazas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "FODA", label: "FODA", prompt: "Genera un análisis FODA completo con: Fortalezas, Oportunidades, Debilidades y Amenazas. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales." },
    { id: "OPORTUNIDADES", label: "Oportunidades", prompt: "Genera un análisis de oportunidades con subsecciones: Oportunidades visibles, Oportunidades ocultas, Anticipación, Mejoras no pedidas, Tácticas inesperadas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "ACCIONES", label: "Acciones", prompt: "Genera un plan de acciones con subsecciones: Acciones 72 hs, Plan 30–90 días. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "MATERIALES_LISTOS", label: "Materiales Listos", prompt: "Genera una lista de materiales listos para usar: Copys, Scripts, PDFs, Recursos accionables. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "CIERRE_VENTA", label: "Cierre de Venta", prompt: "Genera estrategias de cierre de venta: argumentos, objeciones, CTAs, próximos pasos. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
  ];

  const module = defaultModules.find(m => m.id === moduleId);
  if (!module) {
    throw new Error(`Módulo ${moduleId} no encontrado`);
  }

  // Para cada módulo: promptModulo = prompts?.[moduleId] ?? fallbackModulo
  const modulePrompt = customPrompts?.modules?.[moduleId] || module.prompt;
  
  console.log("[AI] module prompt head:", (modulePrompt || "").slice(0, 120));

  const moduleUserPrompt = `${userPrompt}\n\n**TAREA ESPECÍFICA:**\n${modulePrompt}\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${moduleId}\n\nY luego el contenido del análisis. NO incluyas otros tabs ni texto fuera de este bloque.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: moduleUserPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Error generando módulo ${moduleId}: ${JSON.stringify(errorData)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const moduleContent = data?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!moduleContent) {
    throw new Error(`Módulo ${moduleId} devolvió contenido vacío`);
  }

  // Asegurar formato correcto
  let formattedContent = moduleContent;
  if (!formattedContent.startsWith(`### TAB:${moduleId}`)) {
    formattedContent = `### TAB:${moduleId}\n\n${formattedContent}`;
  }

  return formattedContent;
}

/**
 * Actualiza el informe completo reemplazando solo el tab especificado
 */
function updateReportTab(existingReport: string, newTabContent: string, moduleId: string): string {
  if (!existingReport || !existingReport.trim()) {
    // Si no hay informe previo, devolver solo el nuevo tab
    return newTabContent;
  }

  // Buscar el patrón ### TAB:<moduleId> en el informe existente
  const tabPattern = new RegExp(`###\\s+TAB:\\s*${moduleId}\\s*\\n[\\s\\S]*?(?=###\\s+TAB:|$)`, "i");
  const match = existingReport.match(tabPattern);

  if (match) {
    // Reemplazar el tab existente
    return existingReport.replace(tabPattern, newTabContent.trim());
  } else {
    // Si no existe, agregarlo al final
    return `${existingReport}\n\n${newTabContent.trim()}`;
  }
}

async function generateAiReportAI(
  lead: LeadRow & { custom_prompt?: string | null },
  customPrompts?: { base?: string; modules?: Record<string, string> }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("OPENAI_API_KEY presente:", Boolean(process.env.OPENAI_API_KEY));
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  // PRIORIDAD 1: Leer prompt base (customPrompts > DB > fallback)
  let promptBase = "";
  if (customPrompts?.base) {
    promptBase = customPrompts.base;
  } else {
    promptBase = await getPromptBase();
  }

  // FALLBACK: Prompt neutro (solo si promptBase está vacío)
  const fallbackNeutro = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

  // PRIORIDAD 1: Usar promptBase si existe, sino fallbackNeutro
  // Agregar regla sobre Cámara al prompt base si existe
  let systemPrompt = promptBase.trim() || fallbackNeutro;
  
  // Si hay prompt base, agregar la regla sobre Cámara si no está ya incluida
  if (promptBase.trim() && !promptBase.toLowerCase().includes("no mencionar cámara")) {
    systemPrompt = `${systemPrompt}\n\nREGLAS ESTRICTAS:\n- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.\n- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;
  }

  // Construir datos del lead para el user prompt
  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim();
  const tamano = lead.tamano ?? "No especificado";
  // Soportar tanto string como array (backward compatibility)
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  const notas = lead.notas ?? "";
  const linkedinEmpresa = ""; // Campo no disponible en el schema actual
  const linkedinDirector = ""; // Campo no disponible en el schema actual
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Construir user prompt con datos del lead
  const userPromptParts: string[] = [];
  
  userPromptParts.push(`## DATOS DEL LEAD (CRM)
- Empresa: ${nombre}
- Lead ID: ${leadId}
- Origen: ${origen}
- Pipeline: ${pipeline}
- Website: ${website || "No proporcionado"}
- Tamaño de empresa: ${tamano}
- Objetivos declarados: ${objetivos || "No especificados"}
- A quién le vende: ${audiencia || "No especificado"}
- Qué ofrece: ${oferta || "No especificado"}
- Perfil LinkedIn Empresa: ${linkedinEmpresa || "No proporcionado"}
- Perfil LinkedIn Director / Decisor: ${linkedinDirector || "No proporcionado"}
- Notas internas: ${notas || "Sin notas"}

Fecha: ${fecha}`);

  // PRIORIDAD 2: Agregar personalización del lead SI existe (se incluirá en todos los módulos)
  // Nota: La personalización también se agrega explícitamente en cada módulo más abajo
  if (lead.custom_prompt && lead.custom_prompt.trim()) {
    userPromptParts.push(`### PERSONALIZACION IA (del usuario)\n${lead.custom_prompt.trim()}`);
  }
  
  // PRIORIDAD 3: Agregar instrucción para generar sección de datos faltantes
  const missingFields: Array<{ field: string; impact: string; question: string; where: string }> = [];
  
  if (!website || !website.trim()) {
    missingFields.push({
      field: "Website",
      impact: "Crítico para validar rubro, propuesta de valor y análisis de presencia digital",
      question: "¿Cuál es el website de la empresa?",
      where: "Tab 'Datos nuevos del lead' → Campo 'Website'"
    });
  }
  
  if (!objetivos || !objetivos.trim()) {
    missingFields.push({
      field: "Objetivos",
      impact: "Alto — permite identificar oportunidades reales y personalizar la propuesta",
      question: "¿Cuáles son los objetivos principales del lead?",
      where: "Tab 'Datos nuevos del lead' → Campo 'Objetivos'"
    });
  }
  
  if (!audiencia || !audiencia.trim()) {
    missingFields.push({
      field: "Audiencia",
      impact: "Alto — necesario para mapear contactos compatibles y networking efectivo",
      question: "¿A qué audiencia le vende la empresa? (B2B, B2C, Gobierno, etc.)",
      where: "Tab 'Datos nuevos del lead' → Campo 'A quién le vende'"
    });
  }
  
  if (!oferta || !oferta.trim()) {
    missingFields.push({
      field: "Oferta",
      impact: "Medio — ayuda a entender el modelo de negocio y propuesta de valor",
      question: "¿Qué ofrece específicamente la empresa?",
      where: "Tab 'Datos nuevos del lead' → Campo 'Qué ofrece'"
    });
  }
  
  if (!tamano || tamano === "No especificado") {
    missingFields.push({
      field: "Tamaño de empresa",
      impact: "Medio — permite ajustar la propuesta según el tamaño (startup, PYME, gran empresa)",
      question: "¿Cuál es el tamaño de la empresa? (startup, PYME, gran empresa, etc.)",
      where: "Tab 'Datos nuevos del lead' → Campo 'Tamaño'"
    });
  }
  
  if (missingFields.length > 0) {
    userPromptParts.push(`**IMPORTANTE: DATOS FALTANTES DETECTADOS**

Al final de tu informe, DEBES incluir una sección con este formato exacto:

### DATOS FALTANTES

${missingFields.map(mf => `- **[${mf.field}]** → Impacto: ${mf.impact}`).join("\n")}

### PREGUNTAS PARA COMPLETAR (responder en CRM)

${missingFields.map((mf, idx) => `${idx + 1}) ${mf.question}`).join("\n")}

### DÓNDE CARGARLO EN EL CRM

${missingFields.map(mf => `- **${mf.field}**: ${mf.where}`).join("\n")}

Esta sección debe aparecer al final del informe, después de todos los módulos.`);
  }
  
  const userPrompt = userPromptParts.join("\n\n");

  // Log temporal antes de llamar a OpenAI (para validar que arranca con texto de MODO EASY)
  console.log("SYSTEM_PROMPT_HEAD:", systemPrompt.slice(0, 120));

  // Definir módulos/tabs a generar (11 módulos)
  const defaultModules = [
    { id: "INVESTIGACION_DIGITAL", label: "Investigación Digital", prompt: "Genera un análisis de investigación digital: presencia web, SEO, contenido, autoridad digital. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales." },
    { id: "REDES_SOCIALES", label: "Redes Sociales", prompt: "Genera un análisis de redes sociales: presencia, engagement, estrategia de contenido, audiencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "PAUTA_PUBLICITARIA", label: "Pauta Publicitaria", prompt: "Genera un análisis de pauta publicitaria: inversión, canales, mensajes, ROI potencial. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "PRESTIGIO_IA", label: "Prestigio IA", prompt: "Genera un análisis de prestigio usando IA: reputación, menciones, reviews, señales de calidad. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "POSICIONAMIENTO", label: "Posicionamiento", prompt: "Genera un análisis de posicionamiento: mercado, diferenciación, propuesta de valor, competencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "COMPETENCIA", label: "Competencia", prompt: "Genera un análisis de competencia: competidores directos, ventajas competitivas, amenazas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "FODA", label: "FODA", prompt: "Genera un análisis FODA completo con: Fortalezas, Oportunidades, Debilidades y Amenazas. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales." },
    { id: "OPORTUNIDADES", label: "Oportunidades", prompt: "Genera un análisis de oportunidades con subsecciones: Oportunidades visibles, Oportunidades ocultas, Anticipación, Mejoras no pedidas, Tácticas inesperadas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "ACCIONES", label: "Acciones", prompt: "Genera un plan de acciones con subsecciones: Acciones 72 hs, Plan 30–90 días. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "MATERIALES_LISTOS", label: "Materiales Listos", prompt: "Genera una lista de materiales listos para usar: Copys, Scripts, PDFs, Recursos accionables. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "CIERRE_VENTA", label: "Cierre de Venta", prompt: "Genera estrategias de cierre de venta: argumentos, objeciones, CTAs, próximos pasos. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
  ];

  // Usar prompts personalizados si vienen en customPrompts, sino usar defaults
  const modules = defaultModules.map((mod) => ({
    ...mod,
    prompt: customPrompts?.modules?.[mod.id] || mod.prompt,
  }));

  try {
    const moduleResults: string[] = [];

    // Generar cada módulo con una llamada separada a OpenAI
    for (const module of modules) {
      try {
        // Construir prompt del módulo incluyendo personalización IA si existe
        let moduleUserPrompt = `${userPrompt}\n\n**TAREA ESPECÍFICA:**\n${module.prompt}`;
        
        // Agregar personalización IA al prompt del módulo (si existe)
        if (lead.custom_prompt && lead.custom_prompt.trim()) {
          moduleUserPrompt += `\n\n### PERSONALIZACION IA (del usuario)\n${lead.custom_prompt.trim()}`;
        }
        
        moduleUserPrompt += `\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${module.id}\n\nY luego el contenido del análisis. NO incluyas otros tabs ni texto fuera de este bloque.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: moduleUserPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 1500, // Reducido por módulo
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[AI] Error en módulo ${module.id}:`, errorData);
          // Continuar con otros módulos aunque uno falle
          moduleResults.push(`### TAB:${module.id}\n\nError generando este módulo.`);
          continue;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        const moduleContent = data?.choices?.[0]?.message?.content?.trim() ?? "";

        if (!moduleContent) {
          console.warn(`[AI] Módulo ${module.id} devolvió contenido vacío`);
          moduleResults.push(`### TAB:${module.id}\n\nSin contenido generado.`);
          continue;
        }

        // Asegurar que el contenido tenga el formato correcto
        let formattedContent = moduleContent;
        if (!formattedContent.startsWith(`### TAB:${module.id}`)) {
          formattedContent = `### TAB:${module.id}\n\n${formattedContent}`;
        }

        moduleResults.push(formattedContent);
        console.log(`[AI] Módulo ${module.id} generado: ${formattedContent.slice(0, 100)}...`);
      } catch (moduleError: any) {
        console.error(`[AI] Error generando módulo ${module.id}:`, moduleError);
        // Agregar placeholder para este módulo
        moduleResults.push(`### TAB:${module.id}\n\nError generando este módulo: ${moduleError?.message ?? "Unknown error"}`);
      }
    }

    // Concatenar todos los módulos en un único informe
    const finalReport = moduleResults.join("\n\n");

    // Log para debugging
    if (lead.custom_prompt && lead.custom_prompt.trim()) {
      console.log("✅ Se aplicó personalización adicional al informe IA");
    }

    // Agregar línea discreta al inicio del informe SOLO si hay personalización
    const hasCustomization = !!(lead.custom_prompt && lead.custom_prompt.trim());
    const finalReportWithNote = hasCustomization
      ? `*Se aplicó personalización adicional: Sí*\n\n${finalReport}`
      : finalReport;

    return finalReportWithNote;
  } catch (error: any) {
    throw new Error(`Error generando informe con IA: ${error?.message ?? "Unknown error"}`);
  }
}

/**
 * GET: devuelve ai_context + ai_report del lead (si existe)
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;
    const id = safeId(rawId);

    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    const { data, error } = await sb
      .from("leads")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    const row = (data ?? null) as LeadRow | null;
    return NextResponse.json(
      {
        data: row
          ? {
              id: row.id,
              ai_context: row.ai_context ?? null,
              report: row.ai_report ?? null,
              ai_report: row.ai_report ?? null,
              ai_report_updated_at: row.ai_report_updated_at ?? null,
            }
          : null,
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}

/**
 * POST: genera informe técnico con IA y guarda ai_context + ai_report en el lead
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  console.log("[BOOT] ai-report route loaded");
  console.log("[BOOT] OPENAI_API_KEY length:", process.env.OPENAI_API_KEY?.length);
  
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;
    const id = safeId(rawId);

    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Body opcional: puede incluir custom_prompt, personalization, force_regenerate, only_module y prompts personalizados
    const body = (await req.json().catch(() => null)) as
      | {
          custom_prompt?: string | null;
          personalization?: string | null; // Nuevo campo explícito
          force_regenerate?: boolean;
          only_module?: string | null;
          module_id?: string | null; // backward compatibility
          prompts?: {
            base?: string;
            modules?: Record<string, string>;
          };
          prompts_meta?: {
            updated_at?: {
              base?: number;
              modules?: Record<string, number>;
            };
          };
        }
      | null;

    const shouldRegenerate = body?.force_regenerate === true;
    const only_module = (body?.only_module || body?.module_id)?.trim()?.toUpperCase() || null;
    
    // Validar only_module si está presente
    const validModuleIds = [
      "INVESTIGACION_DIGITAL",
      "REDES_SOCIALES",
      "PAUTA_PUBLICITARIA",
      "PRESTIGIO_IA",
      "POSICIONAMIENTO",
      "COMPETENCIA",
      "FODA",
      "OPORTUNIDADES",
      "ACCIONES",
      "MATERIALES_LISTOS",
      "CIERRE_VENTA",
    ];
    
    if (only_module && !validModuleIds.includes(only_module)) {
      console.log(`[AI] regen tab ${only_module} status 400`);
      return NextResponse.json(
        { data: null, error: `only_module inválido: ${only_module}. Debe ser uno de: ${validModuleIds.join(", ")}` } satisfies ApiResp<null>,
        { status: 400 }
      );
    }
    
    // Fuente de verdad: prioridad 1) body.personalization, 2) body.custom_prompt, 3) lead.ai_custom_prompt, 4) null
    const bodyCustomPrompt = (typeof body?.personalization === "string" ? body.personalization.trim() : null) ||
                             (typeof body?.custom_prompt === "string" ? body.custom_prompt.trim() : null);
    
    // Log para debugging (antes de leer el lead)
    console.log("[AI] only_module:", only_module, "force:", shouldRegenerate);

    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt"
      )
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const leadRow = lead as LeadRow;

    // Determinar custom_prompt final: prioridad 1) body, 2) lead.ai_custom_prompt, 3) null
    const finalCustomPrompt = bodyCustomPrompt || (leadRow.ai_custom_prompt?.trim() || null);
    
    // Log solo valores primitivos (no objetos complejos para evitar circular JSON)
    console.log("📥 POST /ai-report recibido:", {
      leadId: id,
      force_regenerate: shouldRegenerate,
      body_custom_prompt_length: bodyCustomPrompt?.length || 0,
      db_custom_prompt_length: leadRow.ai_custom_prompt?.trim().length || 0,
      final_custom_prompt_length: finalCustomPrompt?.length || 0,
      has_existing_report: !!(leadRow.ai_report && leadRow.ai_report.trim()),
    });

    // Verificar si ya existe un informe
    const hasExistingReport = !!(leadRow.ai_report && leadRow.ai_report.trim());

    // Log campos del lead recién leído (solo en dev)
    if (process.env.NODE_ENV === "development") {
      console.log("📋 Lead data (fresh from DB):", {
        website: leadRow.website,
        objetivos: leadRow.objetivos,
        audiencia: leadRow.audiencia,
        tamano: leadRow.tamano,
        oferta: leadRow.oferta,
        notas: leadRow.notas,
      });
    }

    // Decisión: reutilizar informe existente o generar uno nuevo
    if (!shouldRegenerate && hasExistingReport) {
      console.log("✅ Reutilizando informe existente (regenerate=false, hay informe previo)");
      const row = leadRow as LeadRow;
      return NextResponse.json(
        {
          data: {
            id: row.id,
            ai_context: row.ai_context ?? null,
            report: row.ai_report ?? null,
            ai_report: row.ai_report ?? null,
            ai_report_updated_at: row.ai_report_updated_at ?? null,
          },
          error: null,
        } satisfies ApiResp<any>,
        { status: 200 }
      );
    }

    // Si hay only_module, generar solo ese módulo usando prompt recibido directamente
    if (only_module) {
      try {
        // Usar directamente el prompt recibido (no re-leer del server)
        const modulePrompt = body?.prompts?.modules?.[only_module] || "";
        const promptUpdatedAt = body?.prompts_meta?.updated_at?.modules?.[only_module] || body?.prompts_meta?.updated_at?.base || null;
        const promptHead = (modulePrompt || "").slice(0, 80);
        
        // Logs específicos requeridos
        console.log("[AI] leadId:", id, "only_module:", only_module, "promptUpdatedAt:", promptUpdatedAt, "promptHead:", promptHead, "status: 200");
        
        if (!modulePrompt) {
          throw new Error(`Prompt no proporcionado para módulo ${only_module}`);
        }
        
        const newTabContent = await generateSingleModuleWithPrompt(
          {
            ...leadRow,
            ai_context: leadRow.ai_context || null,
            custom_prompt: finalCustomPrompt,
          },
          only_module,
          body?.prompts?.base || "",
          modulePrompt
        );

        // Obtener informe existente o crear uno nuevo
        const existingReport = leadRow.ai_report?.trim() || "";
        const updatedReport = updateReportTab(existingReport, newTabContent, only_module);

        // Guardar el informe actualizado usando helper seguro que preserva empresa_id
        // NOTA: No incluimos empresa_id en el payload, se preserva automáticamente
        const updateResult = await updateLeadSafe(sb, id, {
          ai_report: updatedReport,
          ai_report_updated_at: new Date().toISOString(),
        }, {
          force_unlink_entity: false, // Nunca desvincular al actualizar informe IA
        });
        const updateErr = updateResult.error;

        if (updateErr) {
          throw updateErr;
        }

        console.log("[AI] leadId:", id, "only_module:", only_module, "status: success");
        
        return NextResponse.json(
          {
            ok: true,
            data: {
              id: leadRow.id,
              report: updatedReport,
              ai_report: updatedReport,
            },
            updatedTab: only_module,
            error: null,
          } satisfies ApiResp<any> & { ok: boolean; updatedTab: string },
          { status: 200 }
        );
      } catch (error: any) {
        console.log("[AI] leadId:", id, "only_module:", only_module, "status: 500", "error:", error?.message);
        return NextResponse.json(
          { data: null, error: error?.message ?? "Error regenerando módulo" } satisfies ApiResp<null>,
          { status: 500 }
        );
      }
    }

    console.log(shouldRegenerate 
      ? "🔄 FORCE REGENERATE: generando nuevo informe (force_regenerate=true)" 
      : "🆕 Generando nuevo informe (no hay informe previo)");

    // Generar informe con IA, con fallback si falla
    let report: string;
    let aiContext: string;

    try {
      // Pasar custom_prompt final (prioridad: body > DB > null) y prompts personalizados a generateAiReportAI
      report = await generateAiReportAI(
        {
          ...leadRow,
          ai_context: leadRow.ai_context || null,
          custom_prompt: finalCustomPrompt, // Personalización: body > DB > null
        },
        body?.prompts // Prompts personalizados desde localStorage (opcional)
      );
      // Construir contexto para guardar
      aiContext = [
        `Nombre: ${leadRow.nombre ?? "Lead"}`,
        `Origen: ${leadRow.origen ?? "—"}`,
        `Pipeline: ${leadRow.pipeline ?? "—"}`,
        `Website: ${leadRow.website ?? "—"}`,
        `Tamaño: ${leadRow.tamano ?? "—"}`,
        `Objetivos: ${Array.isArray(leadRow.objetivos) ? leadRow.objetivos.join(", ") : "—"}`,
        `Audiencia: ${Array.isArray(leadRow.audiencia) ? leadRow.audiencia.join(", ") : "—"}`,
        `Oferta: ${leadRow.oferta ?? "—"}`,
        `Notas: ${leadRow.notas ?? "—"}`,
        `Generado con IA: ${new Date().toISOString()}`,
      ].join("\n");
    } catch (error: any) {
      // Fallback: generar informe técnico básico
      console.log("[AI] Entrando en modo FALLBACK (sin OpenAI)");
      console.log("[AI] OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "PRESENTE" : "AUSENTE");
      console.log("[AI] NODE_ENV:", process.env.NODE_ENV);
      
      report = generateFallbackReport({
        ...leadRow,
        ai_context: leadRow.ai_context || null,
      });
      aiContext = [
        `Nombre: ${leadRow.nombre ?? "Lead"}`,
        `Origen: ${leadRow.origen ?? "—"}`,
        `Pipeline: ${leadRow.pipeline ?? "—"}`,
        `Website: ${leadRow.website ?? "—"}`,
        `Tamaño: ${leadRow.tamano ?? "—"}`,
        `Objetivos: ${Array.isArray(leadRow.objetivos) ? leadRow.objetivos.join(", ") : "—"}`,
        `Audiencia: ${Array.isArray(leadRow.audiencia) ? leadRow.audiencia.join(", ") : "—"}`,
        `Oferta: ${leadRow.oferta ?? "—"}`,
        `Notas: ${leadRow.notas ?? "—"}`,
        `Error IA: ${error?.message ?? "Unknown error"}`,
        `Generado con fallback: ${new Date().toISOString()}`,
      ].join("\n");
    }

    // Función para normalizar score (blindar contra valores inválidos)
    // Asegura que siempre sea un entero entre 0-5 o null
    function normalizeScore(raw: unknown): number | null {
      if (raw === null || raw === undefined) return null;
      
      const n = Number(raw);
      if (Number.isNaN(n) || !isFinite(n)) return null;
      
      // Forzar a entero y clamp a 0-5
      const clamped = Math.max(0, Math.min(5, Math.round(n)));
      
      // Verificación final: debe ser entero entre 0-5
      if (!Number.isInteger(clamped) || clamped < 0 || clamped > 5) {
        return null;
      }
      
      return clamped;
    }

    // Extraer score y categoría del informe IA
    // ⚠️ Si no puede parsearse, NO fallar: dejar score = null y score_categoria = null
    let extractedScore: number | null = null;
    let extractedCategoria: string | null = null;

    try {
      // Buscar patrón: "Score final: X/5" o "Score final: X/10" o "Score final (promedio): X"
      // Aceptar ambos formatos: X/5 y X/10
      const scoreMatch5 = report.match(/Score\s+final[:\s]+(\d+)\s*\/\s*5/i);
      const scoreMatch10 = report.match(/Score\s+final[:\s]+(\d+)\s*\/\s*10/i);
      
      let scoreValue: number | null = null;
      let scale: "5" | "10" | null = null;
      
      if (scoreMatch5 && scoreMatch5[1]) {
        // Formato X/5: usar directamente
        scoreValue = parseInt(scoreMatch5[1], 10);
        scale = "5";
      } else if (scoreMatch10 && scoreMatch10[1]) {
        // Formato X/10: convertir a escala 0-5
        const value10 = parseInt(scoreMatch10[1], 10);
        // Convertir X/10 a 0-5: Math.round((X/10)*5) o Math.round(X/2)
        scoreValue = Math.round(value10 / 2);
        scale = "10";
      }
      
      if (scoreValue !== null && !isNaN(scoreValue) && isFinite(scoreValue) && Number.isInteger(scoreValue)) {
        // Aplicar clamp: Math.max(0, Math.min(5, score))
        const clamped = Math.max(0, Math.min(5, scoreValue));
        // Usar normalizeScore para validación final (asegura entero 0-5)
        extractedScore = normalizeScore(clamped);
        
        if (extractedScore !== null) {
          console.log(`✅ Score parseado: ${scoreValue}${scale === "10" ? "/10" : "/5"} → ${extractedScore}/5`);
        }
      }
    } catch (e) {
      // Si falla el parseo, dejar score = null (no fallar)
      console.warn("⚠️ No se pudo extraer score del informe IA:", e);
      extractedScore = null;
    }

    try {
      // Buscar patrón: "Categoría: X" (hasta fin de línea)
      const categoriaMatch = report.match(/Categoría[:\s]+([^\n\r]+)/i);
      if (categoriaMatch && categoriaMatch[1]) {
        extractedCategoria = categoriaMatch[1].trim();
        // Limpiar texto común
        extractedCategoria = extractedCategoria.replace(/^(Prioridad\s+)?/i, "").trim();
        if (extractedCategoria.length === 0) extractedCategoria = null;
      }
    } catch (e) {
      // Si falla el parseo, dejar categoría = null (no fallar)
      console.warn("⚠️ No se pudo extraer categoría del informe IA:", e);
      extractedCategoria = null;
    }

    // Normalizar score antes de guardar (blindar contra valores inválidos)
    // Asegurar que sea un entero válido (0-5) o null
    const normalizedScore = normalizeScore(extractedScore);
    
    // Verificación final: score debe ser entero entre 0-5 o null
    // Si no se puede parsear, NO actualizar score (dejarlo null)
    const finalScore = (normalizedScore !== null && 
                       Number.isInteger(normalizedScore) && 
                       normalizedScore >= 0 && 
                       normalizedScore <= 5) 
                      ? normalizedScore 
                      : null;

    // Log de control antes de guardar
    console.log("AI_SCORE_SAVE", { 
      score: finalScore, 
      categoria: extractedCategoria,
      extractedScore,
      normalizedScore,
      isInteger: finalScore !== null ? Number.isInteger(finalScore) : null,
      inRange: finalScore !== null ? (finalScore >= 0 && finalScore <= 5) : null
    });

    const patch: any = {
      ai_context: aiContext,
      ai_report: report, // report ya incluye la marca de debug (agregada en generateAiReportAI)
      ai_report_updated_at: nowIso(),
      updated_at: nowIso(),
      // Solo actualizar score si es válido (entero 0-5) o null
      // Si no se puede parsear, NO actualizar score (dejarlo null) y NO tirar error
      // Separar score y score_categoria para que puedan actualizarse independientemente
      score: finalScore,
      score_categoria: extractedCategoria,
    };

    // Usar helper seguro que preserva empresa_id
    // NOTA: patch puede incluir empresa_id si viene del body, pero normalmente no lo incluye
    const updateResult = await updateLeadSafe(sb, id, patch, {
      force_unlink_entity: false, // Nunca desvincular al actualizar informe IA
    });
    const updated = updateResult.data;
    const upErr = updateResult.error;
    if (upErr) throw upErr;

    const row = (updated ?? null) as LeadRow | null;

    // Asegurar que siempre retornamos data.report con contenido (incluye marca de debug)
    const finalReport = row?.ai_report ?? report;

    return NextResponse.json(
      {
        data: row
          ? {
              id: row.id,
              ai_context: row.ai_context ?? null,
              report: finalReport,
              ai_report: row.ai_report ?? null,
              ai_report_updated_at: row.ai_report_updated_at ?? null,
            }
          : {
              id: id,
              ai_context: aiContext,
              report: finalReport,
              ai_report: finalReport,
              ai_report_updated_at: nowIso(),
            },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}