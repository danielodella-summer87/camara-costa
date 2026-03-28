/**
 * Flujo macro de LeadsOk: calcula estado real de cada etapa a partir del lead y documentos.
 * Solo lectura de datos ya disponibles; no modifica backend.
 */

import {
  isOfficialCrmPersistedDocumentUrl,
  isOfficialPresentationDocumentUrl,
} from "@/lib/leads/gammaDocumentPolicy";
import { isCommercialStrategyApproved } from "./commercialStrategyFlow";
import { MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH, isStartupInitiativeKind } from "./initiativeKind";

export type MacroStageStatus = "completed" | "active" | "pending";

export type ChecklistItem = {
  label: string;
  done: boolean;
};

export type MacroStage = {
  id: number;
  title: string;
  checklist: ChecklistItem[];
  result: string;
  status: MacroStageStatus;
};

export type LeadsOkDocuments = {
  diagnostic?: string | null;
  strategy?: string | null;
  proposal?: string | null;
  presentation?: string | null;
};

export type LeadForLeadsOkMacro = {
  id?: string | null;
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  // Campos opcionales (no bloquean la etapa 1).
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  notas?: string | null;
  origen?: string | null;
  pipeline?: string | null;
  comercial_id?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  proposal_reviewed?: boolean | null;
  commercial_stage?: string | null;
  /** JSON LEADS87: { generated, edited, userInputs } */
  commercial_strategy_json?: unknown;
  strategy_approved_at?: string | null;
  ai_report?: string | null;
  // Rubro proviene de `empresas:empresa_id(... rubros:rubro_id(id,nombre))`.
  empresas?: { nombre?: string | null; rubros?: { id?: string | null } | null } | null;
  rubro_id?: string | null;
  // Redes opcionales (no obligatorias, pero suman para "Web / redes").
  instagram?: string | null;
  facebook?: string | null;
  /** standard | startup — copiado desde iniciativa al convertir. */
  initiative_kind?: string | null;
  /** En startup sustituye la necesidad de web/redes para desbloquear etapa 1. */
  project_description?: string | null;
};

function hasStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasContactoUtil(lead: LeadForLeadsOkMacro): boolean {
  return (
    hasStr(lead.contacto) ||
    hasStr(lead.telefono) ||
    hasStr(lead.email) ||
    false
  );
}

function hasWebOred(lead: LeadForLeadsOkMacro): boolean {
  return (
    hasStr(lead.website) ||
    // Redes opcionales: si existen, ayudan a pasar el paso inicial.
    hasStr(lead.instagram) ||
    hasStr(lead.facebook) ||
    false
  );
}

/** Startup con descripción de proyecto suficiente: no exigir web/redes para datos base. */
function hasStartupProjectBrief(lead: LeadForLeadsOkMacro): boolean {
  if (!isStartupInitiativeKind(lead.initiative_kind)) return false;
  const d = typeof lead.project_description === "string" ? lead.project_description.trim() : "";
  return d.length >= MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH;
}

function hasRubro(lead: LeadForLeadsOkMacro): boolean {
  const rubroFromLead = hasStr(lead.rubro_id);
  const rubroFromEmpresas = Boolean((lead.empresas as any)?.rubros?.id && hasStr((lead.empresas as any).rubros.id));
  const rubroFromEmpresasAlt =
    Boolean(Array.isArray((lead.empresas as any)?.rubros) && (lead.empresas as any)?.rubros?.[0]?.id) &&
    hasStr((lead.empresas as any)?.rubros?.[0]?.id);
  return Boolean(rubroFromLead || rubroFromEmpresas || rubroFromEmpresasAlt);
}

/**
 * Orden de pipeline alineado con flujos comerciales (Oportunidades / LEADS87).
 * Etapas macro 6–8 dependen de avanzar pipeline, no solo de existir URLs de documentos.
 */
const PIPELINE_ORDER = [
  "Nuevo",
  "Contactado",
  "Diagnóstico",
  "Estrategia",
  "Servicios",
  "Propuesta",
  "Presentación",
  "Seguimiento",
  "Ganado",
  "Perdido",
  "Cierre",
] as const;

function pipelineRank(p: string | null | undefined): number {
  const t = (p ?? "").trim();
  const i = (PIPELINE_ORDER as readonly string[]).indexOf(t);
  return i >= 0 ? i : -1;
}

function pipelineAtLeast(p: string | null | undefined, min: (typeof PIPELINE_ORDER)[number]): boolean {
  const r = pipelineRank(p);
  const m = PIPELINE_ORDER.indexOf(min);
  return r >= m && m >= 0;
}

/** Etapas 1–8 (sin Etapa 0). Etapa 1 fusiona lead creado + datos base. */
const STAGE_DEFINITIONS: Omit<MacroStage, "status" | "checklist">[] = [
  { id: 1, title: "Etapa 1 — Lead creado / datos base", result: "El lead existe con datos suficientes para investigar." },
  { id: 2, title: "Etapa 2 — Investigación", result: "Ya existe una base de lectura del negocio y su presencia digital." },
  { id: 3, title: "Etapa 3 — Diagnóstico comercial", result: "Queda claro el problema comercial y la oportunidad detectada." },
  { id: 4, title: "Etapa 4 — Estrategia", result: "Se define la dirección estratégica de crecimiento." },
  { id: 5, title: "Etapa 5 — Estructura de servicios", result: "Se arma la base económica y operativa de la propuesta." },
  { id: 6, title: "Etapa 6 — Propuesta comercial", result: "Existe una propuesta integral lista para compartir." },
  { id: 7, title: "Etapa 7 — Presentación", result: "El material final queda listo para presentar al cliente." },
  { id: 8, title: "Etapa 8 — Seguimiento y cierre", result: "El lead entra en gestión de cierre y seguimiento." },
];

export function getLeadsOkMacroFlow(
  lead: LeadForLeadsOkMacro | null,
  documents: LeadsOkDocuments | null
): MacroStage[] {
  if (!lead) {
    return STAGE_DEFINITIONS.map((def) => ({
      ...def,
      checklist: [],
      status: "pending" as const,
    }));
  }

  const hasNombreOrEmpresa = hasStr(lead.nombre) || (lead.empresas?.nombre && hasStr(lead.empresas.nombre));
  // Etapa 1 debe ser desbloqueable con mínimos razonables.
  // Regla: NO bloquear por `objetivos/audiencia/tamaño` (son opcionales para investigar).
  const hasContacto = hasContactoUtil(lead);
  const hasWebOredValue = hasWebOred(lead) || hasStartupProjectBrief(lead);
  const rubroOk = hasRubro(lead);
  const datosSuficientes = hasNombreOrEmpresa && hasContacto && hasWebOredValue && rubroOk;

  /** Secuencial: una etapa no puede estar completa si la anterior no lo está (una sola fuente de verdad coherente con el stepper). */
  const etapa1Done = datosSuficientes; // Lead creado + datos base
  const etapa2Done = etapa1Done && hasStr(lead.ai_report);
  const etapa3Done =
    etapa2Done &&
    Boolean(documents?.diagnostic && isOfficialCrmPersistedDocumentUrl(documents.diagnostic));
  /** Etapa 4 — Estrategia: confirmación explícita o legado con documento archivado (sin borrador JSON nuevo). */
  const etapa4Done = etapa3Done && isCommercialStrategyApproved(lead, documents);
  const etapa5Done = etapa4Done && Boolean(lead.proposal_confirmed_at);
  const proposalUrlPersisted =
    Boolean(documents?.proposal && isOfficialCrmPersistedDocumentUrl(documents.proposal)) ||
    Boolean(
      typeof lead.proposal_doc_url === "string" &&
        lead.proposal_doc_url.trim() &&
        isOfficialCrmPersistedDocumentUrl(lead.proposal_doc_url)
    );
  /** Propuesta documentada y pipeline pasado a Presentación (revisión persistida + etapa en CRM). */
  const etapa6Done =
    etapa5Done &&
    proposalUrlPersisted &&
    lead.proposal_reviewed === true &&
    pipelineAtLeast(lead.pipeline, "Presentación");
  const presentationUrlPersisted =
    Boolean(documents?.presentation && isOfficialPresentationDocumentUrl(documents.presentation)) ||
    Boolean(
      typeof lead.presentation_doc_url === "string" &&
        lead.presentation_doc_url.trim() &&
        isOfficialPresentationDocumentUrl(lead.presentation_doc_url)
    );
  const commercialClosing =
    String(lead.commercial_stage ?? "")
      .trim()
      .toLowerCase() === "closing";
  /** Material de presentación o avance a cierre comercial persistido. */
  const etapa7Done =
    etapa6Done &&
    (pipelineAtLeast(lead.pipeline, "Seguimiento") ||
      Boolean(lead.proposal_sent_at) ||
      commercialClosing ||
      presentationUrlPersisted);
  const etapa8Done = etapa7Done && Boolean(lead.proposal_sent_at);

  const completed = [
    etapa1Done,
    etapa2Done,
    etapa3Done,
    etapa4Done,
    etapa5Done,
    etapa6Done,
    etapa7Done,
    etapa8Done,
  ];

  let activeIndex = completed.findIndex((c) => !c);
  if (activeIndex === -1) activeIndex = 8;

  const checklist1: ChecklistItem[] = [
    { label: "Alta del lead", done: true },
    { label: "Nombre / empresa", done: Boolean(hasNombreOrEmpresa) },
    { label: "Contacto útil (email/teléfono/contacto)", done: Boolean(hasContacto) },
    { label: "Web o red relevante", done: Boolean(hasWebOredValue) },
    { label: "Rubro", done: Boolean(rubroOk) },
    { label: "Datos suficientes para analizarlo", done: Boolean(datosSuficientes) },
  ];

  return STAGE_DEFINITIONS.map((def, i) => {
    const status: MacroStageStatus =
      i < activeIndex ? "completed" : i === activeIndex ? "active" : "pending";
    const checklist = def.id === 1 ? checklist1 : ([] as ChecklistItem[]);
    return {
      ...def,
      checklist,
      status,
    };
  });
}
