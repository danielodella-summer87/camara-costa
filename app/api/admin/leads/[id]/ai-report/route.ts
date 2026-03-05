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
  linkedin_empresa?: string | null;
  linkedin_director?: string | null;
  meet_url?: string | null;

  ai_context?: string | null;
  ai_report?: string | null;
  ai_report_updated_at?: string | null;
  ai_custom_prompt?: string | null;
  empresa_id?: string | null;
};

type ResolvedContext = {
  // Datos básicos (Lead tiene prioridad)
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  origen: string;
  pipeline: string;
  notas: string;
  
  // Datos con resolución Lead > Entidad > Cliente
  website: string;
  instagram: string;
  facebook: string;
  linkedinEmpresa: string;
  linkedinDirector: string;
  meetUrl: string;
  
  // Datos específicos del Lead (override)
  objetivos: string;
  audiencia: string;
  tamano: string;
  oferta: string;
  
  // Datos de Entidad
  rubro: string;
  direccion: string;
  ciudad: string;
  pais: string;
  
  // Historial del Cliente (si existe)
  clienteHistorial: string;
  clientePlan: string;
  clienteEstado: string;
  clienteFechaAlta: string;
  
  // Fuentes (para debug)
  websiteSource: "Lead" | "Entidad" | "Cliente" | "N/A";
  instagramSource: "Lead" | "Entidad" | "Cliente" | "N/A";
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
 * Normaliza y construye el bloque de Personalización IA
 * Retorna null si está vacío o null
 */
function buildPersonalizacionIABlock(customPrompt: string | null | undefined, moduleId?: string): string | null {
  if (!customPrompt || !customPrompt.trim()) {
    return null;
  }
  
  // Normalizar: trim, colapsar espacios múltiples, límite de longitud
  let normalized = customPrompt.trim();
  
  // Colapsar espacios múltiples (incluyendo newlines múltiples)
  normalized = normalized.replace(/\s{3,}/g, " ").replace(/\n{3,}/g, "\n\n");
  
  // Límite de longitud: 15k caracteres (razonable para contexto)
  const MAX_LENGTH = 15000;
  if (normalized.length > MAX_LENGTH) {
    normalized = normalized.slice(0, MAX_LENGTH) + "\n\n(truncado)";
  }
  
  // Instrucciones específicas por módulo
  const moduleInstructions: Record<string, string> = {
    INVESTIGACION_DIGITAL: "Si no hay website disponible, usa este contexto como 'activo base' y propone estructura futura basada en la información proporcionada.",
    REDES_SOCIALES: "Si no hay redes sociales detectadas, propone estrategia de lanzamiento desde este contexto.",
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
  
  // Construir bloque formateado
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

/**
 * Resuelve contexto unificado desde Lead + Entidad + Cliente
 * Prioridad: Lead > Entidad > Cliente (excepto historial que solo viene de Cliente)
 */
function resolveLeadContext(
  lead: LeadRow & { 
    empresas?: { 
      nombre?: string | null;
      web?: string | null; 
      instagram?: string | null;
      facebook?: string | null;
      rubro_id?: string | null;
      rubros?: { nombre?: string | null } | null;
      direccion?: string | null;
      ciudad?: string | null;
      pais?: string | null;
      telefono?: string | null;
      email?: string | null;
      celular?: string | null;
      rut?: string | null;
      contacto_nombre?: string | null;
      contacto_celular?: string | null;
      contacto_email?: string | null;
      etiquetas?: string | null;
    } | null;
  },
  cliente?: {
    nombre?: string | null;
    email?: string | null;
    telefono?: string | null;
    plan?: string | null;
    estado?: string | null;
    fecha_alta?: string | null;
    proxima_accion?: string | null;
  } | null
): ResolvedContext {
  const empresa = lead.empresas;
  
  // Resolver website: Lead > Entidad > Cliente
  const websiteFromLead = (lead.website ?? "").trim();
  const websiteFromEmpresa = (empresa?.web ?? "").trim() || "";
  const websiteFromCliente = ""; // Cliente no tiene web por ahora
  const resolvedWebsite = websiteFromLead || websiteFromEmpresa || websiteFromCliente || "";
  const websiteSource: "Lead" | "Entidad" | "Cliente" | "N/A" = 
    websiteFromLead ? "Lead" : 
    websiteFromEmpresa ? "Entidad" : 
    websiteFromCliente ? "Cliente" : 
    "N/A";
  
  // Resolver instagram: Lead (si existiera) > Entidad > Cliente
  const instagramFromLead = ""; // Lead no tiene instagram
  const instagramFromEmpresa = (empresa?.instagram ?? "").trim() || "";
  const instagramFromCliente = ""; // Cliente no tiene instagram
  const resolvedInstagram = instagramFromLead || instagramFromEmpresa || instagramFromCliente || "";
  const instagramSource: "Lead" | "Entidad" | "Cliente" | "N/A" = 
    instagramFromLead ? "Lead" : 
    instagramFromEmpresa ? "Entidad" : 
    instagramFromCliente ? "Cliente" : 
    "N/A";

  const resolvedFacebook = (empresa?.facebook ?? "").trim() || "";

  // Resolver linkedin: Lead > Entidad > Cliente
  const linkedinEmpresaFromLead = (lead.linkedin_empresa ?? "").trim();
  const linkedinEmpresaFromEmpresa = ""; // Entidad no tiene linkedin
  const linkedinEmpresaFromCliente = ""; // Cliente no tiene linkedin
  const resolvedLinkedinEmpresa = linkedinEmpresaFromLead || linkedinEmpresaFromEmpresa || linkedinEmpresaFromCliente || "";
  
  const linkedinDirectorFromLead = (lead.linkedin_director ?? "").trim();
  const linkedinDirectorFromEmpresa = ""; // Entidad no tiene linkedin
  const linkedinDirectorFromCliente = ""; // Cliente no tiene linkedin
  const resolvedLinkedinDirector = linkedinDirectorFromLead || linkedinDirectorFromEmpresa || linkedinDirectorFromCliente || "";
  
  // Resolver meet_url: solo Lead
  const resolvedMeetUrl = (lead.meet_url ?? "").trim() || "";
  
  // Resolver objetivos, audiencia, tamano, oferta: solo Lead (override)
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const tamano = (lead.tamano ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  
  // Datos de Entidad
  const rubro = empresa?.rubros?.nombre?.trim() || "";
  const direccion = (empresa?.direccion ?? "").trim();
  const ciudad = (empresa?.ciudad ?? "").trim();
  const pais = (empresa?.pais ?? "").trim();
  
  // Historial del Cliente (solo si existe)
  const clienteHistorialParts: string[] = [];
  if (cliente) {
    if (cliente.plan) clienteHistorialParts.push(`Plan: ${cliente.plan}`);
    if (cliente.estado) clienteHistorialParts.push(`Estado: ${cliente.estado}`);
    if (cliente.fecha_alta) clienteHistorialParts.push(`Fecha alta: ${cliente.fecha_alta}`);
    if (cliente.proxima_accion) clienteHistorialParts.push(`Próxima acción: ${cliente.proxima_accion}`);
  }
  const clienteHistorial = clienteHistorialParts.join("; ") || "";
  
  return {
    nombre: lead.nombre ?? "Lead",
    contacto: lead.contacto ?? "",
    telefono: lead.telefono ?? "",
    email: lead.email ?? "",
    origen: lead.origen ?? "No especificado",
    pipeline: lead.pipeline ?? "No especificado",
    notas: lead.notas ?? "",
    
    website: resolvedWebsite,
    instagram: resolvedInstagram,
    facebook: resolvedFacebook,
    linkedinEmpresa: resolvedLinkedinEmpresa,
    linkedinDirector: resolvedLinkedinDirector,
    meetUrl: resolvedMeetUrl,
    
    objetivos,
    audiencia,
    tamano,
    oferta,
    
    rubro,
    direccion,
    ciudad,
    pais,
    
    clienteHistorial,
    clientePlan: cliente?.plan ?? "",
    clienteEstado: cliente?.estado ?? "",
    clienteFechaAlta: cliente?.fecha_alta ?? "",
    
    websiteSource,
    instagramSource,
  };
}

/**
 * Genera un informe técnico fallback cuando falla la IA
 */
function generateFallbackReport(lead: LeadRow & { empresas?: { web?: string | null; instagram?: string | null } | null }): string {
  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim() || (lead.empresas?.web ?? "").trim() || "";
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
${!notas ? "- ¿Hay notas adicionales o contexto relevante sobre el lead?" : ""}
${website && objetivos && audiencia ? "- Todos los campos principales están completos" : ""}

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
const CONFIG_IA_KEY = "ai_prompts_v1";

const TECH_MODULE_IDS = [
  "north_star_metric",
  "producto_servicio_estrella",
  "auditoria_tecnica_basica",
] as const;

/**
 * Lee prompt base desde config (leads_ai_prompt_base o ai_prompts_v1)
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
      console.error("Error leyendo prompt base desde config:", error);
      return "";
    }

    const base = (data?.value ?? "").trim();
    if (base) return base;

    const { data: dataV1 } = await sb
      .from("config")
      .select("value")
      .eq("key", CONFIG_IA_KEY)
      .maybeSingle();
    const parsed = dataV1?.value ? JSON.parse(String(dataV1.value)) : null;
    return (parsed?.basePrompt ?? "").trim();
  } catch (e: any) {
    console.error("Error inesperado leyendo prompt base:", e);
    return "";
  }
}

/**
 * Carga configuración IA (Prompt base + módulos) desde DB para usar cuando el body no envía prompts.
 */
async function getIAConfigFromDB(): Promise<{ base?: string; modules?: Record<string, string> }> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("config")
      .select("value")
      .eq("key", CONFIG_IA_KEY)
      .maybeSingle();

    if (error || !data?.value) return {};
    const parsed = JSON.parse(String(data.value)) as { basePrompt?: string; modulos?: Record<string, string> };
    return {
      base: typeof parsed.basePrompt === "string" ? parsed.basePrompt : "",
      modules: parsed.modulos && typeof parsed.modulos === "object" ? parsed.modulos : {},
    };
  } catch (e: any) {
    if (process.env.NODE_ENV !== "production") console.warn("[AI] getIAConfigFromDB:", e?.message);
    return {};
  }
}

/**
 * Parsea el informe completo y extrae todos los tabs en orden estable
 */
function parseAllReportTabs(aiReport: string): Record<string, string> {
  const tabs: Record<string, string> = {};
  
  if (!aiReport || !aiReport.trim()) {
    return tabs;
  }
  
  // Buscar todas las ocurrencias de ### TAB:<ID>
  const tabPattern = /###\s+TAB:\s*(\w+)\s*\n/gi;
  const matches: Array<{ tabId: string; startIndex: number; endIndex: number }> = [];
  
  let match;
  while ((match = tabPattern.exec(aiReport)) !== null) {
    const tabId = match[1].toUpperCase();
    const startIndex = match.index + match[0].length;
    
    // Buscar el siguiente ### TAB: o el final del documento
    const remaining = aiReport.slice(startIndex);
    const nextTabMatch = remaining.match(/###\s+TAB:\s*\w+\s*\n/i);
    const endIndex = nextTabMatch && typeof nextTabMatch.index === "number"
      ? startIndex + nextTabMatch.index
      : aiReport.length;
    
    matches.push({ tabId, startIndex, endIndex });
  }
  
  // Extraer contenido para cada tab encontrado
  for (const { tabId, startIndex, endIndex } of matches) {
    const content = aiReport.slice(startIndex, endIndex).trim();
    if (content) {
      tabs[tabId] = content;
    }
  }
  
  return tabs;
}

/**
 * Construye el contexto estructurado para Visión Estratégica
 */
function buildVisionEstrategicaContext(
  lead: LeadRow & { 
    empresas?: { 
      web?: string | null; 
      instagram?: string | null;
      rubro_id?: string | null;
      rubros?: { nombre?: string | null } | null;
      direccion?: string | null;
      ciudad?: string | null;
      pais?: string | null;
    } | null;
  },
  aiReport: string,
  cliente?: {
    nombre?: string | null;
    email?: string | null;
    telefono?: string | null;
    plan?: string | null;
    estado?: string | null;
    fecha_alta?: string | null;
    proxima_accion?: string | null;
  } | null
): string {
  // Resolver contexto unificado
  const ctx = resolveLeadContext(lead, cliente);
  
  // Construir header estructurado
  const headerParts: string[] = [];
  headerParts.push("=== LEAD HEADER (STRUCTURED) ===");
  headerParts.push(`Nombre/Empresa: ${ctx.nombre || "N/D"}`);
  headerParts.push(`Rubro: ${ctx.rubro || "N/D"}`);
  
  const paisCiudad = [ctx.pais, ctx.ciudad].filter(Boolean).join(" / ");
  headerParts.push(`País/Ciudad: ${paisCiudad || "N/D"}`);
  
  headerParts.push(`Objetivo: ${ctx.objetivos || "N/D"}`);
  headerParts.push(`Tipo de lead: ${ctx.pipeline || "N/D"}`);
  headerParts.push(`Website: ${ctx.website || "N/D"}`);
  
  const linkedinParts = [];
  if (ctx.linkedinEmpresa) linkedinParts.push(`Empresa: ${ctx.linkedinEmpresa}`);
  if (ctx.linkedinDirector) linkedinParts.push(`Director: ${ctx.linkedinDirector}`);
  headerParts.push(`LinkedIn: ${linkedinParts.join(" | ") || "N/D"}`);
  
  // Notas relevantes (primeras 200 caracteres)
  const notasRelevantes = ctx.notas ? ctx.notas.slice(0, 200) + (ctx.notas.length > 200 ? "..." : "") : "";
  headerParts.push(`Notas relevantes: ${notasRelevantes || "N/D"}`);
  
  // Parsear todos los tabs del informe
  const reportTabs = parseAllReportTabs(aiReport);
  
  const tabOrder = [
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
    "linkedin_decision_makers",
    "north_star_metric",
    "producto_servicio_estrella",
    "auditoria_tecnica_basica",
    "plan_crecimiento",
    "propuesta_easy",
    "oportunidades_negocio_easy",
  ];
  
  // Construir sección de informe completo
  const reportParts: string[] = [];
  reportParts.push("\n=== AI REPORT (FULL CONTEXT) ===");
  
  const includedTabs: string[] = [];
  for (const tabId of tabOrder) {
    const content = reportTabs[tabId];
    if (content && content.trim()) {
      reportParts.push(`\n[TAB:${tabId}]`);
      reportParts.push(content);
      includedTabs.push(tabId);
    } else {
      // Tab faltante o vacío: incluir como "(Sin contenido)"
      reportParts.push(`\n[TAB:${tabId}]`);
      reportParts.push("(Sin contenido)");
    }
  }
  
  // Log para debugging (solo server)
  console.log("[Vision Estratégica] Contexto construido:", {
    module: "vision_estrategica",
    contextLength: headerParts.join("\n").length + reportParts.join("\n").length,
    tabsIncluded: includedTabs,
    tabsTotal: tabOrder.length,
  });
  
  // Combinar header y report
  return headerParts.join("\n") + reportParts.join("\n");
}

/**
 * Genera Visión Estratégica usando el informe completo como contexto
 */
async function generateVisionEstrategica(
  lead: LeadRow & { 
    custom_prompt?: string | null; 
    ai_report?: string | null;
    empresas?: { 
      web?: string | null; 
      instagram?: string | null;
      rubro_id?: string | null;
      rubros?: { nombre?: string | null } | null;
      direccion?: string | null;
      ciudad?: string | null;
      pais?: string | null;
    } | null;
  },
  basePrompt: string,
  visionPrompt: string,
  cliente?: {
    nombre?: string | null;
    email?: string | null;
    telefono?: string | null;
    plan?: string | null;
    estado?: string | null;
    fecha_alta?: string | null;
    proxima_accion?: string | null;
  } | null
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const fallbackNeutro = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

  let systemPrompt = basePrompt.trim() || fallbackNeutro;
  if (basePrompt.trim() && !basePrompt.toLowerCase().includes("no mencionar cámara")) {
    systemPrompt = `${systemPrompt}\n\nREGLAS ESTRICTAS:\n- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.\n- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;
  }

  const existingReport = (lead.ai_report ?? "").trim();
  
  if (!existingReport) {
    throw new Error("No hay informe previo disponible. Debes generar el informe completo primero antes de generar Visión Estratégica.");
  }

  // Construir contexto estructurado consolidado
  const structuredContext = buildVisionEstrategicaContext(lead, existingReport, cliente);

  // Construir user prompt con contexto estructurado
  const userPromptParts: string[] = [];
  
  // PRIORIDAD 1: Personalización IA al inicio (si existe)
  const personalizacionBlock = buildPersonalizacionIABlock(lead.custom_prompt, "vision_estrategica");
  if (personalizacionBlock) {
    userPromptParts.push(personalizacionBlock);
    
    // Log server-only
    console.log(`[AI] Módulo vision_estrategica: Personalización IA incluida (length: ${lead.custom_prompt?.trim().length || 0})`);
  }
  
  // PRIORIDAD 2: Contexto estructurado (header + informe completo)
  userPromptParts.push(structuredContext);
  
  // Instrucción clara sobre la tarea
  userPromptParts.push(`\n**IMPORTANTE:** El contexto anterior contiene un header estructurado con datos clave del lead y un informe completo con todos los módulos analizados. Tu tarea NO es repetir esos análisis, sino integrarlos en una lectura estratégica clara y decisional.`);

  // PRIORIDAD 3: Tarea específica de Visión Estratégica
  userPromptParts.push(`\n**TAREA ESPECÍFICA:**\n${visionPrompt}`);
  
  const moduleUserPrompt = userPromptParts.join("\n\n") + `\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:vision_estrategica\n\nY luego el contenido de la visión estratégica. NO incluyas otros tabs ni texto fuera de este bloque.`;

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
      max_tokens: 2000, // Más tokens para visión estratégica (es más largo)
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Error generando Visión Estratégica: ${JSON.stringify(errorData)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const moduleContent = data?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!moduleContent) {
    throw new Error("Visión Estratégica devolvió contenido vacío");
  }

  // Asegurar formato correcto
  let formattedContent = moduleContent;
  if (!formattedContent.startsWith(`### TAB:vision_estrategica`)) {
    formattedContent = `### TAB:vision_estrategica\n\n${formattedContent}`;
  }

  return formattedContent;
}

/**
 * Genera un solo módulo del informe usando prompt recibido directamente
 */
async function generateSingleModuleWithPrompt(
  lead: LeadRow & { custom_prompt?: string | null; empresas?: { web?: string | null; instagram?: string | null } | null },
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

  // Detectar tipo de organización del vendedor desde systemPrompt para el frame de CIERRE_VENTA
  const sellerHint =
    systemPrompt.toLowerCase().includes("cámara") ? "cámara" :
    systemPrompt.toLowerCase().includes("agencia") ? "agencia" :
    systemPrompt.toLowerCase().includes("consultora") ? "consultora" :
    "organización";

  // Resolver contexto unificado (sin cliente para esta función legacy)
  const ctx = resolveLeadContext(lead, null);

  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userPromptParts: string[] = [];
  const websiteDisplay = ctx.website ? `${ctx.website} (${ctx.websiteSource})` : "No proporcionado";
  
  userPromptParts.push(`## DATOS DE ENTIDAD (si existe)
${ctx.rubro ? `- Rubro: ${ctx.rubro}` : ""}
${ctx.direccion ? `- Dirección: ${ctx.direccion}` : ""}
${ctx.ciudad ? `- Ciudad: ${ctx.ciudad}` : ""}
${ctx.pais ? `- País: ${ctx.pais}` : ""}
${!ctx.rubro && !ctx.direccion && !ctx.ciudad && !ctx.pais ? "- No hay datos de entidad vinculada" : ""}

## DATOS DEL LEAD (override)
- Empresa: ${ctx.nombre}
- Lead ID: ${lead.id}
- Origen: ${ctx.origen}
- Pipeline: ${ctx.pipeline}
- Website: ${websiteDisplay}
- Instagram: ${ctx.instagram ? `${ctx.instagram} (${ctx.instagramSource})` : "No proporcionado"}
- Tamaño de empresa: ${ctx.tamano || "No especificado"}
- Objetivos declarados: ${ctx.objetivos || "No especificados"}
- A quién le vende: ${ctx.audiencia || "No especificado"}
- Qué ofrece: ${ctx.oferta || "No especificado"}
- Perfil LinkedIn Empresa: ${ctx.linkedinEmpresa || "No proporcionado"}
- Perfil LinkedIn Director / Decisor: ${ctx.linkedinDirector || "No proporcionado"}
- Meet URL: ${ctx.meetUrl || "No proporcionado"}
- Notas internas: ${ctx.notas || "Sin notas"}

Fecha: ${fecha}`);

  const userPrompt = userPromptParts.join("\n\n");

  // Construir prompt del módulo (la personalización ya está incluida al inicio)
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
 * Genera un solo módulo del informe (versión legacy con customPrompts)
 */
async function generateSingleModule(
  lead: LeadRow & { custom_prompt?: string | null; empresas?: { web?: string | null; instagram?: string | null } | null },
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

  // Detectar tipo de organización del vendedor desde systemPrompt para el frame de CIERRE_VENTA
  const sellerHint =
    systemPrompt.toLowerCase().includes("cámara") ? "cámara" :
    systemPrompt.toLowerCase().includes("agencia") ? "agencia" :
    systemPrompt.toLowerCase().includes("consultora") ? "consultora" :
    "organización";

  // Resolver contexto unificado (sin cliente para esta función legacy)
  const ctx = resolveLeadContext(lead, null);

  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userPromptParts: string[] = [];
  
  // PRIORIDAD 1: Personalización IA al inicio (si existe)
  const personalizacionBlock = buildPersonalizacionIABlock(lead.custom_prompt, moduleId);
  if (personalizacionBlock) {
    userPromptParts.push(personalizacionBlock);
    
    // Log server-only
    console.log(`[AI] Módulo ${moduleId}: Personalización IA incluida (length: ${lead.custom_prompt?.trim().length || 0})`);
  }
  
  const websiteDisplay = ctx.website ? `${ctx.website} (${ctx.websiteSource})` : "No proporcionado";
  
  userPromptParts.push(`## DATOS DE ENTIDAD (si existe)
${ctx.rubro ? `- Rubro: ${ctx.rubro}` : ""}
${ctx.direccion ? `- Dirección: ${ctx.direccion}` : ""}
${ctx.ciudad ? `- Ciudad: ${ctx.ciudad}` : ""}
${ctx.pais ? `- País: ${ctx.pais}` : ""}
${!ctx.rubro && !ctx.direccion && !ctx.ciudad && !ctx.pais ? "- No hay datos de entidad vinculada" : ""}

## DATOS DEL LEAD (override)
- Empresa: ${ctx.nombre}
- Lead ID: ${lead.id}
- Origen: ${ctx.origen}
- Pipeline: ${ctx.pipeline}
- Website: ${websiteDisplay}
- Instagram: ${ctx.instagram ? `${ctx.instagram} (${ctx.instagramSource})` : "No proporcionado"}
- Tamaño de empresa: ${ctx.tamano || "No especificado"}
- Objetivos declarados: ${ctx.objetivos || "No especificados"}
- A quién le vende: ${ctx.audiencia || "No especificado"}
- Qué ofrece: ${ctx.oferta || "No especificado"}
- Perfil LinkedIn Empresa: ${ctx.linkedinEmpresa || "No proporcionado"}
- Perfil LinkedIn Director / Decisor: ${ctx.linkedinDirector || "No proporcionado"}
- Meet URL: ${ctx.meetUrl || "No proporcionado"}
- Notas internas: ${ctx.notas || "Sin notas"}

Fecha: ${fecha}`);

  const userPrompt = userPromptParts.join("\n\n");

  // Construir contexto de redes sociales y website para incluir en prompts
  const websiteTxt = ctx.website ? `Website detectado: ${ctx.website}` : "Website: no disponible";
  const instagramTxt = ctx.instagram ? `Instagram detectado: ${ctx.instagram}` : "Instagram: no disponible";
  const linkedinEmpresaTxt = ctx.linkedinEmpresa ? `LinkedIn Empresa: ${ctx.linkedinEmpresa}` : "LinkedIn Empresa: no disponible";
  const linkedinDirectorTxt = ctx.linkedinDirector ? `LinkedIn Director: ${ctx.linkedinDirector}` : "LinkedIn Director: no disponible";
  const redesTxt = `${websiteTxt}\n${instagramTxt}\n${linkedinEmpresaTxt}\n${linkedinDirectorTxt}`;

  // Definir módulos y encontrar el módulo solicitado
  const defaultModules = [
    { id: "INVESTIGACION_DIGITAL", label: "Investigación Digital", prompt: `Genera un análisis de investigación digital: presencia web, SEO, contenido, autoridad digital.\n\nContexto disponible:\n${redesTxt}\n\nResponde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales.` },
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
    { id: "linkedin_decision_makers", label: "LinkedIn – Tomadores de decisión", prompt: "Análisis de perfiles clave en LinkedIn y su impacto estratégico. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "north_star_metric", label: "North Star y métricas clave", prompt: "Identificación de la métrica principal que impulsa el crecimiento del negocio. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "producto_servicio_estrella", label: "Producto / Servicio estrella", prompt: "Identificación del producto o servicio con mayor potencial de crecimiento. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "auditoria_tecnica_basica", label: "Auditoría técnica básica", prompt: "Revisión de tracking, analítica y herramientas técnicas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "plan_crecimiento", label: "Plan de crecimiento", prompt: "Acciones 72h + plan 30–90 días. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "propuesta_easy", label: "Propuesta de crecimiento EASY", prompt: "Traducción del diagnóstico en oportunidades de servicio. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "oportunidades_negocio_easy", label: "Oportunidades de negocio EASY", prompt: "Detectá oportunidades comerciales para EASY basadas en el diagnóstico del lead y su entidad. Entregá: 1) Qué servicio vender (3 opciones) 2) Para qué problema 3) Argumento de venta 4) Paquetización 5) Quick wins 72h 6) Objeciones y respuestas. Si ya es cliente: tono optimización, no crítica destructiva. Cerrar con La jugada más rentable. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
  ];

  const fallbackGeneric = "Genera análisis para este módulo. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.";
  let module = defaultModules.find((m) => m.id === moduleId);
  if (!module) {
    module = {
      id: moduleId,
      label: moduleId,
      prompt: customPrompts?.modules?.[moduleId] ?? fallbackGeneric,
    };
  }

  const modulePromptOriginal = customPrompts?.modules?.[moduleId] || module.prompt;
  
  // Frame extra para módulo CIERRE_VENTA (agnóstico y universal, adaptado según sellerHint)
  const cierreFrameExtra = `
CONTEXTO DEL VENDEDOR:
- Nuestra organización tipo: ${sellerHint}.

ACLARACIÓN CRÍTICA (NO NEGOCIABLE):
- Este módulo trata sobre cómo "NOSOTROS" (el usuario del CRM / nuestra organización) cerramos la venta con ESTE lead.
- NO expliques cómo el lead cierra ventas con sus clientes.
- Si el contexto del prompt base describe a nuestra organización (ej: Cámara, Agencia, Consultora), úsalo. Si no, referite a "nuestra organización" de forma genérica.

ENTREGABLES:
1) Objetivo de cierre (qué significa "ganar" este lead para nosotros).
2) Estrategia de cierre paso a paso (en 6–10 bullets accionables).
3) Guión de cierre (frases exactas + preguntas).
4) Objeciones típicas y respuestas (mínimo 6).
5) Plan de follow-up 72h (WhatsApp + Email + LinkedIn), mensajes listos para copiar.
6) Señales de avance y señales de riesgo (qué observar).
`;
  
  // Agregar frame extra si es CIERRE_VENTA
  const modulePromptFinal = moduleId === "CIERRE_VENTA"
    ? `${modulePromptOriginal}\n\n${cierreFrameExtra}`
    : modulePromptOriginal;
  
  console.log("[AI] module prompt head:", (modulePromptFinal || "").slice(0, 120));

  const moduleUserPrompt = `${userPrompt}\n\n**TAREA ESPECÍFICA:**\n${modulePromptFinal}\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${moduleId}\n\nY luego el contenido del análisis. NO incluyas otros tabs ni texto fuera de este bloque.`;

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
  lead: LeadRow & {
    custom_prompt?: string | null;
    empresas?: { web?: string | null; instagram?: string | null; facebook?: string | null; nombre?: string | null; [k: string]: unknown } | null;
    _contacts?: Array<{ nombre: string; cargo: string | null; telefono: string | null; email: string | null; is_primary: boolean; notas: string | null }>;
    _ya_es_cliente_agencia?: boolean;
  },
  customPrompts?: { base?: string; modules?: Record<string, string> },
  ctx?: ResolvedContext,
  moduleIdsToRun?: string[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("OPENAI_API_KEY presente:", Boolean(process.env.OPENAI_API_KEY));
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const ya_es_cliente_agencia = !!(lead as any)._ya_es_cliente_agencia;
  const contacts = (lead as any)._contacts ?? [];

  // PRIORIDAD 1: Leer prompt base (customPrompts > DB > fallback)
  let promptBase = "";
  if (customPrompts?.base?.trim()) {
    promptBase = customPrompts.base.trim();
  } else {
    promptBase = (await getPromptBase()).trim();
  }

  const fallbackNeutro = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

  let systemPrompt = promptBase || fallbackNeutro;
  if (promptBase && !promptBase.toLowerCase().includes("no mencionar cámara")) {
    systemPrompt = `${systemPrompt}\n\nREGLAS ESTRICTAS:\n- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.\n- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;
  }

  if (ya_es_cliente_agencia) {
    systemPrompt += `

REGLAS DE TONO (YA ES CLIENTE DE LA AGENCIA):
- Este lead ya es cliente. Usá tono de optimización y mejora continua, NO crítica destructiva.
- No uses lenguaje destructivo (ej. "espantoso", "pésimo", "desastroso"). Enfocate en mejoras, próximos pasos, quick wins y experimentos.
- Proponé optimizaciones y oportunidades de crecimiento con tacto.`;
  } else {
    systemPrompt += `

REGLAS DE TONO (PROSPECCIÓN):
- Podés detectar gaps y oportunidades con tacto. Mantené tono consultivo y constructivo.`;
  }

  // Detectar tipo de organización del vendedor desde systemPrompt para el frame de CIERRE_VENTA
  const sellerHint =
    systemPrompt.toLowerCase().includes("cámara") ? "cámara" :
    systemPrompt.toLowerCase().includes("agencia") ? "agencia" :
    systemPrompt.toLowerCase().includes("consultora") ? "consultora" :
    "organización";

  // Usar contexto resuelto si está disponible, sino resolver desde lead
  const resolvedCtx = ctx || resolveLeadContext(lead, null);
  
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Construir user prompt con contexto resuelto
  const userPromptParts: string[] = [];
  
  // PRIORIDAD 1: Personalización IA al inicio (si existe) - se incluirá en todos los módulos
  // Nota: La personalización se agregará individualmente en cada módulo con instrucciones específicas
  
  // Determinar origen del website para mostrar en el prompt
  const websiteDisplay = resolvedCtx.website ? `${resolvedCtx.website} (${resolvedCtx.websiteSource})` : "No proporcionado";
  
  const empresa = lead.empresas;
  userPromptParts.push(`## DATOS DE ENTIDAD (empresa vinculada)
${empresa?.nombre ? `- Nombre: ${empresa.nombre}` : ""}
${resolvedCtx.rubro ? `- Rubro: ${resolvedCtx.rubro}` : ""}
${resolvedCtx.direccion ? `- Dirección: ${resolvedCtx.direccion}` : ""}
${resolvedCtx.ciudad ? `- Ciudad: ${resolvedCtx.ciudad}` : ""}
${resolvedCtx.pais ? `- País: ${resolvedCtx.pais}` : ""}
- Website: ${resolvedCtx.website || "—"}
- Instagram: ${resolvedCtx.instagram || "—"}
- Facebook: ${resolvedCtx.facebook || "—"}
${(empresa as any)?.telefono ? `- Teléfono: ${(empresa as any).telefono}` : ""}
${(empresa as any)?.email ? `- Email: ${(empresa as any).email}` : ""}
${(empresa as any)?.celular ? `- Celular: ${(empresa as any).celular}` : ""}
${(empresa as any)?.rut ? `- RUT: ${(empresa as any).rut}` : ""}
${!empresa ? "- No hay entidad vinculada" : ""}

## DATOS DEL LEAD (nuevos)
- Empresa/Nombre: ${resolvedCtx.nombre}
- Lead ID: ${lead.id}
- Origen: ${resolvedCtx.origen}
- Pipeline: ${resolvedCtx.pipeline}
- Website (efectivo): ${websiteDisplay}
- Instagram (efectivo): ${resolvedCtx.instagram ? `${resolvedCtx.instagram} (${resolvedCtx.instagramSource})` : "No proporcionado"}
- Facebook (entidad): ${resolvedCtx.facebook || "—"}
- Tamaño: ${resolvedCtx.tamano || "No especificado"}
- Objetivos: ${resolvedCtx.objetivos || "No especificados"}
- ¿Ya es cliente de la Agencia?: ${resolvedCtx.audiencia || "No especificado"}
- Notas de prensa e info adicional.: ${resolvedCtx.oferta || "No especificado"}
- LinkedIn Empresa: ${resolvedCtx.linkedinEmpresa || "—"}
- LinkedIn Director: ${resolvedCtx.linkedinDirector || "—"}
- Meet URL: ${resolvedCtx.meetUrl || "—"}
- Notas: ${resolvedCtx.notas || "Sin notas"}

${contacts.length > 0 ? `## CONTACTOS DEL LEAD\n${contacts.map(
  (
    c: {
      nombre?: string | null
      cargo?: string | null
      celular?: string | null
      telefono?: string | null
      email?: string | null
      principal?: boolean | null
      es_principal?: boolean | null
      is_primary?: boolean | null
      notas?: string | null
    },
    i: number
  ) => `${i + 1}) ${c.nombre}${c.cargo ? ` (${c.cargo})` : ""}${c.telefono ? ` Tel: ${c.telefono}` : ""}${c.email ? ` Email: ${c.email}` : ""}${(c.is_primary ?? c.es_principal ?? c.principal) ? " [Principal]" : ""}${c.notas ? ` Notas: ${c.notas}` : ""}`).join("\n")}` : ""}

${resolvedCtx.clienteHistorial ? `## CLIENTE (historial)\n${resolvedCtx.clienteHistorial}` : ""}

Fecha: ${fecha}`);
  
  // PRIORIDAD 3: Agregar instrucción para generar sección de datos faltantes (solo campos críticos)
  const missingFields: Array<{ field: string; impact: string; question: string; where: string }> = [];
  
  // Solo preguntar website si está vacío en Lead, Entidad y Cliente
  if (!resolvedCtx.website || !resolvedCtx.website.trim()) {
    missingFields.push({
      field: "Website",
      impact: "Crítico para validar rubro, propuesta de valor y análisis de presencia digital",
      question: "¿Cuál es el website de la empresa?",
      where: "Entidad → Campo 'web' (o Lead → Campo 'website' como fallback)"
    });
  }
  
  // Solo preguntar instagram si está vacío en Entidad
  if (!resolvedCtx.instagram || !resolvedCtx.instagram.trim()) {
    missingFields.push({
      field: "Instagram",
      impact: "Útil para análisis de redes sociales y presencia digital",
      question: "¿Cuál es el perfil de Instagram de la empresa?",
      where: "Entidad → Campo 'instagram'"
    });
  }
  
  // NO pedir objetivos, audiencia, tamano, oferta si ya existen (son opcionales)
  
  // Solo agregar la sección si hay campos faltantes
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

  const websiteTxt = resolvedCtx.website ? `Website detectado: ${resolvedCtx.website}` : "Website: no disponible";
  const instagramTxt = resolvedCtx.instagram ? `Instagram detectado: ${resolvedCtx.instagram}` : "Instagram: no disponible";
  const facebookTxt = resolvedCtx.facebook ? `Facebook detectado: ${resolvedCtx.facebook}` : "Facebook: no disponible";
  const linkedinEmpresaTxt = resolvedCtx.linkedinEmpresa ? `LinkedIn Empresa: ${resolvedCtx.linkedinEmpresa}` : "LinkedIn Empresa: no disponible";
  const linkedinDirectorTxt = resolvedCtx.linkedinDirector ? `LinkedIn Director: ${resolvedCtx.linkedinDirector}` : "LinkedIn Director: no disponible";
  const redesTxt = `${websiteTxt}\n${instagramTxt}\n${facebookTxt}\n${linkedinEmpresaTxt}\n${linkedinDirectorTxt}`;
  
  // Frame extra para módulo CIERRE_VENTA (agnóstico y universal, adaptado según sellerHint)
  const cierreFrameExtra = `
CONTEXTO DEL VENDEDOR:
- Nuestra organización tipo: ${sellerHint}.

ACLARACIÓN CRÍTICA (NO NEGOCIABLE):
- Este módulo trata sobre cómo "NOSOTROS" (el usuario del CRM / nuestra organización) cerramos la venta con ESTE lead.
- NO expliques cómo el lead cierra ventas con sus clientes.
- Si el contexto del prompt base describe a nuestra organización (ej: Cámara, Agencia, Consultora), úsalo. Si no, referite a "nuestra organización" de forma genérica.

ENTREGABLES:
1) Objetivo de cierre (qué significa "ganar" este lead para nosotros).
2) Estrategia de cierre paso a paso (en 6–10 bullets accionables).
3) Guión de cierre (frases exactas + preguntas).
4) Objeciones típicas y respuestas (mínimo 6).
5) Plan de follow-up 72h (WhatsApp + Email + LinkedIn), mensajes listos para copiar.
6) Señales de avance y señales de riesgo (qué observar).
`;
  
  // Definir módulos/tabs a generar (11 módulos)
  const redesContext = [resolvedCtx.instagram && `Instagram: ${resolvedCtx.instagram}`, resolvedCtx.facebook && `Facebook: ${resolvedCtx.facebook}`].filter(Boolean).join("; ");
  const redesSocialesPrompt = redesContext
    ? `Redes detectadas: ${redesContext}. Analizá presencia y contenido basado en esos perfiles. Genera un análisis de redes sociales: presencia, engagement, estrategia de contenido, audiencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.`
    : "Genera un análisis de redes sociales: presencia, engagement, estrategia de contenido, audiencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.";
  
  // Prompt de INVESTIGACION_DIGITAL con contexto de website e instagram explícitos
  const investigacionDigitalPrompt = `Genera un análisis de investigación digital: presencia web, SEO, contenido, autoridad digital.\n\nContexto disponible:\n${redesTxt}\n\nResponde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales.`;
  
  const defaultModules = [
    { id: "INVESTIGACION_DIGITAL", label: "Investigación Digital", prompt: investigacionDigitalPrompt },
    { id: "REDES_SOCIALES", label: "Redes Sociales", prompt: redesSocialesPrompt },
    { id: "PAUTA_PUBLICITARIA", label: "Pauta Publicitaria", prompt: "Genera un análisis de pauta publicitaria: inversión, canales, mensajes, ROI potencial. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "PRESTIGIO_IA", label: "Prestigio IA", prompt: "Genera un análisis de prestigio usando IA: reputación, menciones, reviews, señales de calidad. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "POSICIONAMIENTO", label: "Posicionamiento", prompt: "Genera un análisis de posicionamiento: mercado, diferenciación, propuesta de valor, competencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "COMPETENCIA", label: "Competencia", prompt: "Genera un análisis de competencia: competidores directos, ventajas competitivas, amenazas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "FODA", label: "FODA", prompt: "Genera un análisis FODA completo con: Fortalezas, Oportunidades, Debilidades y Amenazas. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales." },
    { id: "OPORTUNIDADES", label: "Oportunidades", prompt: "Genera un análisis de oportunidades con subsecciones: Oportunidades visibles, Oportunidades ocultas, Anticipación, Mejoras no pedidas, Tácticas inesperadas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "ACCIONES", label: "Acciones", prompt: "Genera un plan de acciones con subsecciones: Acciones 72 hs, Plan 30–90 días. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "MATERIALES_LISTOS", label: "Materiales Listos", prompt: "Genera una lista de materiales listos para usar: Copys, Scripts, PDFs, Recursos accionables. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "CIERRE_VENTA", label: "Cierre de Venta", prompt: "Genera estrategias de cierre de venta: argumentos, objeciones, CTAs, próximos pasos. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "linkedin_decision_makers", label: "LinkedIn – Tomadores de decisión", prompt: "Análisis de perfiles clave en LinkedIn y su impacto estratégico. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "north_star_metric", label: "North Star y métricas clave", prompt: "Identificación de la métrica principal que impulsa el crecimiento del negocio. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "producto_servicio_estrella", label: "Producto / Servicio estrella", prompt: "Identificación del producto o servicio con mayor potencial de crecimiento. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "auditoria_tecnica_basica", label: "Auditoría técnica básica", prompt: "Revisión de tracking, analítica y herramientas técnicas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "plan_crecimiento", label: "Plan de crecimiento", prompt: "Acciones 72h + plan 30–90 días. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "propuesta_easy", label: "Propuesta de crecimiento EASY", prompt: "Traducción del diagnóstico en oportunidades de servicio. Responde SOLO con el contenido, sin introducciones ni títulos adicionales." },
    { id: "oportunidades_negocio_easy", label: "Oportunidades de negocio EASY", prompt: `Detectá oportunidades comerciales para EASY basadas en el diagnóstico del lead y su entidad.

Entregá:
1) Qué servicio vender (3 opciones en orden de prioridad)
2) Para qué problema (dolor explícito/implícito)
3) Argumento de venta (beneficio + prueba + riesgo de no actuar)
4) Paquetización (Starter / Growth / Scale) con alcance resumido
5) Quick wins (72h) que podamos prometer como "primeros avances"
6) Objeciones probables y cómo responderlas

REGLA:
Si "¿Ya es cliente de la Agencia?" es SI, NO criticar destructivamente.
Hablar en tono de optimización: mejoras, experimentos, expansión, eficiencia.

Cerrar con:
"La jugada más rentable" (1–2 recomendaciones de alto impacto).

Responde SOLO con el contenido, sin introducciones ni títulos adicionales.` },
    { id: "vision_estrategica", label: "Visión Estratégica", prompt: `Actúa como Director de Growth Marketing Senior y socio estratégico.

Tu tarea NO es analizar módulos por separado ni repetir diagnósticos.
Tu tarea es integrar todo el informe previo y producir una lectura estratégica unificada.

Objetivo:
Convertir el informe técnico en una visión clara para la toma de decisiones.

Instrucciones obligatorias:
- No repitas información descriptiva ya mencionada.
- No enumeres herramientas ni tácticas menores.
- Prioriza impacto de negocio sobre exhaustividad.
- Toma postura profesional, incluso si implica descartar opciones.
- Pensá como si tu reputación dependiera de esta recomendación.

Desarrolla los siguientes bloques, en este orden y solo con el contenido solicitado:

1. LECTURA CENTRAL  
2. PALANCA ESTRATÉGICA DOMINANTE  
3. FOCO RECOMENDADO  
4. RIESGO CLAVE  
5. DECISIÓN SUGERIDA  
6. PRÓXIMO MOVIMIENTO INTELIGENTE  

Reglas finales:
- Sé claro, directo y sintético.
- Evita lenguaje genérico o académico.
- No vendas servicios.
- No cierres con frases abiertas.` },
  ];

  const configModuleKeys = Object.keys(customPrompts?.modules ?? {});
  const defaultIds = defaultModules.map((m) => m.id);
  const allModuleIds = moduleIdsToRun?.length
    ? moduleIdsToRun
    : [...new Set([...defaultIds, ...configModuleKeys])];

  const fallbackPrompt = "Genera análisis para este módulo. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.";
  const modules = allModuleIds.map((moduleId) => {
    const def = defaultModules.find((m) => m.id === moduleId);
    const prompt = customPrompts?.modules?.[moduleId] ?? def?.prompt ?? fallbackPrompt;
    return { id: moduleId, label: def?.label ?? moduleId, prompt };
  });

  try {
    const moduleResults: string[] = [];

    // Generar cada módulo con una llamada separada a OpenAI
    for (const module of modules) {
      try {
        // Construir prompt del módulo: usar prompt original y agregar frame extra si es CIERRE_VENTA
        const modulePromptOriginal = module.prompt;
        const modulePromptFinal = module.id === "CIERRE_VENTA"
          ? `${modulePromptOriginal}\n\n${cierreFrameExtra}`
          : modulePromptOriginal;
        
        // Construir prompt del módulo con personalización IA al inicio (si existe)
        const personalizacionBlock = buildPersonalizacionIABlock(lead.custom_prompt, module.id);
        
        // Construir el prompt del módulo: personalización primero, luego contexto base, luego tarea específica
        const moduleContextParts: string[] = [];
        
        // PRIORIDAD 1: Personalización IA al inicio
        if (personalizacionBlock) {
          moduleContextParts.push(personalizacionBlock);
          
          // Log server-only
          console.log(`[AI] Módulo ${module.id}: Personalización IA incluida (length: ${lead.custom_prompt?.trim().length || 0})`);
        }
        
        // PRIORIDAD 2: Contexto base del lead
        moduleContextParts.push(userPrompt);
        
        // PRIORIDAD 3: Tarea específica del módulo
        moduleContextParts.push(`**TAREA ESPECÍFICA:**\n${modulePromptFinal}`);
        
        const moduleUserPrompt = moduleContextParts.join("\n\n") + `\n\n**FORMATO OBLIGATORIO:**\nTu respuesta DEBE comenzar exactamente así:\n\n### TAB:${module.id}\n\nY luego el contenido del análisis. NO incluyas otros tabs ni texto fuera de este bloque.`;

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
    // Normalizar only_module a snake_case minúscula para validación (tolerante a PROPUESTA_EASY, etc.)
    const rawModule = (body?.only_module || body?.module_id)?.trim() || null;
    const onlyModuleNormalized = rawModule
      ? String(rawModule).trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_")
      : null;

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
      "vision_estrategica",
      "linkedin_decision_makers",
      "north_star_metric",
      "producto_servicio_estrella",
      "auditoria_tecnica_basica",
      "plan_crecimiento",
      "propuesta_easy",
      "oportunidades_negocio_easy",
    ];
    const validSet = new Set(validModuleIds.map((id) => id.toLowerCase()));

    if (onlyModuleNormalized && !validSet.has(onlyModuleNormalized)) {
      console.log(`[AI] regen tab ${onlyModuleNormalized} status 400`);
      return NextResponse.json(
        { data: null, error: `only_module inválido: ${rawModule}. Debe ser uno de: ${validModuleIds.join(", ")}` } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    // Id canónico para report/compare: mismo caso que en validModuleIds (report usa [TAB:...])
    const only_module = onlyModuleNormalized
      ? (validModuleIds.find((id) => id.toLowerCase() === onlyModuleNormalized) ?? onlyModuleNormalized)
      : null;
    
    // Fuente de verdad: prioridad 1) body.personalization, 2) body.custom_prompt, 3) lead.ai_custom_prompt, 4) null
    const bodyCustomPrompt = (typeof body?.personalization === "string" ? body.personalization.trim() : null) ||
                             (typeof body?.custom_prompt === "string" ? body.custom_prompt.trim() : null);
    
    // Log para debugging (antes de leer el lead)
    console.log("[AI] only_module:", only_module, "force:", shouldRegenerate);

    const leadSelect = "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,empresa_id,linkedin_empresa,linkedin_director,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(nombre))";
    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select(leadSelect)
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const leadRow = lead as LeadRow;

    // Contactos del lead (para contexto IA)
    let contacts: Array<{ nombre: string; cargo: string | null; telefono: string | null; email: string | null; is_primary: boolean; notas: string | null }> = [];
    try {
      const { data: contactsData } = await sb
        .from("lead_contacts")
        .select("nombre,cargo,telefono,email,is_primary,notas")
        .eq("lead_id", id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (contactsData?.length) contacts = contactsData as typeof contacts;
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.warn("[AI] Error fetching contacts:", e);
    }
    
    // Consultar socio/cliente si existe (por lead_id o empresa_id)
    let cliente: { nombre?: string | null; email?: string | null; telefono?: string | null; plan?: string | null; estado?: string | null; fecha_alta?: string | null; proxima_accion?: string | null } | null = null;
    
    try {
      // Intentar buscar por lead_id primero
      const socioByLeadId = await sb
        .from("socios")
        .select("nombre,email,telefono,plan,estado,fecha_alta,proxima_accion")
        .eq("lead_id", id)
        .maybeSingle();
      
      if (socioByLeadId.data) {
        cliente = socioByLeadId.data;
      } else if (leadRow.empresa_id) {
        // Si no hay por lead_id, buscar por empresa_id
        const socioByEmpresaId = await sb
          .from("socios")
          .select("nombre,email,telefono,plan,estado,fecha_alta,proxima_accion")
          .eq("empresa_id", leadRow.empresa_id)
          .maybeSingle();
        
        if (socioByEmpresaId.data) {
          cliente = socioByEmpresaId.data;
        }
      }
    } catch (e) {
      // Si falla la consulta de cliente, continuar sin él (no crítico)
      console.warn("[AI] Error consultando cliente/socio:", e);
    }
    
    // Resolver contexto unificado
    const ctx = resolveLeadContext(leadRow, cliente);

    // Cargar config IA desde DB si el body no trae prompts (siempre usar módulo IA cuando falte)
    let effectivePrompts = body?.prompts;
    if (!effectivePrompts?.base?.trim()) {
      const dbConfig = await getIAConfigFromDB();
      if (dbConfig.base || (dbConfig.modules && Object.keys(dbConfig.modules).length > 0)) {
        effectivePrompts = {
          base: effectivePrompts?.base?.trim() || dbConfig.base || "",
          modules: { ...dbConfig.modules, ...effectivePrompts?.modules },
        };
        if (process.env.NODE_ENV !== "production") {
          console.log("[AI] config from DB:", { hasBase: !!dbConfig.base, moduleKeys: dbConfig.modules ? Object.keys(dbConfig.modules) : [] });
        }
      }
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[AI] effectivePrompts:", {
        hasBase: !!effectivePrompts?.base,
        moduleKeys: effectivePrompts?.modules ? Object.keys(effectivePrompts.modules) : [],
        hasEmpresa: !!(lead as any)?.empresas,
        hasContacts: contacts.length > 0,
        redes: {
          website: !!ctx.website,
          instagram: !!ctx.instagram,
          facebook: !!ctx.facebook,
          linkedin: !!(leadRow.linkedin_empresa || leadRow.linkedin_director),
        },
      });
    }

    // Heurística: ¿Ya es cliente de la Agencia? (desde audiencia / "¿Ya es cliente de la Agencia?")
    const audienciaLower = (ctx.audiencia ?? "").toLowerCase().trim();
    const ya_es_cliente_agencia = /s[ií]|cliente|ya\s+es\s+cliente|afirmativo|yes/i.test(audienciaLower) && audienciaLower.length < 200;
    if (process.env.NODE_ENV !== "production") {
      console.log("[AI] ya_es_cliente_agencia:", ya_es_cliente_agencia, "audienciaPreview:", audienciaLower.slice(0, 80));
    }
    
    // Log de debug temporal
    console.log("[AI DEBUG] resolved:", {
      website: ctx.website,
      websiteSource: ctx.websiteSource,
      instagram: ctx.instagram,
      instagramSource: ctx.instagramSource,
      linkedinEmpresa: ctx.linkedinEmpresa,
      linkedinDirector: ctx.linkedinDirector,
      oferta: ctx.oferta,
      objetivos: ctx.objetivos,
      audiencia: ctx.audiencia,
      hasCliente: !!cliente,
      clienteHistorial: ctx.clienteHistorial,
    });

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
        // Lookup case-insensitive: el front puede enviar PROPUESTA_EASY y el backend usa propuesta_easy
        const mods = body?.prompts?.modules ?? {};
        const moduleKey = Object.keys(mods).find(
          (k) => k.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_") === only_module
        ) ?? only_module;
        let modulePrompt = mods[moduleKey] || mods[only_module] || "";
        
        // Fallback para vision_estrategica: usar prompt default si no está en localStorage
        if (!modulePrompt && only_module === "vision_estrategica") {
          const defaultVisionPrompt = `Actúa como Director de Growth Marketing Senior y socio estratégico.

Tu tarea NO es analizar módulos por separado ni repetir diagnósticos.
Tu tarea es integrar todo el informe previo y producir una lectura estratégica unificada.

Objetivo:
Convertir el informe técnico en una visión clara para la toma de decisiones.

Instrucciones obligatorias:
- No repitas información descriptiva ya mencionada.
- No enumeres herramientas ni tácticas menores.
- Prioriza impacto de negocio sobre exhaustividad.
- Toma postura profesional, incluso si implica descartar opciones.
- Pensá como si tu reputación dependiera de esta recomendación.

Desarrolla los siguientes bloques, en este orden y solo con el contenido solicitado:

1. LECTURA CENTRAL  
2. PALANCA ESTRATÉGICA DOMINANTE  
3. FOCO RECOMENDADO  
4. RIESGO CLAVE  
5. DECISIÓN SUGERIDA  
6. PRÓXIMO MOVIMIENTO INTELIGENTE  

Reglas finales:
- Sé claro, directo y sintético.
- Evita lenguaje genérico o académico.
- No vendas servicios.
- No cierres con frases abiertas.`;
          modulePrompt = defaultVisionPrompt;
          console.warn(`[AI] Prompt no encontrado en localStorage para ${only_module}, usando prompt default`);
        }
        
        const promptUpdatedAt = body?.prompts_meta?.updated_at?.modules?.[only_module] || body?.prompts_meta?.updated_at?.base || null;
        const promptHead = (modulePrompt || "").slice(0, 80);
        
        // Logs específicos requeridos
        console.log("[AI] leadId:", id, "only_module:", only_module, "promptUpdatedAt:", promptUpdatedAt, "promptHead:", promptHead, "status: 200");
        
        if (!modulePrompt) {
          throw new Error(`Prompt no proporcionado para módulo ${only_module}`);
        }
        
        // Detectar tipo de organización del vendedor desde basePrompt para el frame de CIERRE_VENTA
        const basePromptForHint = body?.prompts?.base || "";
        const sellerHint =
          basePromptForHint.toLowerCase().includes("cámara") ? "cámara" :
          basePromptForHint.toLowerCase().includes("agencia") ? "agencia" :
          basePromptForHint.toLowerCase().includes("consultora") ? "consultora" :
          "organización";
        
        // Frame extra para módulo CIERRE_VENTA (agnóstico y universal, adaptado según sellerHint)
        const cierreFrameExtra = `
CONTEXTO DEL VENDEDOR:
- Nuestra organización tipo: ${sellerHint}.

ACLARACIÓN CRÍTICA (NO NEGOCIABLE):
- Este módulo trata sobre cómo "NOSOTROS" (el usuario del CRM / nuestra organización) cerramos la venta con ESTE lead.
- NO expliques cómo el lead cierra ventas con sus clientes.
- Si el contexto del prompt base describe a nuestra organización (ej: Cámara, Agencia, Consultora), úsalo. Si no, referite a "nuestra organización" de forma genérica.

ENTREGABLES:
1) Objetivo de cierre (qué significa "ganar" este lead para nosotros).
2) Estrategia de cierre paso a paso (en 6–10 bullets accionables).
3) Guión de cierre (frases exactas + preguntas).
4) Objeciones típicas y respuestas (mínimo 6).
5) Plan de follow-up 72h (WhatsApp + Email + LinkedIn), mensajes listos para copiar.
6) Señales de avance y señales de riesgo (qué observar).
`;
        
        // Caso especial: vision_estrategica usa el informe completo como contexto
        let newTabContent: string;
        if (only_module === "vision_estrategica") {
          // Validar que existe informe previo
          const existingReport = leadRow.ai_report?.trim() || "";
          if (!existingReport) {
            throw new Error("No hay informe previo disponible. Debes generar el informe completo primero antes de generar Visión Estratégica.");
          }
          
          newTabContent = await generateVisionEstrategica(
            {
              ...leadRow,
              ai_context: leadRow.ai_context || null,
              custom_prompt: finalCustomPrompt,
              empresas: (lead as any)?.empresas || null,
            },
            body?.prompts?.base || "",
            modulePrompt,
            cliente
          );
        } else {
          // Construir prompt del módulo: agregar frame extra si es CIERRE_VENTA, o instagram si es REDES_SOCIALES
          let finalModulePrompt = modulePrompt;
          if (only_module === "CIERRE_VENTA") {
            finalModulePrompt = `${modulePrompt}\n\n${cierreFrameExtra}`;
          } else if (only_module === "REDES_SOCIALES" && ctx.instagram) {
            finalModulePrompt = `Instagram detectado: ${ctx.instagram}. Analizá su presencia y contenido basado en ese perfil real. ${modulePrompt}`;
          }
          
          newTabContent = await generateSingleModuleWithPrompt(
            {
              ...leadRow,
              website: ctx.website || null,
              ai_context: leadRow.ai_context || null,
              custom_prompt: finalCustomPrompt,
              empresas: (lead as any)?.empresas || null,
            },
            only_module,
            body?.prompts?.base || "",
            finalModulePrompt
          );
        }

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
      const leadForAI = {
        ...leadRow,
        ai_context: leadRow.ai_context || null,
        custom_prompt: finalCustomPrompt,
        empresas: (lead as any)?.empresas || null,
      } as LeadRow & { _contacts?: typeof contacts; _ya_es_cliente_agencia?: boolean };
      (leadForAI as any)._contacts = contacts;
      (leadForAI as any)._ya_es_cliente_agencia = ya_es_cliente_agencia;

      const moduleIds = Object.keys(effectivePrompts?.modules ?? {});
      const leadEmpresa = (leadRow as any)?.empresas as
        | {
            web?: string | null;
            website?: string | null;
            instagram?: string | null;
            facebook?: string | null;
            linkedin?: string | null;
          }
        | null
        | undefined;
      const hasWeb = Boolean(
        leadEmpresa?.web ||
          leadEmpresa?.website ||
          (leadRow as any)?.website ||
          leadRow?.website ||
          leadEmpresa?.instagram ||
          leadEmpresa?.facebook ||
          leadEmpresa?.linkedin ||
          leadRow?.linkedin_empresa ||
          leadRow?.linkedin_director
      );
      const adHint = `${leadRow?.ai_context ?? ""} ${leadRow?.notas ?? ""} ${leadRow?.objetivos ?? ""}`.toLowerCase();
      const hasPauta = Boolean(
        (leadRow as any)?.pauta_publicitaria ||
        (leadRow as any)?.ads ||
        adHint.includes("ads") ||
        adHint.includes("pauta") ||
        adHint.includes("pixel") ||
        adHint.includes("capi")
      );
      const shouldIncludeTech = hasWeb || hasPauta;
      const filteredModuleIds = moduleIds.filter(
        (id) => shouldIncludeTech || !TECH_MODULE_IDS.includes(id as any)
      );
      if (process.env.NODE_ENV !== "production") {
        console.log("[AI REPORT] modulesToRun", { shouldIncludeTech, hasWeb, hasPauta, count: filteredModuleIds.length, modulesToRun: filteredModuleIds });
      }

      report = await generateAiReportAI(
        leadForAI,
        effectivePrompts ?? undefined,
        ctx,
        filteredModuleIds
      );
      // Construir contexto para guardar (usar contexto resuelto)
      aiContext = [
        `Nombre: ${ctx.nombre}`,
        `Origen: ${ctx.origen}`,
        `Pipeline: ${ctx.pipeline}`,
        `Website: ${ctx.website || "—"} (${ctx.websiteSource})`,
        `Instagram: ${ctx.instagram || "—"} (${ctx.instagramSource})`,
        `Tamaño: ${ctx.tamano || "—"}`,
        `Objetivos: ${ctx.objetivos || "—"}`,
        `Audiencia: ${ctx.audiencia || "—"}`,
        `Oferta: ${ctx.oferta || "—"}`,
        `Notas: ${ctx.notas || "—"}`,
        cliente ? `Cliente: ${ctx.clienteHistorial || "—"}` : "",
        `Generado con IA: ${new Date().toISOString()}`,
      ].filter(Boolean).join("\n");
    } catch (error: any) {
      // Fallback: generar informe técnico básico
      console.log("[AI] Entrando en modo FALLBACK (sin OpenAI)");
      console.log("[AI] OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "PRESENTE" : "AUSENTE");
      console.log("[AI] NODE_ENV:", process.env.NODE_ENV);
      
      report = generateFallbackReport({
        ...leadRow,
        ai_context: leadRow.ai_context || null,
        empresas: (lead as any)?.empresas || null,
      });
      aiContext = [
        `Nombre: ${ctx.nombre}`,
        `Origen: ${ctx.origen}`,
        `Pipeline: ${ctx.pipeline}`,
        `Website: ${ctx.website || "—"} (${ctx.websiteSource})`,
        `Instagram: ${ctx.instagram || "—"} (${ctx.instagramSource})`,
        `Tamaño: ${ctx.tamano || "—"}`,
        `Objetivos: ${ctx.objetivos || "—"}`,
        `Audiencia: ${ctx.audiencia || "—"}`,
        `Oferta: ${ctx.oferta || "—"}`,
        `Notas: ${ctx.notas || "—"}`,
        cliente ? `Cliente: ${ctx.clienteHistorial || "—"}` : "",
        `Error IA: ${error?.message ?? "Unknown error"}`,
        `Generado con fallback: ${new Date().toISOString()}`,
      ].filter(Boolean).join("\n");
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
        generated: moduleIds,
        error: null,
      } satisfies ApiResp<any> & { generated?: string[] },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}