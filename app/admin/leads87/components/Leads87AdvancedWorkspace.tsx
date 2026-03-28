"use client";

import { useMemo, useState } from "react";
import type { LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";
import type { CommercialStepState } from "@/lib/crm/getCommercialStepState";
import {
  isPdfUrl,
  resolvePresentationResource,
} from "@/lib/leads/presentationUtils";
import {
  isGammaExternalOnlyUrl,
  isOfficialPresentationDocumentUrl,
} from "@/lib/leads/gammaDocumentPolicy";
import { Leads87ProposalWorkspace } from "./Leads87ProposalWorkspace";
import { Leads87ServicesWorkspace } from "./Leads87ServicesWorkspace";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

function step6Badge(state: CommercialStepState): { label: string; cls: string } {
  switch (state) {
    case "no_proposal":
    case "proposal_pending_review":
      return { label: "Completá la propuesta comercial antes", cls: "bg-slate-200 text-slate-700" };
    case "ready_for_presentation":
      return { label: "Lista para generar presentación comercial", cls: "bg-amber-100 text-amber-900" };
    case "presentation_ready":
      return { label: "Presentación comercial lista", cls: "bg-emerald-100 text-emerald-800" };
    case "closing":
      return { label: "En cierre comercial", cls: "bg-emerald-100 text-emerald-800" };
  }
}

export type Leads87AdvancedWorkspaceProps = {
  leadId: string;
  step: 4 | 5 | 6;
  documents: LeadsOkDocuments | null;
  leadDisplayName: string;
  aiReport?: string | null;
  proposalConfirmedAt?: string | null;
  proposalSentAt?: string | null;
  presentationGammaUrl: string | null;
  presentationPdfUrl: string | null;
  commercialState: CommercialStepState;
  /** Requerido para habilitar estructura de servicios (Paso 4). */
  strategyApproved?: boolean;
  /** Texto derivado de estrategia confirmada o borrador para sugerencias de servicios. */
  strategyContextText?: string;
  onStructureConfirmed?: () => void;
  onConfirmReadinessChange?: (ready: boolean, busy: boolean) => void;
  onProposalDocumentCreated?: () => void;
  onRegisterProposalCreateAction?: (action: (() => Promise<void>) | null) => void;
  onProposalCreateReadinessChange?: (ready: boolean, busy: boolean) => void;
  proposalReviewed?: boolean;
  proposalReviewPatchBusy?: boolean;
  onMarkProposalReviewed?: () => void | Promise<void>;
  presentationGenerateBusy?: boolean;
  presentationGenerationStatus?: "idle" | "generating" | "completed" | "error";
  presentationGenerationProgress?: number;
  presentationGenerationEtaSeconds?: number | null;
  presentationGenerationError?: string | null;
  presentationCloseBusy?: boolean;
  onGeneratePresentation?: () => void | Promise<void>;
  onOpenPresentation?: () => void;
  onAdvanceToClose?: () => void | Promise<void>;
  onGoToClosingActions?: () => void;
};

type LeadServiceForAssistant = {
  id: string;
  service_id: string;
  codigo: string | null;
  nombre: string | null;
  mes: number;
  precio: number | null;
  moneda: string | null;
  alcance_editado: string | null;
  observaciones: string | null;
};

function docActionRow(label: string, url: string | null | undefined, opts?: { secondary?: boolean }) {
  const u = url?.trim();
  if (!u) return null;
  const pdf = isPdfUrl(u);
  const secondary = opts?.secondary === true;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
        secondary ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <a
        href={u}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        {secondary ? "Abrir en Gamma" : pdf ? "Ver PDF" : "Abrir documento"}
      </a>
    </div>
  );
}

export function Leads87AdvancedWorkspace({
  leadId,
  step,
  documents,
  leadDisplayName,
  aiReport,
  proposalConfirmedAt,
  proposalSentAt,
  presentationGammaUrl,
  presentationPdfUrl,
  commercialState,
  strategyApproved = false,
  strategyContextText = "",
  onStructureConfirmed,
  onConfirmReadinessChange,
  onProposalDocumentCreated,
  onRegisterProposalCreateAction,
  onProposalCreateReadinessChange,
  proposalReviewed = false,
  proposalReviewPatchBusy = false,
  onMarkProposalReviewed,
  presentationGenerateBusy = false,
  presentationGenerationStatus = "idle",
  presentationGenerationProgress = 0,
  presentationGenerationEtaSeconds = null,
  presentationGenerationError = null,
  presentationCloseBusy = false,
  onGeneratePresentation,
  onOpenPresentation,
  onAdvanceToClose,
  onGoToClosingActions,
}: Leads87AdvancedWorkspaceProps) {
  const [closingGuideOpen, setClosingGuideOpen] = useState(false);
  const [closingGuideBusy, setClosingGuideBusy] = useState(false);
  const [closingGuideError, setClosingGuideError] = useState<string | null>(null);
  const [closingGuideRaw, setClosingGuideRaw] = useState<string | null>(null);

  const proposalUrl = documents?.proposal?.trim();
  const presentationResolved = resolvePresentationResource(
    documents as Parameters<typeof resolvePresentationResource>[0],
    presentationGammaUrl,
    presentationPdfUrl
  );
  const structureConfirmed = Boolean(proposalConfirmedAt?.trim());
  const step6 = step6Badge(commercialState);

  const closingGuideStructured = useMemo(() => {
    const text = String(closingGuideRaw || "").trim();
    const take = (titles: string[]) => {
      const escaped = titles.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      const re = new RegExp(
        `(?:^|\\n)\\s*(?:\\*\\*)?(${escaped})(?:\\*\\*)?\\s*[:\\-]?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*)?(?:Apertura de reunión|Presentación de propuesta|Objeciones probables|Respuestas sugeridas|Cierre recomendado)(?:\\*\\*)?\\s*[:\\-]?|$)`,
        "i"
      );
      const m = text.match(re);
      return m?.[2]?.trim() || "";
    };
    return {
      apertura: take(["Apertura de reunión", "Apertura"]),
      presentacion: take(["Presentación de propuesta", "Presentación"]),
      objeciones: take(["Objeciones probables", "Objeciones"]),
      respuestas: take(["Respuestas sugeridas", "Respuestas"]),
      cierre: take(["Cierre recomendado", "Cierre"]),
    };
  }, [closingGuideRaw]);

  if (step === 4) {
    return (
      <Leads87ServicesWorkspace
        leadId={leadId}
        aiReport={aiReport ?? null}
        strategyApproved={strategyApproved}
        strategyContextText={strategyContextText}
        proposalConfirmedAt={proposalConfirmedAt}
        onStructureConfirmed={onStructureConfirmed}
        onConfirmReadinessChange={onConfirmReadinessChange}
      />
    );
  }

  if (step === 5) {
    return (
      <Leads87ProposalWorkspace
        leadId={leadId}
        leadDisplayName={leadDisplayName}
        proposalUrl={proposalUrl}
        commercialStrategyApproved={strategyApproved}
        structureConfirmed={structureConfirmed}
        onDocumentCreated={onProposalDocumentCreated ?? (() => {})}
        onRegisterCreateAction={onRegisterProposalCreateAction}
        onCreateReadinessChange={onProposalCreateReadinessChange}
        proposalReviewed={proposalReviewed}
        proposalReviewPatchBusy={proposalReviewPatchBusy}
        onMarkProposalReviewed={onMarkProposalReviewed}
      />
    );
  }

  // step === 6
  const sent = Boolean(proposalSentAt?.trim());
  const officialPresDoc =
    presentationResolved.presentationDocumentUrl &&
    isOfficialPresentationDocumentUrl(presentationResolved.presentationDocumentUrl);
  const hasArchivedPdf = Boolean(presentationResolved.pdfUrl);
  const hasStableArchivedOutput = Boolean(officialPresDoc || hasArchivedPdf);
  const hasGamma = Boolean(presentationResolved.gammaUrl);
  const hasGammaExternal = Boolean(
    presentationResolved.gammaUrl?.trim() && isGammaExternalOnlyUrl(presentationResolved.gammaUrl)
  );
  const hasPdf = hasArchivedPdf;
  const hasTemporaryPdf = Boolean(presentationResolved.temporaryPdfUrl);
  const primaryTrim =
    presentationResolved.presentationDocumentUrl ?? presentationResolved.fallbackLinkedUrl ?? "";
  const showPrimaryRow =
    Boolean(primaryTrim) &&
    primaryTrim !== presentationResolved.gammaUrl &&
    primaryTrim !== presentationResolved.pdfUrl;
  const hasOnlyTemporaryOutput = hasTemporaryPdf && !hasStableArchivedOutput;
  const hasGammaWithoutArchive = hasGammaExternal && !hasStableArchivedOutput && !hasTemporaryPdf;
  const showEmptyOnboarding = !hasStableArchivedOutput && !hasGamma && !hasTemporaryPdf;
  const isGeneratingPresentation = presentationGenerationStatus === "generating" || presentationGenerateBusy;
  const canGeneratePresentation = commercialState === "ready_for_presentation";

  async function resolveModoEasyProfileId(): Promise<string> {
    const res = await fetch("/api/admin/ia/profiles", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ id: string; name?: string }>;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json?.error ?? "No se pudo cargar perfiles IA.");
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    const modeasy = rows.find((p) => String(p?.name || "").toLowerCase().includes("modo easy"));
    if (!modeasy?.id) {
      throw new Error("No se encontró el perfil IA 'Agencia de Marketing / MODO EASY'.");
    }
    return modeasy.id;
  }

  function extractTab(report: string, tabId: string): string {
    const re = new RegExp(`###\\s+TAB:\\s*${tabId}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+TAB:|$)`, "i");
    const m = String(report || "").match(re);
    return m?.[1]?.trim() || "";
  }

  async function generateClosingGuide(): Promise<void> {
    try {
      setClosingGuideBusy(true);
      setClosingGuideError(null);
      const profileId = await resolveModoEasyProfileId();
      const svcRes = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/services`, { cache: "no-store" });
      const svcJson = (await svcRes.json().catch(() => ({}))) as { services?: LeadServiceForAssistant[]; error?: string };
      const services = Array.isArray(svcJson?.services) ? svcJson.services : [];
      const runtimeContext = [
        "Asistente de cierre comercial en vivo (Paso 6).",
        `Servicios seleccionados (${services.length}):`,
        ...services.slice(0, 12).map((s, idx) => `- ${idx + 1}) ${s.nombre || s.codigo || s.service_id} | Mes ${s.mes} | ${s.moneda || ""} ${s.precio ?? "—"} | Alcance: ${s.alcance_editado || "—"}`),
        "",
        `Propuesta generada URL: ${proposalUrl || "no disponible"}`,
        "",
        "Insights del diagnóstico (extracto):",
        (aiReport || "").slice(0, 1800) || "No hay diagnóstico disponible.",
        "",
        "Formato obligatorio en 5 bloques exactos:",
        "1) Apertura de reunión",
        "2) Presentación de propuesta",
        "3) Objeciones probables",
        "4) Respuestas sugeridas",
        "5) Cierre recomendado",
      ].join("\n");

      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          profile_id: profileId,
          force_regenerate: true,
          only_module: "cierre_de_venta",
          runtime_context: runtimeContext,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { report?: string; ai_report?: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo generar la guía de cierre.");
      }
      const report = String(json?.data?.report || json?.data?.ai_report || "");
      const tab = extractTab(report, "cierre_de_venta");
      setClosingGuideRaw(tab || report || "");
      setClosingGuideOpen(true);
    } catch (e) {
      setClosingGuideError(e instanceof Error ? e.message : "Error generando guía de cierre.");
    } finally {
      setClosingGuideBusy(false);
    }
  }

  return (
    <div id="leads87-presentation-workflow" className="space-y-4 scroll-mt-4">
      <p className="text-sm text-slate-600">
        Este paso gestiona la <strong>presentación comercial</strong> para el cliente. El estado depende de la propuesta
        revisada y del documento de presentación guardado en el lead (no se pierde al recargar).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${step6.cls}`}>{step6.label}</span>
        {sent ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            Propuesta marcada como enviada
          </span>
        ) : null}
      </div>

      {isGeneratingPresentation ? (
        <div
          className="rounded-xl border-2 border-blue-400 bg-gradient-to-b from-blue-50/90 to-white px-4 py-4 shadow-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex gap-4">
            <span
              className="mt-1 inline-block h-10 w-10 shrink-0 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                Generando presentación comercial a partir de la propuesta…
              </h3>
              <p className="mt-1 text-sm text-slate-600">Esto puede tardar unos minutos</p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, presentationGenerationProgress))}%` }}
                  role="progressbar"
                  aria-valuenow={Math.min(100, Math.max(0, presentationGenerationProgress))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progreso de generación de presentación"
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-700">
                {Math.min(100, Math.max(0, presentationGenerationProgress))}% completado
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {presentationGenerationEtaSeconds != null
                  ? `Tiempo estimado restante: ${formatTime(presentationGenerationEtaSeconds)}`
                  : "Calculando tiempo estimado..."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {presentationGenerationStatus === "error" && presentationGenerationError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">Error al generar la presentación comercial.</p>
          <p className="mt-1">{presentationGenerationError}</p>
          {onGeneratePresentation ? (
            <button
              type="button"
              onClick={() => void onGeneratePresentation()}
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-50"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {showEmptyOnboarding ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6">
          <p className="text-sm font-medium text-slate-800">
            Todavía no existe una presentación comercial archivada en el CRM para este lead.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Generá la presentación con Gamma; cuando haya PDF de exportación, el sistema lo guarda en almacenamiento propio antes de darla por lista.
          </p>
          {!canGeneratePresentation ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Primero confirmá la revisión de la <strong>propuesta comercial</strong> en el paso 5.
            </p>
          ) : null}
          {onGeneratePresentation ? (
            <button
              type="button"
              onClick={() => void onGeneratePresentation()}
              disabled={isGeneratingPresentation || !canGeneratePresentation}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              title={!canGeneratePresentation ? "Primero validá la propuesta comercial en el paso 5" : undefined}
            >
              {isGeneratingPresentation ? "Generando presentación comercial…" : "Generar presentación comercial"}
            </button>
          ) : null}
        </div>
      ) : null}

      {hasOnlyTemporaryOutput ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">PDF de Gamma sin archivar en el CRM</p>
          <p className="mt-1 text-xs text-amber-900">
            El enlace de exportación puede expirar. Reintentá la generación desde el paso 6 o archivá desde el informe IA (Descargar PDF) para obtener una URL estable.
          </p>
          {onGeneratePresentation ? (
            <button
              type="button"
              onClick={() => void onGeneratePresentation()}
              disabled={isGeneratingPresentation || !canGeneratePresentation}
              className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              Reintentar generación / archivado
            </button>
          ) : null}
        </div>
      ) : null}

      {hasGammaWithoutArchive ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Solo enlace a la app Gamma (no archivado)</p>
          <p className="mt-1 text-xs text-amber-900">
            Exportá el PDF desde Gamma y generá de nuevo la presentación para que el sistema lo guarde en storage propio.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {hasPdf ? docActionRow("PDF de presentación (almacenamiento CRM)", presentationResolved.pdfUrl) : null}
        {showPrimaryRow && primaryTrim && isOfficialPresentationDocumentUrl(primaryTrim) ? (
          docActionRow("Documento vinculado (CRM)", primaryTrim)
        ) : showPrimaryRow && primaryTrim ? (
          docActionRow("Documento vinculado (revisar URL)", primaryTrim, { secondary: true })
        ) : null}
        {hasGamma ? docActionRow("Vista en Gamma (externo, no oficial CRM)", presentationResolved.gammaUrl, { secondary: true }) : null}
      </div>

      {hasStableArchivedOutput ? (
        <>
          <details className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3" open={closingGuideOpen}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Asistente de cierre comercial (IA)
            </summary>
            <p className="mt-2 text-xs text-slate-600">
              Guía en vivo para conducir la reunión final usando servicios seleccionados, propuesta e insights del diagnóstico.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void generateClosingGuide()}
                disabled={closingGuideBusy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              >
                {closingGuideBusy ? "Generando guía…" : "Generar guía de cierre"}
              </button>
              {closingGuideRaw ? (
                <button
                  type="button"
                  onClick={() => setClosingGuideOpen((v) => !v)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {closingGuideOpen ? "Contraer" : "Expandir"}
                </button>
              ) : null}
            </div>
            {closingGuideError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {closingGuideError}
              </div>
            ) : null}
            {closingGuideRaw ? (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <div>
                  <p className="font-semibold text-slate-900">Apertura de reunión</p>
                  <p className="mt-1 whitespace-pre-wrap">{closingGuideStructured.apertura || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Presentación de propuesta</p>
                  <p className="mt-1 whitespace-pre-wrap">{closingGuideStructured.presentacion || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Objeciones probables</p>
                  <p className="mt-1 whitespace-pre-wrap">{closingGuideStructured.objeciones || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Respuestas sugeridas</p>
                  <p className="mt-1 whitespace-pre-wrap">{closingGuideStructured.respuestas || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Cierre recomendado</p>
                  <p className="mt-1 whitespace-pre-wrap">{closingGuideStructured.cierre || "—"}</p>
                </div>
              </div>
            ) : null}
          </details>

          {commercialState === "presentation_ready" ? (
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">1/2</span> Revisá la presentación con los enlaces de abajo.{" "}
              <span className="font-semibold text-slate-800">2/2</span> Cerrá la etapa con el botón verde al final.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {onOpenPresentation ? (
              <button
                type="button"
                onClick={onOpenPresentation}
                className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Abrir presentación comercial
              </button>
            ) : null}
          </div>
          {onAdvanceToClose ? (
            <div id="leads87-presentation-close" className="scroll-mt-4 border-t border-slate-200 pt-4">
              {commercialState === "closing" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-sm font-medium text-emerald-900">
                    Este lead ya fue movido a cierre comercial.
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    La etapa de presentación ya está cerrada. Continuá en acciones de cierre y seguimiento.
                  </p>
                  {onGoToClosingActions ? (
                    <button
                      type="button"
                      onClick={onGoToClosingActions}
                      className="mt-3 rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Ir a acciones de cierre
                    </button>
                  ) : null}
                </div>
              ) : commercialState === "presentation_ready" ? (
                <button
                  type="button"
                  onClick={() => {
                    console.debug("[LEADS87][STEP6] CTA finalizar->cierre click");
                    void onAdvanceToClose();
                  }}
                  disabled={presentationCloseBusy}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {presentationCloseBusy ? "Actualizando etapa…" : "Finalizar proceso y pasar a cierre"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500"
                >
                  Finalizar proceso y pasar a cierre
                </button>
              )}
              {commercialState !== "closing" ? (
                <p className="mt-2 text-xs text-slate-500">
                  {commercialState === "presentation_ready"
                    ? "Es la única acción principal que marca la etapa comercial como cierre en el CRM."
                    : "Disponible cuando la presentación esté lista y archivada en el CRM."}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
