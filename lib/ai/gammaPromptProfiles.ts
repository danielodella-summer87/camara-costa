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
