"use client";

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
  onStructureConfirmed?: () => void;
  onRegisterConfirmAction?: (action: (() => Promise<void>) | null) => void;
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
        {secondary ? "Abrir en Gamma (externo)" : pdf ? "Ver / descargar PDF (CRM)" : "Abrir documento"}
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
  onStructureConfirmed,
  onRegisterConfirmAction,
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
}: Leads87AdvancedWorkspaceProps) {
  const proposalUrl = documents?.proposal?.trim();
  const presentationResolved = resolvePresentationResource(
    documents as Parameters<typeof resolvePresentationResource>[0],
    presentationGammaUrl,
    presentationPdfUrl
  );
  const structureConfirmed = Boolean(proposalConfirmedAt?.trim());
  const step6 = step6Badge(commercialState);

  if (step === 4) {
    return (
      <Leads87ServicesWorkspace
        leadId={leadId}
        aiReport={aiReport ?? null}
        proposalConfirmedAt={proposalConfirmedAt}
        onStructureConfirmed={onStructureConfirmed}
        onRegisterConfirmAction={onRegisterConfirmAction}
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
              className="mt-3 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
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
          {commercialState === "presentation_ready" && onAdvanceToClose ? (
            <div id="leads87-presentation-close" className="scroll-mt-4 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => void onAdvanceToClose()}
                disabled={presentationCloseBusy}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {presentationCloseBusy ? "Actualizando etapa…" : "Avanzar a cierre"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Es la única acción que marca la etapa comercial como cierre en el CRM.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
