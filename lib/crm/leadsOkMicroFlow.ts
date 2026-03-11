/**
 * Flujo micro de LeadsOk: 6 pasos con estado real según lead y documentos.
 * Solo lectura; no modifica backend.
 */

import type { LeadForLeadsOkMacro, LeadsOkDocuments } from "./leadsOkMacroFlow";

function hasStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export type MicroStepStatus = "completed" | "active" | "pending";

export type MicroSubStepStatus = "done" | "pending" | "optional";

export type MicroSubStep = {
  label: string;
  status: MicroSubStepStatus;
};

export type MicroStep = {
  id: number;
  title: string;
  status: MicroStepStatus;
  subSteps: MicroSubStep[];
  queObtiene: string;
  defaultOpen: boolean;
};

const STEP_1_SUBSTEPS: { label: string; optional?: boolean }[] = [
  { label: "Generar análisis comercial" },
  { label: "Revisar informe IA" },
  { label: "Ver informe comercial" },
  { label: "Exportar / copiar / revisar texto" },
  { label: "Opcional: prompt en uso", optional: true },
  { label: "Opcional: utilidades del paso", optional: true },
];

export function getLeadsOkMicroFlow(
  lead: LeadForLeadsOkMacro | null,
  documents: LeadsOkDocuments | null
): MicroStep[] {
  const hasAiReport = lead ? hasStr(lead.ai_report) : false;
  const hasDiagnostic = Boolean(documents?.diagnostic);
  const hasStrategy = Boolean(documents?.strategy);
  const hasProposalConfirmed = Boolean(lead?.proposal_confirmed_at);
  const hasProposal = Boolean(documents?.proposal);
  const hasProposalSent = Boolean(lead?.proposal_sent_at);

  const step1Complete = hasAiReport;
  const step2Complete = hasDiagnostic;
  const step3Complete = hasStrategy;
  const step4Complete = hasProposalConfirmed;
  const step5Complete = hasProposal;
  const step6Complete = hasProposalSent;

  const completed = [
    step1Complete,
    step2Complete,
    step3Complete,
    step4Complete,
    step5Complete,
    step6Complete,
  ];
  const activeIndex = completed.findIndex((c) => !c);

  function stepStatus(stepIndex: number): MicroStepStatus {
    if (activeIndex === -1) return "completed";
    if (stepIndex < activeIndex) return "completed";
    if (stepIndex === activeIndex) return "active";
    return "pending";
  }

  const subSteps1: MicroSubStep[] = STEP_1_SUBSTEPS.map((s) => ({
    label: s.label,
    status: s.optional ? "optional" : hasAiReport ? "done" : "pending",
  }));

  return [
    {
      id: 1,
      title: "Paso 1 — Análisis del lead",
      status: stepStatus(0),
      subSteps: subSteps1,
      queObtiene: "Un análisis interno que alimenta diagnóstico y estrategia.",
      defaultOpen: activeIndex === 0,
    },
    {
      id: 2,
      title: "Paso 2 — Diagnóstico comercial",
      status: stepStatus(1),
      subSteps: [],
      queObtiene: "Documento consultivo de diagnóstico comercial.",
      defaultOpen: activeIndex === 1,
    },
    {
      id: 3,
      title: "Paso 3 — Estrategia de crecimiento",
      status: stepStatus(2),
      subSteps: [],
      queObtiene: "Documento de visión estratégica.",
      defaultOpen: activeIndex === 2,
    },
    {
      id: 4,
      title: "Paso 4 — Estructura de servicios",
      status: stepStatus(3),
      subSteps: [],
      queObtiene: "Tabla de servicios, alcance y costos.",
      defaultOpen: activeIndex === 3,
    },
    {
      id: 5,
      title: "Paso 5 — Propuesta comercial",
      status: stepStatus(4),
      subSteps: [],
      queObtiene: "Propuesta comercial integral lista para compartir.",
      defaultOpen: activeIndex === 4,
    },
    {
      id: 6,
      title: "Paso 6 — Presentación para el cliente",
      status: stepStatus(5),
      subSteps: [],
      queObtiene: "Versión final lista para presentar o enviar.",
      defaultOpen: activeIndex === 5,
    },
  ];
}
