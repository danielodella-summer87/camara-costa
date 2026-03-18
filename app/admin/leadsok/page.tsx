"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { List, LayoutGrid, FileText, ChevronRight, CheckCircle2 } from "lucide-react";
import { getLeadsOkMacroFlow, type LeadForLeadsOkMacro, type LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";
import { getLeadsOkMicroFlow } from "@/lib/crm/leadsOkMicroFlow";
import {
  getPresentationPrimaryUrl,
  isLikelyEmbedBlocked,
  PRESENTATION_POPUP_FEATURES,
  PRESENTATION_POPUP_NAME,
} from "@/lib/leads/presentationUtils";
import { AiLeadReport } from "@/components/leads/AiLeadReport";

type LeadListItem = { id: string; nombre: string | null };

/** URL del workspace por paso micro (para iframe en pasos 4, 5, 6). */
function getWorkspaceFrameSrc(leadId: string, microStepId: number): string {
  if (microStepId === 6) return `/admin/leads/${leadId}/presentacion`;
  if (microStepId === 4) return `/admin/leads/${leadId}?tab=consultor&section=services-proposal`;
  if (microStepId === 5) return `/admin/leads/${leadId}?tab=consultor&section=proposal-export`;
  return `/admin/leads/${leadId}?tab=comercial&section=ia-report-block`;
}

export default function LeadsOkPage() {
  const pathname = usePathname();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [leadsList, setLeadsList] = useState<LeadListItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | "">("");
  const [fullLead, setFullLead] = useState<LeadForLeadsOkMacro | null>(null);
  const [documents, setDocuments] = useState<LeadsOkDocuments | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingLead, setLoadingLead] = useState(false);
  const [activeWorkspaceStep, setActiveWorkspaceStep] = useState<number>(1);
  const [reportGeneratedLocally, setReportGeneratedLocally] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<number>(1);

  const goToWorkspace = useCallback((stepId: number) => {
    setActiveWorkspaceStep(stepId);
    setTimeout(() => workspaceRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }, []);

  const handleStepAction = useCallback(
    (stepId: number) => {
      if (stepId === 6 && documents) {
        const primaryUrl = getPresentationPrimaryUrl(documents);
        if (primaryUrl && isLikelyEmbedBlocked(primaryUrl)) {
          window.open(primaryUrl, PRESENTATION_POPUP_NAME, PRESENTATION_POPUP_FEATURES);
        }
      }
      goToWorkspace(stepId);
    },
    [documents, goToWorkspace]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingLeads(true);
    fetch("/api/admin/leads", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then((res) => res.json())
      .then((json: { data?: LeadListItem[] | null; error?: string | null }) => {
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        setLeadsList(data);
        if (data.length > 0 && !selectedLeadId) setSelectedLeadId(data[0].id);
      })
      .finally(() => {
        if (!cancelled) setLoadingLeads(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedLeadId?.trim()) {
      setFullLead(null);
      setDocuments(null);
      return;
    }
    let cancelled = false;
    setLoadingLead(true);
    Promise.all([
      fetch(`/api/admin/leads/${selectedLeadId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads/${selectedLeadId}/documents`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([leadRes, docsRes]) => {
        if (cancelled) return;
        const leadData = leadRes?.data ?? null;
        const docs = docsRes?.ok && docsRes?.documents ? docsRes.documents : null;
        setFullLead(leadData as LeadForLeadsOkMacro | null);
        setDocuments(docs as LeadsOkDocuments | null);
      })
      .catch(() => {
        if (!cancelled) {
          setFullLead(null);
          setDocuments(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLead(false);
      });
    return () => { cancelled = true; };
  }, [selectedLeadId]);

  useEffect(() => {
    if (!selectedLeadId) setReportGeneratedLocally(false);
  }, [selectedLeadId]);

  const effectiveLead = useMemo(() => {
    if (!fullLead) return fullLead;
    if (reportGeneratedLocally && !fullLead.ai_report?.trim()) {
      return { ...fullLead, ai_report: " " } as LeadForLeadsOkMacro;
    }
    return fullLead;
  }, [fullLead, reportGeneratedLocally]);

  const macroStages = useMemo(
    () => getLeadsOkMacroFlow(effectiveLead, documents),
    [effectiveLead, documents]
  );

  const microSteps = useMemo(
    () => getLeadsOkMicroFlow(effectiveLead, documents),
    [effectiveLead, documents]
  );

  const activeMicro = useMemo(() => microSteps.find((s) => s.status === "active"), [microSteps]);

  useEffect(() => {
    if (activeMicro) {
      setActiveWorkspaceStep(activeMicro.id);
      setExpandedStepId(activeMicro.id);
    }
  }, [selectedLeadId, activeMicro?.id]);

  const refetchLead = useCallback(() => {
    if (!selectedLeadId?.trim()) return;
    Promise.all([
      fetch(`/api/admin/leads/${selectedLeadId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads/${selectedLeadId}/documents`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([leadRes, docsRes]) => {
      setFullLead((leadRes?.data ?? null) as LeadForLeadsOkMacro | null);
      setDocuments(docsRes?.ok && docsRes?.documents ? docsRes.documents : null);
      if ((leadRes?.data as LeadForLeadsOkMacro)?.ai_report?.trim()) setReportGeneratedLocally(false);
    });
  }, [selectedLeadId]);

  const handleReportGenerated = useCallback(() => {
    setReportGeneratedLocally(true);
    refetchLead();
  }, [refetchLead]);

  return (
    <PageContainer>
      {/* A) Header superior */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">LeadsOk</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versión guiada de la gestión comercial por etapas y pasos.
        </p>

        {/* Lead de prueba */}
        <div className="mt-4">
          <label htmlFor="leadsok-lead-select" className="block text-xs font-medium text-slate-600">
            Lead de prueba
          </label>
          <select
            id="leadsok-lead-select"
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            disabled={loadingLeads || leadsList.length === 0}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            {loadingLeads ? (
              <option value="">Cargando leads…</option>
            ) : leadsList.length === 0 ? (
              <option value="">Sin leads</option>
            ) : (
              leadsList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre?.trim() || l.id}
                </option>
              ))
            )}
          </select>
          {loadingLead && selectedLeadId && (
            <p className="mt-1 text-xs text-slate-500">Cargando datos del lead…</p>
          )}
        </div>

        {/* B) Selector Lista | Kanban | Ficha */}
        <div className="mt-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
          {[
            { id: "lista" as const, label: "Lista", Icon: List, href: "/admin/leads" },
            { id: "kanban" as const, label: "Kanban", Icon: LayoutGrid, href: "/admin/leads/kanban" },
            { id: "ficha" as const, label: "Ficha", Icon: FileText, href: "/admin/leadsok" },
          ].map(({ id, label, Icon, href }) => {
            const isActive =
              (id === "ficha" && pathname?.startsWith("/admin/leadsok")) ||
              (id === "lista" && pathname === "/admin/leads") ||
              (id === "kanban" && pathname === "/admin/leads/kanban");
            return (
              <Link
                key={id}
                href={href}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-100/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bloque de orientación: estado actual y siguiente acción */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!fullLead ? (
          loadingLead && selectedLeadId ? (
            <p className="text-sm text-slate-500">Cargando datos del lead…</p>
          ) : (
            <p className="text-sm text-slate-600">Selecciona un lead para ver el flujo guiado.</p>
          )
        ) : (
          (() => {
            const activeMacro = macroStages.find((s) => s.status === "active");
            const activeMicro = microSteps.find((s) => s.status === "active");
            const leadName = fullLead?.nombre?.trim() || fullLead?.empresas?.nombre?.trim() || selectedLeadId || "—";
            const missingInCurrentStep = (activeMacro?.checklist ?? []).filter((i) => !i.done).map((i) => i.label);
            const hasBlocking = missingInCurrentStep.length > 0 && activeMicro;
            const actionByStepId: Record<number, string> = {
              1: "Generar análisis comercial",
              2: "Generar diagnóstico comercial",
              3: "Generar visión estratégica",
              4: "Ir a estructura de servicios",
              5: "Generar propuesta comercial",
              6: "Ver presentación final",
            };
            const nextAction = activeMicro ? actionByStepId[activeMicro.id] ?? "—" : "Proceso completo";
            const isComplete = !activeMicro && macroStages.length > 0 && macroStages.every((s) => s.status === "completed");
            return (
              <>
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-800">Lead seleccionado:</span> {leadName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Etapa macro actual:</span> {activeMacro?.title ?? "—"}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Paso micro actual:</span> {activeMicro?.title ?? "—"}
                </p>
                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                  {hasBlocking ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900">No puedes avanzar todavía</p>
                      <p className="mt-0.5 text-sm text-slate-600">Faltan datos en el paso actual</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                        {missingInCurrentStep.map((label, i) => (
                          <li key={i}>{label}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-slate-500">
                        Completa esta información para habilitar el siguiente paso.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedLeadId || !activeMicro) return;
                          goToWorkspace(activeMicro.id);
                        }}
                        className="mt-3 w-full rounded-lg bg-slate-800 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                      >
                        Completar datos del paso actual
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-800">Siguiente acción recomendada</p>
                      <p className="mt-0.5 text-sm text-slate-600">{nextAction}</p>
                      <button
                        type="button"
                        disabled={!selectedLeadId || isComplete}
                        onClick={() => {
                          if (!selectedLeadId || isComplete || !activeMicro) return;
                          handleStepAction(activeMicro.id);
                        }}
                        className={`mt-3 w-full rounded-lg px-4 py-3 text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                          isComplete || !selectedLeadId
                            ? "cursor-not-allowed bg-slate-200 text-slate-600"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {nextAction}
                      </button>
                      {!isComplete && selectedLeadId && activeMicro && (
                        <p className="mt-2 text-xs text-slate-500">
                          Se mostrará el workspace del paso correspondiente abajo.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Progreso del proceso comercial */}
      {macroStages.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-700">Progreso del proceso comercial</h3>
          {(() => {
            const total = macroStages.length;
            const completedCount = macroStages.filter((s) => s.status === "completed").length;
            const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
            const activeStage = macroStages.find((s) => s.status === "active");
            const allComplete = total > 0 && completedCount === total;
            const currentLabel = allComplete ? "Proceso completo" : activeStage?.title ?? "—";
            return (
              <>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium tabular-nums text-slate-700">{percentage}%</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {completedCount} de {total} etapas completadas
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Etapa actual: <span className="font-medium">{currentLabel}</span>
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* C) Flujo macro del proceso */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Flujo macro del proceso</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Etapas calculadas según datos reales del lead seleccionado.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {macroStages.map((stage) => (
            <div
              key={stage.id}
              className={`rounded-xl border-2 p-4 ${
                stage.status === "completed"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : stage.status === "active"
                    ? "border-emerald-400 bg-white ring-2 ring-emerald-100"
                    : "border-slate-200 bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{stage.title}</span>
                {stage.status === "completed" && <span className="text-xs font-medium text-emerald-700">Completado ✓</span>}
                {stage.status === "active" && <span className="text-xs font-medium text-emerald-700">Activo</span>}
              </div>
              {stage.id === 2 && (
                <>
                  <p className="mt-2 text-xs font-medium text-slate-700">Qué hacemos</p>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                    <li>Validamos el contexto y los datos previos</li>
                    <li>Ejecutamos investigación digital apoyada por prompts de IA</li>
                    <li>Generamos la base para diagnóstico y estrategia</li>
                  </ul>
                  <p className="mt-2 text-xs font-medium text-slate-700">Qué obtengo</p>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                    <li>Lectura inicial del negocio y su presencia digital</li>
                    <li>Hallazgos clave para diagnóstico comercial</li>
                    <li>Base para la visión estratégica</li>
                  </ul>
                </>
              )}
              {stage.checklist.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {stage.checklist.map((item, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 text-xs ${item.done ? "font-semibold text-slate-800" : "text-slate-500"}`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                        ) : null}
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-slate-600 italic">Resultado: {stage.result}</p>
            </div>
          ))}
        </div>
      </div>

      {/* D) Flujo micro de 6 pasos */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Flujo micro de 6 pasos</h2>
        <p className="mt-0.5 text-sm text-slate-500">Pasos detallados con estado real del lead seleccionado.</p>
        <div className="mt-4 space-y-2">
          {microSteps.map((step) => (
            <details
              key={step.id}
              open={step.id === expandedStepId}
              className={`group rounded-xl border-2 ${
                step.status === "completed"
                  ? "border-emerald-200 bg-emerald-50/40"
                  : step.status === "active"
                    ? "border-emerald-400 bg-white ring-2 ring-emerald-100"
                    : "border-slate-200 bg-slate-50/50"
              }`}
            >
              <summary
                className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-slate-50/80"
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedStepId((prev) => (prev === step.id ? prev : step.id));
                }}
              >
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-open:rotate-90" />
                {step.status === "completed" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
                <span
                  className={
                    step.status === "completed"
                      ? "text-slate-800"
                      : step.status === "active"
                        ? "font-semibold text-slate-900"
                        : "text-slate-500"
                  }
                >
                  {step.title}
                </span>
                {step.status === "completed" && <span className="ml-auto text-xs text-emerald-700">Completado</span>}
                {step.status === "active" && <span className="ml-auto text-xs font-medium text-emerald-700">Activo</span>}
              </summary>
              <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                {step.status === "pending" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-center">
                    <p className="text-sm font-medium text-amber-900">Primero completa el paso anterior</p>
                    <p className="mt-0.5 text-xs text-amber-700">Este paso se habilita cuando hayas completado el paso activo actual.</p>
                  </div>
                )}
                {step.status === "active" && step.id === 2 && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800">
                    Paso 1 completado. Se habilitó Diagnóstico comercial.
                  </div>
                )}
                {step.status !== "pending" && step.id === 1 && (
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {(fullLead?.ai_report?.trim() || reportGeneratedLocally) ? (
                      <>
                        <p className="text-sm font-medium text-slate-800">Paso 1 completado. El siguiente paso es Diagnóstico comercial.</p>
                        <div className="mt-2 flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 opacity-80">
                          <svg className="h-4 w-4 shrink-0" aria-hidden fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
                          </svg>
                          Análisis ya generado
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedLeadId) return;
                            setExpandedStepId(2);
                            setActiveWorkspaceStep(2);
                            setTimeout(() => workspaceRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
                          }}
                          disabled={!selectedLeadId}
                          className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Ir a diagnóstico comercial
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => selectedLeadId && goToWorkspace(1)}
                            disabled={!selectedLeadId}
                            title="Abre el análisis generado."
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Ver informe comercial
                          </button>
                          <button
                            type="button"
                            onClick={() => selectedLeadId && goToWorkspace(1)}
                            disabled={!selectedLeadId}
                            title="Regenerar el análisis."
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Regenerar análisis
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-800">Acción recomendada</p>
                        <p className="mt-0.5 text-sm text-slate-600">Para comenzar el análisis del lead.</p>
                        <button
                          type="button"
                          onClick={() => selectedLeadId && goToWorkspace(1)}
                          disabled={!selectedLeadId}
                          title="Analiza el negocio del lead y genera un informe comercial inicial."
                          className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Generar análisis comercial
                        </button>
                      </>
                    )}
                  </div>
                )}
                {step.status !== "pending" && step.subSteps.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {step.subSteps.map((sub, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-2 text-xs ${
                          sub.status === "done"
                            ? "font-semibold text-slate-800"
                            : sub.status === "optional"
                              ? "text-slate-500"
                              : "text-slate-500"
                        }`}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {sub.status === "done" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                          ) : null}
                        </span>
                        {sub.label}
                        {sub.status === "optional" && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            Opcional
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {step.status !== "pending" && (
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Qué obtiene:</span> {step.queObtiene}
                  </p>
                )}
                {step.status !== "pending" && selectedLeadId && step.id >= 2 && step.id <= 6 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => handleStepAction(step.id)}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        step.status === "active"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300"
                      }`}
                    >
                      {step.id === 2 && "Ir al diagnóstico comercial"}
                      {step.id === 3 && "Ir a visión estratégica"}
                      {step.id === 4 && "Ir a estructura de servicios"}
                      {step.id === 5 && "Ir a propuesta comercial"}
                      {step.id === 6 && "Ir a presentación final"}
                    </button>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Workspace del paso activo */}
      <div ref={workspaceRef} className="mt-8 scroll-mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Workspace del paso activo</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Herramientas del paso {activeWorkspaceStep}: {activeWorkspaceStep === 1 && "Análisis del lead"}
          {activeWorkspaceStep === 2 && "Diagnóstico comercial"}
          {activeWorkspaceStep === 3 && "Estrategia de crecimiento"}
          {activeWorkspaceStep === 4 && "Estructura de servicios"}
          {activeWorkspaceStep === 5 && "Propuesta comercial"}
          {activeWorkspaceStep === 6 && "Presentación para el cliente"}
        </p>
        <div className="mt-4 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm min-h-[320px]">
          {!selectedLeadId ? (
            <p className="text-sm text-slate-500 py-8 text-center">Selecciona un lead para ver el workspace.</p>
          ) : loadingLead && !fullLead ? (
            <p className="text-sm text-slate-500 py-8 text-center">Cargando datos del lead…</p>
          ) : activeWorkspaceStep >= 1 && activeWorkspaceStep <= 3 ? (
            <AiLeadReport
              key={`leadsok-ai-${selectedLeadId}-${activeWorkspaceStep}`}
              leadId={selectedLeadId}
              lead={fullLead as any}
              allowedProfiles={["comercial"]}
              initialProfile="comercial"
              onBeforeGenerate={async () => {}}
              onPromptSaved={refetchLead}
              onReportGenerated={handleReportGenerated}
              onPresentationSignalChange={() => {}}
              titleLabel={
                activeWorkspaceStep === 1
                  ? "Paso 1 — Análisis del lead (IA)"
                  : activeWorkspaceStep === 2
                    ? "Paso 2 — Diagnóstico comercial"
                    : "Paso 3 — Estrategia de crecimiento"
              }
              subtitleLabel="Este análisis genera la base que alimenta el diagnóstico y la visión estratégica."
              buttonHelperText="Usa IA para analizar el lead y generar el informe comercial."
              buttonTooltipContent="Ejecuta el análisis con IA."
            />
          ) : (
            <iframe
              title={`Workspace paso ${activeWorkspaceStep}`}
              src={getWorkspaceFrameSrc(selectedLeadId, activeWorkspaceStep)}
              className="w-full min-h-[600px] rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>
      </div>

      {/* E) Acciones auxiliares */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Acciones auxiliares</h2>
        <p className="mt-1 text-sm text-slate-500">Contenedor base para acciones auxiliares (sin lógica en esta fase).</p>
        <div className="mt-4 min-h-[80px] rounded-lg border border-dashed border-slate-200 bg-white/50" />
      </div>
    </PageContainer>
  );
  }
