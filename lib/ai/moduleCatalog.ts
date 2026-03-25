export const IA_MODULE_LABELS: Record<string, string> = {
  INVESTIGACION_DIGITAL: "Investigación Digital",
  REDES_SOCIALES: "Redes Sociales",
  PAUTA_PUBLICITARIA: "Pauta Publicitaria",
  PRESTIGIO_IA: "Prestigio IA",
  POSICIONAMIENTO: "Posicionamiento",
  COMPETENCIA: "Competencia",
  FODA: "FODA",
  OPORTUNIDADES: "Oportunidades",
  ACCIONES: "Acciones",
  MATERIALES_LISTOS: "Materiales Listos",
  CIERRE_VENTA: "Cierre de Venta",
  vision_estrategica: "Visión Estratégica",
  linkedin_decision_makers: "LinkedIn – Tomadores de decisión",
  north_star_metric: "North Star y métricas clave",
  producto_servicio_estrella: "Producto / Servicio estrella",
  auditoria_tecnica_basica: "Auditoría técnica básica",
  plan_crecimiento: "Plan de crecimiento",
  propuesta_easy: "Propuesta de crecimiento EASY",
  oportunidades_negocio_easy: "Oportunidades de negocio EASY",
};

/** Orden de presentación unificado (misma fuente de verdad que Configuración IA). */
export const IA_MODULE_ORDER = Object.keys(IA_MODULE_LABELS);

export type AiModuleTab = {
  id: string;
  label: string;
  tabId: string;
};

export function toUiModuleId(moduleId: string): string {
  const normalized = String(moduleId ?? "").trim();
  if (!normalized) return "";
  return normalized.toLowerCase().replace(/[\s-]+/g, "_");
}

export function buildModuleTabsFromCatalog(): AiModuleTab[] {
  return IA_MODULE_ORDER.map((moduleId) => ({
    id: toUiModuleId(moduleId),
    label: IA_MODULE_LABELS[moduleId] ?? moduleId,
    tabId: moduleId,
  }));
}

