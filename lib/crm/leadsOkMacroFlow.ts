/**
 * Flujo macro de LeadsOk: calcula estado real de cada etapa a partir del lead y documentos.
 * Solo lectura de datos ya disponibles; no modifica backend.
 */

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
};

export type LeadForLeadsOkMacro = {
  id?: string | null;
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  notas?: string | null;
  origen?: string | null;
  pipeline?: string | null;
  comercial_id?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  ai_report?: string | null;
  empresas?: { nombre?: string | null } | null;
};

function hasStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAnyContact(lead: LeadForLeadsOkMacro): boolean {
  return (
    hasStr(lead.contacto) ||
    hasStr(lead.telefono) ||
    hasStr(lead.email) ||
    hasStr(lead.website) ||
    false
  );
}

function hasContext(lead: LeadForLeadsOkMacro): boolean {
  return (
    hasStr(lead.objetivos) ||
    hasStr(lead.audiencia) ||
    hasStr(lead.tamano) ||
    hasStr(lead.notas) ||
    false
  );
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
  const hasContact = hasAnyContact(lead);
  const hasObjetivosAudiencia = hasStr(lead.objetivos) || hasStr(lead.audiencia) || hasStr(lead.tamano);
  const datosSuficientes = hasNombreOrEmpresa && hasContact && (hasObjetivosAudiencia || hasContext(lead));

  const etapa1Done = datosSuficientes; // Lead creado + datos base
  const etapa2Done = hasStr(lead.ai_report);
  const etapa3Done = Boolean(documents?.diagnostic);
  const etapa4Done = Boolean(documents?.strategy);
  const etapa5Done = Boolean(lead.proposal_confirmed_at);
  const etapa6Done = Boolean(documents?.proposal);
  const etapa7Done = Boolean(documents?.diagnostic && documents?.strategy && documents?.proposal);
  const etapa8Done = Boolean(lead.proposal_sent_at);

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
    { label: "Web / redes / contacto", done: Boolean(hasContact) },
    { label: "Objetivos", done: Boolean(hasStr(lead.objetivos)) },
    { label: "Audiencia / rubro", done: Boolean(hasStr(lead.audiencia) || hasStr(lead.tamano)) },
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
