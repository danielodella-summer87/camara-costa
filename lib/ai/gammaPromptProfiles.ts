export type GammaPromptType = "comercial" | "tecnico";

export type GammaPromptProfile = {
  type: GammaPromptType;
  label: string;
  /** Secciones/instrucciones que debe incluir el prompt generado */
  sections: string[];
  tone: string;
  cta?: string;
};

export const GAMMA_PROMPT_PROFILES: Record<GammaPromptType, GammaPromptProfile> = {
  comercial: {
    type: "comercial",
    label: "Prompt Gamma Comercial",
    sections: [
      "Quién es la empresa (nombre, rubro, contexto)",
      "Contexto del negocio (objetivos, audiencia, tamaño)",
      "Problema u oportunidad detectada (basado en el informe IA)",
      "Propuesta comercial de EASY",
      "Servicios sugeridos (priorizados)",
      "Estructura sugerida de slides (títulos y mensaje clave por sección)",
      "Tono visual premium",
      "CTA final (llamado a la acción)",
    ],
    tone: "Tono visual premium, profesional, orientado a decisión comercial.",
    cta: "Incluir CTA final claro: próximo paso o reunión de cierre.",
  },
  tecnico: {
    type: "tecnico",
    label: "Prompt Gamma Técnico",
    sections: [
      "Diagnóstico técnico (resumen ejecutivo)",
      "Hallazgos principales (métricas, gaps, oportunidades)",
      "Oportunidades de mejora (priorizadas)",
      "Roadmap técnico (corto y mediano plazo)",
      "Estructura sugerida de slides (títulos y mensaje clave por sección)",
      "Tono visual premium / consultoría",
    ],
    tone: "Tono visual premium, consultoría, datos y recomendaciones accionables.",
  },
};

export function getGammaPromptProfile(type?: string): GammaPromptProfile {
  if (type === "tecnico") return GAMMA_PROMPT_PROFILES.tecnico;
  return GAMMA_PROMPT_PROFILES.comercial;
}

/** Contexto para armar el prompt Gamma (lead + empresa + contactos + informe IA) */
export type GammaPromptContext = {
  lead: {
    nombre?: string | null;
    objetivos?: string | null;
    audiencia?: string | null;
    tamano?: string | null;
    oferta?: string | null;
    notas?: string | null;
    origen?: string | null;
    pipeline?: string | null;
    website?: string | null;
  };
  empresa: {
    nombre?: string | null;
    web?: string | null;
    email?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    ciudad?: string | null;
    pais?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    rubroNombre?: string | null;
  } | null;
  contactos: Array<{
    nombre?: string | null;
    cargo?: string | null;
    telefono?: string | null;
    email?: string | null;
  }>;
  aiReport: string;
  reportProfile: GammaPromptProfile;
};

function safe(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  return s || "—";
}

/**
 * Construye el prompt para Gamma – plantilla comercial.
 * Incluye: propuesta estratégica, oportunidades, servicios sugeridos, plan 30/90, CTA.
 */
export function buildGammaCommercialPrompt(ctx: GammaPromptContext): string {
  const { lead, empresa, contactos, aiReport, reportProfile } = ctx;
  const lines: string[] = [];
  lines.push("# Presentación Comercial – Propuesta EASY");
  lines.push("");
  lines.push("Genera una presentación ejecutiva con tono premium, claro y listo para presentar.");
  lines.push("");
  lines.push("## Estructura requerida");
  lines.push("1. Quién es la empresa (nombre, rubro, contexto)");
  lines.push("2. Propuesta estratégica para el cliente");
  lines.push("3. Oportunidades detectadas (basado en el informe)");
  lines.push("4. Servicios sugeridos (priorizados)");
  lines.push("5. Plan 30 / 90 días (próximos pasos)");
  lines.push("6. CTA final (llamado a la acción: reunión, cierre, siguiente paso)");
  lines.push("");
  lines.push("---");
  lines.push("## Datos de la empresa");
  lines.push(`Empresa: ${safe(empresa?.nombre) || safe(lead.nombre)}`);
  lines.push(`Rubro: ${safe(empresa?.rubroNombre)}`);
  lines.push(`Web: ${safe(empresa?.web)} | Email: ${safe(empresa?.email)} | Tel: ${safe(empresa?.telefono)}`);
  lines.push(`Ubicación: ${safe(empresa?.direccion)} ${safe(empresa?.ciudad)} ${safe(empresa?.pais)}`.trim());
  lines.push("");
  lines.push("## Contexto del negocio");
  lines.push(`Objetivos: ${safe(lead.objetivos)}`);
  lines.push(`Audiencia / ¿Ya es cliente?: ${safe(lead.audiencia)}`);
  lines.push(`Tamaño: ${safe(lead.tamano)}`);
  lines.push(`Oferta / Notas: ${safe(lead.oferta)}`);
  lines.push(`Notas: ${safe(lead.notas)}`);
  if (contactos.length > 0) {
    lines.push("");
    lines.push("## Contactos");
    contactos.forEach((c, i) => {
      lines.push(`${i + 1}. ${safe(c.nombre)}${c.cargo ? ` (${c.cargo})` : ""} – ${safe(c.telefono)} – ${safe(c.email)}`);
    });
  }
  lines.push("");
  lines.push("---");
  lines.push("## Informe IA (base para la propuesta)");
  lines.push("");
  lines.push(aiReport.slice(0, 10000));
  lines.push("");
  lines.push("---");
  lines.push(`Tono: ${reportProfile.tone}`);
  if (reportProfile.cta) lines.push(`CTA: ${reportProfile.cta}`);
  return lines.join("\n");
}

/**
 * Construye el prompt para Gamma – plantilla técnica.
 * Incluye: auditoría técnica, hallazgos, oportunidades de optimización, roadmap técnico.
 */
export function buildGammaTechnicalPrompt(ctx: GammaPromptContext): string {
  const { lead, empresa, contactos, aiReport, reportProfile } = ctx;
  const lines: string[] = [];
  lines.push("# Presentación Técnica – Auditoría y Roadmap");
  lines.push("");
  lines.push("Genera una presentación de consultoría con tono premium, ejecutivo y listo para presentar.");
  lines.push("");
  lines.push("## Estructura requerida");
  lines.push("1. Diagnóstico técnico (resumen ejecutivo)");
  lines.push("2. Hallazgos principales (métricas, gaps, oportunidades)");
  lines.push("3. Oportunidades de optimización (priorizadas)");
  lines.push("4. Roadmap técnico (corto y mediano plazo)");
  lines.push("5. Próximos pasos y CTA");
  lines.push("");
  lines.push("---");
  lines.push("## Datos de la empresa");
  lines.push(`Empresa: ${safe(empresa?.nombre) || safe(lead.nombre)}`);
  lines.push(`Rubro: ${safe(empresa?.rubroNombre)}`);
  lines.push(`Web: ${safe(empresa?.web)} | Email: ${safe(empresa?.email)}`);
  lines.push("");
  lines.push("## Contexto");
  lines.push(`Objetivos: ${safe(lead.objetivos)}`);
  lines.push(`Notas: ${safe(lead.notas)}`);
  if (contactos.length > 0) {
    lines.push("");
    lines.push("## Contactos");
    contactos.forEach((c, i) => {
      lines.push(`${i + 1}. ${safe(c.nombre)} – ${safe(c.email)}`);
    });
  }
  lines.push("");
  lines.push("---");
  lines.push("## Informe IA (base para la auditoría)");
  lines.push("");
  lines.push(aiReport.slice(0, 10000));
  lines.push("");
  lines.push("---");
  lines.push(`Tono: ${reportProfile.tone}`);
  return lines.join("\n");
}

/** Payload de propuesta para Gamma Pro (presentación cliente-ready). */
export type ProposalPayloadForGamma = {
  lead: { nombre: string | null; empresa: string | null; rubro: string | null; website: string | null };
  proposal: { title: string; subtitle: string; executiveSummary: string | null; confirmedAt: string | null };
  monthlyTable: {
    months: Array<{ key: string; label: string }>;
    rows: Array<{ codigo: string | null; nombre: string | null; monthlyValues: Record<string, number> }>;
    totalsByMonth: Record<string, number>;
    grandTotal: number;
  } | null;
  services: Array<{
    codigo: string | null;
    nombre: string | null;
    monthlyValues: Record<string, number>;
    salesArgument: string | null;
    strategicReason: string | null;
  }>;
  narrative: { summary: string | null; objectives: string | null; whyNow: string | null; nextStep: string | null };
  contact: { agencyName: string; website: string; whatsapp: string };
};

/** Contenido fijo para slide Cierre / Reunámonos (alineado con PDF comercial). */
const GAMMA_MEETING = {
  bookingUrl: "https://easydigitalagency.com/uruguay-2/",
  location: "World Trade Center Torre 4, piso 40, Montevideo, Uruguay",
  locationGoogleMapsUrl: "https://www.google.com/maps/search/?api=1&query=World+Trade+Center+Torre+4,+piso+40,+Montevideo,+Uruguay",
  supportText: "Podemos revisar esta propuesta juntos en una reunión breve. Sin compromiso, con foco en tus objetivos.",
  /** Frase institucional de posicionamiento EASY (slide final). */
  easyPositioning: "EASY Digital Agency ayuda a empresas a estructurar su crecimiento comercial combinando estrategia, tecnología y procesos de venta medibles.",
} as const;

/** Microcopy bajo la tabla de inversión mensual. */
const GAMMA_TABLE_FOOTNOTE =
  "La implementación del CRM se realiza en el primer mes. A partir del segundo mes la inversión corresponde al acompañamiento estratégico continuo.";

/** Slide "Impacto esperado en 6 meses" — 5 highlights ejecutivos. */
const GAMMA_IMPACT_6_MONTHS = [
  "Proceso comercial más ordenado",
  "Seguimiento estructurado de oportunidades",
  "Mayor visibilidad sobre el pipeline",
  "Decisiones comerciales basadas en métricas",
  "Crecimiento más predecible y medible",
] as const;

/** Condiciones comerciales para slide dedicada. */
const GAMMA_CONDITIONS = [
  "Implementación CRM: pago único al inicio del proyecto.",
  "Consultoría Growth: facturación mensual durante el período de acompañamiento.",
  "Duración: 6 meses de trabajo conjunto.",
  "Inicio: dentro de los 5 días posteriores a la confirmación.",
  "Modalidad: reuniones estratégicas mensuales y acompañamiento continuo.",
  "Los valores indicados corresponden a la estructura propuesta en esta etapa y podrán ajustarse únicamente si se modifica el alcance acordado.",
  "Todos los valores están expresados en USD.",
] as const;

/** Servicios: formato compacto para el prompt (título, intro 1 línea, bullets, resultado). */
const GAMMA_SERVICES_CONTENT = {
  crm: {
    titulo: "Implementación CRM",
    intro: "Infraestructura comercial basada en CRM para captación, seguimiento y conversión.",
    bullets: "Configuración CRM, pipelines, campos, usuarios, capacitación, guía de uso.",
    resultadoEsperado: "Resultado: proceso comercial ordenado, trazable y fácil de gestionar desde el primer día.",
  },
  consultoria: {
    titulo: "Consultoría Growth",
    intro: "Consultoría estratégica para estructurar crecimiento y optimizar captación y conversión.",
    bullets: "Auditoría y presencia digital, oportunidades, roadmap, pipeline, métricas, reuniones mensuales.",
    resultadoEsperado: "Resultado: dirección comercial clara, prioridades, métricas y crecimiento sostenido.",
  },
} as const;

const MAX_NARRATIVE_LEN = 220;

function truncate(s: string | null | undefined, max: number): string {
  if (s == null || !String(s).trim()) return "";
  const t = String(s).trim();
  return t.length <= max ? t : t.slice(0, max) + "...";
}

/**
 * Construye el prompt para Gamma Pro — compacto, 3 bloques: instrucciones globales, estructura de slides, datos.
 */
export function buildGammaProPromptFromPayload(payload: ProposalPayloadForGamma): string {
  const { lead, proposal, monthlyTable, services, narrative, contact } = payload;
  const clientName = lead.empresa || lead.nombre || "el cliente";
  const lines: string[] = [];

  // ——— BLOQUE 1: Instrucciones globales ———
  lines.push("# Propuesta comercial EASY — 11 slides");
  lines.push("Objetivo: presentación cliente-ready, tono premium y consultivo. No informe técnico ni FODA. Claridad, jerarquía y cierre comercial. Diseño premium y limpio.");
  lines.push("");

  // ——— BLOQUE 2: Estructura de slides (11) ———
  lines.push("## Slides (orden exacto)");
  lines.push("1. Portada | 2. Resumen ejecutivo | 3. Oportunidad detectada (personalizar con nombre/sitio/contexto del cliente) | 4. Objetivo | 5. Servicios incluidos | 6. Inversión mensual (tabla + nota debajo) | 7. Condiciones comerciales | 8. ¿Por qué actuar ahora? | 9. Próximos pasos | 10. Impacto esperado en 6 meses | 11. Reunámonos / contacto");
  lines.push("");

  // ——— BLOQUE 3: Datos ———
  lines.push("## Datos");
  lines.push(`Cliente: ${safe(lead.empresa) || safe(lead.nombre)} | Rubro: ${safe(lead.rubro)} | Web: ${safe(lead.website)}`);
  lines.push(`Título: ${proposal.title} | Subtítulo: ${proposal.subtitle}`);
  if (proposal.executiveSummary) lines.push(`Resumen: ${truncate(proposal.executiveSummary, MAX_NARRATIVE_LEN)}`);
  lines.push("");

  lines.push("### Oportunidad detectada (slide 3)");
  lines.push("Redactar de forma específica: usar nombre del cliente, web o empresa cuando existan. Ej: 'La presencia digital actual de [cliente/web] todavía no capitaliza todo el potencial del mercado…' No plantilla genérica; conectar con el negocio concreto. Datos disponibles arriba.");
  if (narrative.summary) lines.push("Base: " + truncate(narrative.summary, MAX_NARRATIVE_LEN));
  lines.push("");

  lines.push("### Servicios (título, intro breve, bullets, resultado por servicio)");
  lines.push(`${GAMMA_SERVICES_CONTENT.crm.titulo}. ${GAMMA_SERVICES_CONTENT.crm.intro} Bullets: ${GAMMA_SERVICES_CONTENT.crm.bullets} ${GAMMA_SERVICES_CONTENT.crm.resultadoEsperado}`);
  lines.push(`${GAMMA_SERVICES_CONTENT.consultoria.titulo}. ${GAMMA_SERVICES_CONTENT.consultoria.intro} Bullets: ${GAMMA_SERVICES_CONTENT.consultoria.bullets} ${GAMMA_SERVICES_CONTENT.consultoria.resultadoEsperado}`);
  if (services.length > 0) lines.push("En propuesta: " + services.map((s) => s.nombre || s.codigo).filter(Boolean).join(", "));
  lines.push("");

  if (monthlyTable && monthlyTable.months.length > 0) {
    lines.push("### Inversión mensual (slide 6 — usar tabla exactamente)");
    lines.push("Meses: " + monthlyTable.months.map((m) => m.label).join(", "));
    monthlyTable.rows.forEach((r) => {
      const name = r.nombre || r.codigo || "—";
      const vals = monthlyTable.months.map((m) => (r.monthlyValues[m.key] ?? 0).toLocaleString("es-UY")).join(" | ");
      lines.push(`${name}: ${vals}`);
    });
    lines.push("Totales: " + monthlyTable.months.map((m) => (monthlyTable.totalsByMonth[m.key] ?? 0).toLocaleString("es-UY")).join(" | ") + " | General: " + monthlyTable.grandTotal.toLocaleString("es-UY"));
    lines.push("Debajo de la tabla incluir: " + GAMMA_TABLE_FOOTNOTE);
    lines.push("");
  }

  lines.push("### Condiciones comerciales");
  GAMMA_CONDITIONS.forEach((c) => lines.push(`- ${c}`));
  lines.push("");

  if (narrative.objectives || narrative.whyNow || narrative.nextStep) {
    lines.push("### Narrativa (objetivos, por qué ahora, próximos pasos)");
    if (narrative.objectives) lines.push("Objetivos: " + truncate(narrative.objectives, MAX_NARRATIVE_LEN));
    if (narrative.whyNow) lines.push("Por qué ahora: " + truncate(narrative.whyNow, MAX_NARRATIVE_LEN));
    if (narrative.nextStep) lines.push("Próximos pasos: " + truncate(narrative.nextStep, MAX_NARRATIVE_LEN));
    lines.push("");
  }

  lines.push("### Slide 9 — cierre");
  lines.push("Incluir al final: Con la confirmación de esta propuesta, podremos iniciar la coordinación del onboarding y poner en marcha el trabajo dentro de los próximos 5 días.");
  lines.push("");

  lines.push("### Slide 10 — Impacto esperado en 6 meses");
  lines.push("Título: Impacto esperado en 6 meses. Mostrar resultados estructurales y comerciales esperados. Tono ejecutivo, sin promesas irreales. 4–5 highlights:");
  GAMMA_IMPACT_6_MONTHS.forEach((item) => lines.push("- " + item));
  lines.push("");

  lines.push("### Slide 11 — Reunámonos / contacto");
  lines.push("Frase institucional EASY: " + GAMMA_MEETING.easyPositioning);
  lines.push("Cierre comercial (incluir): Estamos listos para acompañar a " + clientName + " en la profesionalización de su proceso comercial y en la construcción de un crecimiento sostenido.");
  lines.push("Reunámonos. Texto: " + GAMMA_MEETING.supportText);
  lines.push("Web: " + (contact.website || "www.easydigitalagency.com") + " | WhatsApp: " + (contact.whatsapp || "+598 94 735 020"));
  lines.push("Lugar (link Google Maps): " + GAMMA_MEETING.location + " → " + GAMMA_MEETING.locationGoogleMapsUrl);
  lines.push("CTA principal: Agendar Reunión con EASY → " + GAMMA_MEETING.bookingUrl + " | CTA secundario: Conocer más sobre EASY");

  const out = lines.join("\n");
  if (process.env.NODE_ENV !== "production") {
    console.log("[GAMMA PROMPT DEBUG] length", out.length, "| slides: 11 | services:", services.length, "| execSummaryLength:", proposal.executiveSummary?.length ?? 0);
  }
  return out;
}
