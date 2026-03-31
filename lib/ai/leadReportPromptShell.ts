/**
 * Construcción compartida de system / user / frame de cierre para informe IA por lead.
 * Usada por el flujo legacy (generateAiReportAI) y el flujo controlado (runLeadAiAnalysisControlled).
 */

export type LeadReportPromptShellLead = {
  id: string;
  custom_prompt?: string | null;
  empresas?: {
    nombre?: string | null;
    web?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    telefono?: string | null;
    email?: string | null;
    celular?: string | null;
    rut?: string | null;
    [k: string]: unknown;
  } | null;
};

export type LeadReportPromptShellCtx = {
  nombre: string;
  origen: string;
  pipeline: string;
  website: string;
  websiteSource: string;
  instagram: string;
  instagramSource: string;
  facebook: string;
  linkedinEmpresa: string;
  linkedinDirector: string;
  meetUrl: string;
  objetivos: string;
  audiencia: string;
  tamano: string;
  oferta: string;
  notas: string;
  rubro: string;
  direccion: string;
  ciudad: string;
  pais: string;
  clienteHistorial: string;
  initiativeKind: string;
  projectDescription: string;
  isStartupLead: boolean;
};

export type LeadReportPromptShellExecutionProfile = {
  basePrompt?: string;
  cierreOfertaPrincipal?: string | null;
  tipoOrganizacionVendedora?: string | null;
} | null;

export type LeadReportPromptShellResult = {
  systemPrompt: string;
  userPrompt: string;
  sellerHint: string;
  cierreFrameExtra: string;
};

export async function buildLeadReportPromptShell(input: {
  lead: LeadReportPromptShellLead;
  resolvedCtx: LeadReportPromptShellCtx;
  contacts: Array<{
    nombre?: string | null;
    cargo?: string | null;
    telefono?: string | null;
    email?: string | null;
    is_primary?: boolean | null;
    es_principal?: boolean | null;
    principal?: boolean | null;
    notas?: string | null;
  }>;
  ya_es_cliente_agencia: boolean;
  customPrompts?: { base?: string };
  executionProfile: LeadReportPromptShellExecutionProfile;
  getPromptBase: () => Promise<string>;
}): Promise<LeadReportPromptShellResult> {
  const { lead, resolvedCtx, contacts, ya_es_cliente_agencia, customPrompts, executionProfile, getPromptBase } =
    input;

  let promptBase = "";
  if (customPrompts?.base?.trim()) {
    promptBase = customPrompts.base.trim();
  } else if (executionProfile?.basePrompt?.trim()) {
    promptBase = executionProfile.basePrompt.trim();
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

  const sellerHintFromSystem =
    systemPrompt.toLowerCase().includes("cámara") ? "cámara" :
    systemPrompt.toLowerCase().includes("agencia") ? "agencia" :
    systemPrompt.toLowerCase().includes("consultora") ? "consultora" :
    "organización";

  const sellerHint =
    executionProfile?.tipoOrganizacionVendedora?.trim() || sellerHintFromSystem;

  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userPromptParts: string[] = [];
  const websiteDisplay = resolvedCtx.website
    ? `${resolvedCtx.website} (${resolvedCtx.websiteSource})`
    : "No proporcionado";

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
${(empresa as { telefono?: string | null })?.telefono ? `- Teléfono: ${(empresa as { telefono?: string | null }).telefono}` : ""}
${(empresa as { email?: string | null })?.email ? `- Email: ${(empresa as { email?: string | null }).email}` : ""}
${(empresa as { celular?: string | null })?.celular ? `- Celular: ${(empresa as { celular?: string | null }).celular}` : ""}
${(empresa as { rut?: string | null })?.rut ? `- RUT: ${(empresa as { rut?: string | null }).rut}` : ""}
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
- initiative_kind (lead): ${resolvedCtx.initiativeKind || "standard"}
- project_description (lead): ${resolvedCtx.projectDescription ? resolvedCtx.projectDescription.slice(0, 8000) : "—"}

${contacts.length > 0 ? `## CONTACTOS DEL LEAD\n${contacts.map((c, i) => `${i + 1}) ${c.nombre ?? ""}${c.cargo ? ` (${c.cargo})` : ""}${c.telefono ? ` Tel: ${c.telefono}` : ""}${c.email ? ` Email: ${c.email}` : ""}${(c.is_primary ?? c.es_principal ?? c.principal) ? " [Principal]" : ""}${c.notas ? ` Notas: ${c.notas}` : ""}`).join("\n")}` : ""}

${resolvedCtx.clienteHistorial ? `## CLIENTE (historial)\n${resolvedCtx.clienteHistorial}` : ""}

Fecha: ${fecha}`);

  if (resolvedCtx.isStartupLead) {
    userPromptParts.push(`## CONTEXTO STARTUP / PROYECTO TEMPRANO

INSTRUCCIÓN OBLIGATORIA: Este lead está marcado como **startup** (proyecto incipiente, MVP o validación de idea).  
- Basá el análisis principalmente en **project_description** y en los datos de contacto/rubro.  
- **No penalices** la ausencia de website ni de redes sociales maduras; no las trates como debilidad del negocio por sí solas.  
- Enfocá el informe en hipótesis de valor, mercado, riesgos de etapa temprana y próximos pasos de descubrimiento, no en auditoría de presencia digital consolidada.

Descripción del proyecto (prioritaria):
${resolvedCtx.projectDescription || "(No cargada — pedir al comercial que complete el campo en la ficha.)"}`);
  }

  const missingFields: Array<{ field: string; impact: string; question: string; where: string }> = [];

  if (!resolvedCtx.isStartupLead && (!resolvedCtx.website || !resolvedCtx.website.trim())) {
    missingFields.push({
      field: "Website",
      impact: "Crítico para validar rubro, propuesta de valor y análisis de presencia digital",
      question: "¿Cuál es el website de la empresa?",
      where: "Entidad → Campo 'web' (o Lead → Campo 'website' como fallback)",
    });
  }

  if (!resolvedCtx.isStartupLead && (!resolvedCtx.instagram || !resolvedCtx.instagram.trim())) {
    missingFields.push({
      field: "Instagram",
      impact: "Útil para análisis de redes sociales y presencia digital",
      question: "¿Cuál es el perfil de Instagram de la empresa?",
      where: "Entidad → Campo 'instagram'",
    });
  }

  if (missingFields.length > 0) {
    userPromptParts.push(`**IMPORTANTE: DATOS FALTANTES DETECTADOS**

Al final de tu informe, DEBES incluir una sección con este formato exacto:

### DATOS FALTANTES

${missingFields.map((mf) => `- **[${mf.field}]** → Impacto: ${mf.impact}`).join("\n")}

### PREGUNTAS PARA COMPLETAR (responder en CRM)

${missingFields.map((mf, idx) => `${idx + 1}) ${mf.question}`).join("\n")}

### DÓNDE CARGARLO EN EL CRM

${missingFields.map((mf) => `- **${mf.field}**: ${mf.where}`).join("\n")}

Esta sección debe aparecer al final del informe, después de todos los módulos.`);
  }

  const userPrompt = userPromptParts.join("\n\n");

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

  return { systemPrompt, userPrompt, sellerHint, cierreFrameExtra };
}
