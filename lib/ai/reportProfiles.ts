export type ReportProfileId = "comercial" | "tecnico";

export type ReportProfile = {
  id: ReportProfileId;
  label: string;
  moduleIds: string[];
  title: string;
  subtitle: string;
};

/**
 * IDs deben coincidir con validModuleIds del backend y tabId de TABS_CONFIG en AiLeadReport.
 */
export const REPORT_PROFILES: Record<ReportProfileId, ReportProfile> = {
  comercial: {
    id: "comercial",
    label: "Informe Comercial",
    title: "Informe Comercial del Lead",
    subtitle: "Diagnóstico estratégico, oportunidades y cierre comercial",
    moduleIds: [
      "INVESTIGACION_DIGITAL",
      "REDES_SOCIALES",
      "PRESTIGIO_IA",
      "POSICIONAMIENTO",
      "COMPETENCIA",
      "FODA",
      "OPORTUNIDADES",
      "ACCIONES",
      "MATERIALES_LISTOS",
      "CIERRE_VENTA",
      "vision_estrategica",
      "plan_crecimiento",
      "propuesta_easy",
      "oportunidades_negocio_easy",
      "linkedin_decision_makers",
    ],
  },

  tecnico: {
    id: "tecnico",
    label: "Informe Técnico",
    title: "Informe Técnico del Lead",
    subtitle: "Auditoría técnica, métricas clave y oportunidades de optimización",
    moduleIds: [
      "INVESTIGACION_DIGITAL",
      "REDES_SOCIALES",
      "PAUTA_PUBLICITARIA",
      "POSICIONAMIENTO",
      "north_star_metric",
      "producto_servicio_estrella",
      "auditoria_tecnica_basica",
      "vision_estrategica",
    ],
  },
};

export function getReportProfile(profileId?: string): ReportProfile {
  if (profileId === "tecnico") return REPORT_PROFILES.tecnico;
  return REPORT_PROFILES.comercial;
}
