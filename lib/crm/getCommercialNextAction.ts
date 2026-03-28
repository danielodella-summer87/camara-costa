/**
 * Fuente única de verdad para “siguiente paso” del proceso comercial (ficha clásica + alineación con LEADS87).
 * Combina paso lineal (1–6), estado propuesta→presentación y el paso actual del flujo por estaciones.
 */

import { getCommercialStepState, type CommercialStepState } from "@/lib/crm/getCommercialStepState";
import {
  computeCurrentStep,
  type CommercialStep,
  type ComputeCommercialStepParams,
} from "@/lib/leads/computeCommercialStep";
import {
  getCurrentFlowStep,
  getLeadFlowSteps,
  type LeadFlowLead,
  type LeadFlowStep,
  type PresentationSignals,
} from "@/lib/leads/leadFlow";

export type CommercialNextActionIntent =
  | "internal_analysis"
  | "diagnostic_doc"
  | "strategy_doc"
  | "services_structure"
  | "proposal_create"
  | "proposal_review"
  | "generate_presentation"
  | "advance_close"
  | "closing_followup";

export type GetCommercialNextActionParams = {
  lead: ComputeCommercialStepParams["lead"] & LeadFlowLead | null;
  documents: ComputeCommercialStepParams["documents"];
  structureReady: boolean;
  leadServicesOrCount: { length: number } | number;
  presentationSignals?: PresentationSignals;
};

export type CommercialNextAction = {
  /** Paso 1–6 del pipeline comercial en la ficha. */
  linearStep: CommercialStep;
  /** Alias explícito para consumidores que nombran “currentStep”. */
  currentStep: CommercialStep;
  /** Estación actual del flujo por tabs (lead → … → presentacion). */
  flowStepId: LeadFlowStep["id"];
  commercialStepState: CommercialStepState;
  nextActionKey: CommercialNextActionIntent;
  nextActionLabel: string;
  nextActionDescription: string;
  primaryCtaLabel: string;
  primaryCtaIntent: CommercialNextActionIntent;
  /** Bloque “Proceso comercial” en /admin/leads/[id] */
  blockTitle: string;
  blockDescription: string;
};

function copyForLinearStep(
  linearStep: CommercialStep,
  cs: CommercialStepState
): Omit<
  CommercialNextAction,
  "linearStep" | "currentStep" | "flowStepId" | "commercialStepState"
> {
  switch (linearStep) {
    case 1:
      return {
        nextActionKey: "internal_analysis",
        nextActionLabel: "Análisis del lead",
        nextActionDescription:
          "Generá el análisis interno con IA para detectar oportunidades y preparar la base del diagnóstico comercial.",
        primaryCtaIntent: "internal_analysis",
        primaryCtaLabel: "Generar Análisis Comercial",
        blockTitle: "Análisis del Lead",
        blockDescription:
          "Generá el análisis interno con IA para detectar oportunidades y preparar la base del diagnóstico comercial.",
      };
    case 2:
      return {
        nextActionKey: "diagnostic_doc",
        nextActionLabel: "Diagnóstico comercial",
        nextActionDescription:
          "Generá el documento consultivo del diagnóstico para presentar al lead.",
        primaryCtaIntent: "diagnostic_doc",
        primaryCtaLabel: "Generar Diagnóstico",
        blockTitle: "Diagnóstico Comercial",
        blockDescription:
          "Generá el documento consultivo del diagnóstico para presentar al lead.",
      };
    case 3:
      return {
        nextActionKey: "strategy_doc",
        nextActionLabel: "Estrategia de crecimiento",
        nextActionDescription:
          "Generá la visión estratégica que conecta el diagnóstico con el plan de crecimiento (o confirmala en LEADS87 si ya usás el flujo nuevo).",
        primaryCtaIntent: "strategy_doc",
        primaryCtaLabel: "Generar Visión Estratégica",
        blockTitle: "Estrategia de Crecimiento",
        blockDescription:
          "Generá la visión estratégica que conecta el diagnóstico con el plan de crecimiento.",
      };
    case 4:
      return {
        nextActionKey: "services_structure",
        nextActionLabel: "Estructura de servicios",
        nextActionDescription:
          "Definí la tabla de servicios, alcance y costos en el tab Consultor.",
        primaryCtaIntent: "services_structure",
        primaryCtaLabel: "Ir a estructura de servicios",
        blockTitle: "Estructura de Servicios",
        blockDescription:
          "Definí la tabla de servicios, alcance y costos en el tab Consultor (base económica de la propuesta).",
      };
    case 5:
      if (cs === "proposal_pending_review") {
        return {
          nextActionKey: "proposal_review",
          nextActionLabel: "Revisión de propuesta",
          nextActionDescription:
            "Revisá el borrador de la propuesta y confirmá la revisión en LEADS87 para habilitar la presentación comercial.",
          primaryCtaIntent: "proposal_review",
          primaryCtaLabel: "Revisar propuesta en LEADS87",
          blockTitle: "Propuesta comercial",
          blockDescription:
            "Revisá la propuesta confirmá la revisión cuando el borrador esté listo; luego generá la presentación en el paso 6.",
        };
      }
      return {
        nextActionKey: "proposal_create",
        nextActionLabel: "Propuesta final",
        nextActionDescription:
          "Revisá la propuesta, compartí el documento final con el cliente y marcá el envío cuando corresponda.",
        primaryCtaIntent: "proposal_create",
        primaryCtaLabel: "Generar Propuesta Comercial",
        blockTitle: "Propuesta final para cliente",
        blockDescription:
          "Revisá la propuesta, compartí el documento final con el cliente y marcá el envío cuando corresponda.",
      };
    case 6:
      if (cs === "closing") {
        return {
          nextActionKey: "closing_followup",
          nextActionLabel: "Cierre y seguimiento",
          nextActionDescription:
            "La etapa comercial está en cierre. Registrá seguimiento y próximos pasos en Acciones.",
          primaryCtaIntent: "closing_followup",
          primaryCtaLabel: "Ir a acciones de cierre",
          blockTitle: "Seguimiento y cierre",
          blockDescription:
            "Gestioná el cierre comercial y el seguimiento desde el tab Acciones.",
        };
      }
      if (cs === "presentation_ready") {
        return {
          nextActionKey: "advance_close",
          nextActionLabel: "Cerrar etapa de presentación",
          nextActionDescription:
            "La presentación está archivada en el CRM. En LEADS87 podés avanzar a cierre o seguir revisando el material.",
          primaryCtaIntent: "advance_close",
          primaryCtaLabel: "Continuar en LEADS87 (cierre)",
          blockTitle: "Presentación lista",
          blockDescription:
            "La presentación comercial ya está archivada. Avanzá a cierre o compartí el material con el cliente.",
        };
      }
      return {
        nextActionKey: "generate_presentation",
        nextActionLabel: "Presentación comercial",
        nextActionDescription:
          "Generá y archivá la presentación comercial a partir de la propuesta revisada (LEADS87 paso 6).",
        primaryCtaIntent: "generate_presentation",
        primaryCtaLabel: "Generar presentación comercial",
        blockTitle: "Presentación comercial",
        blockDescription:
          "Generá la presentación comercial archivada para el cliente desde LEADS87 (recomendado) o usá las herramientas del tab Consultor.",
      };
  }
}

export function getCommercialNextAction(params: GetCommercialNextActionParams): CommercialNextAction {
  const { lead, documents, structureReady, leadServicesOrCount, presentationSignals } = params;
  const linearStep = computeCurrentStep({ lead, documents, structureReady });
  const cs = getCommercialStepState(lead, documents);
  const flowSteps = getLeadFlowSteps(lead, leadServicesOrCount, presentationSignals, documents);
  const flowStep = getCurrentFlowStep(flowSteps);
  const flowStepId = (flowStep?.id ?? "investigacion") as LeadFlowStep["id"];
  const base = copyForLinearStep(linearStep, cs);
  return {
    linearStep,
    currentStep: linearStep,
    flowStepId,
    commercialStepState: cs,
    ...base,
  };
}
