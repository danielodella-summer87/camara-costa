"use client";

import {
  isPdfUrl,
  isSameOriginPdfUrl,
  isTransientGammaExportPdfUrl,
  resolvePresentationResource,
  type ResolvedPresentationResource,
} from "@/lib/leads/presentationUtils";
import {
  isGammaExternalOnlyUrl,
  isOfficialPresentationDocumentUrl,
} from "@/lib/leads/commercialGammaDocuments";
import { isProposalMarkdownDataUrl } from "@/lib/leads/gammaDocumentPolicy";
import type {
  LeadDocumentArchiveEntry,
  LeadDocumentType,
  LeadDocumentVersionSummary,
} from "@/lib/leads/leadDocuments";
import type { LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";

const DOC_ORDER: LeadDocumentType[] = ["diagnostic", "strategy", "proposal", "presentation"];

const DOC_LABELS: Record<LeadDocumentType, string> = {
  diagnostic: "Diagnóstico comercial",
  strategy: "Estrategia de crecimiento",
  proposal: "Propuesta comercial",
  presentation: "Presentación comercial",
};

const WORKSPACE_STEP: Record<LeadDocumentType, number> = {
  diagnostic: 2,
  strategy: 3,
  proposal: 5,
  presentation: 6,
};

function auxiliaryGammaOpenHref(entry: LeadDocumentArchiveEntry | null | undefined): string | null {
  if (!entry || entry.officialUrl?.trim()) return null;
  const g = entry.gammaUrl?.trim();
  if (g && (isGammaExternalOnlyUrl(g) || isTransientGammaExportPdfUrl(g))) return g;
  const r = entry.rawUrl?.trim();
  if (r && isGammaExternalOnlyUrl(r)) return r;
  if (r && isTransientGammaExportPdfUrl(r)) return r;
  return null;
}

function statusLabel(
  type: LeadDocumentType,
  entry: LeadDocumentArchiveEntry | null | undefined,
  docUrl: string,
  presentationResolved: ResolvedPresentationResource | null
): { text: string; tone: "ok" | "pending" | "missing" | "error" } {
  if (type === "presentation" && presentationResolved) {
    const official =
      presentationResolved.presentationDocumentUrl &&
      isOfficialPresentationDocumentUrl(presentationResolved.presentationDocumentUrl);
    if (official) return { text: "En CRM", tone: "ok" };
    if (presentationResolved.temporaryPdfUrl || presentationResolved.pdfUrl) {
      return { text: "Pendiente de archivar", tone: "pending" };
    }
    if (presentationResolved.gammaUrl) return { text: "Solo en Gamma (externo)", tone: "pending" };
    if (docUrl) return { text: "Disponible", tone: "pending" };
    return { text: "Sin documento", tone: "missing" };
  }

  if (!entry || entry.status === "missing") {
    if (docUrl.trim()) return { text: "Disponible", tone: "pending" };
    return { text: "Sin documento", tone: "missing" };
  }
  if (entry.status === "failed") return { text: "Error al archivar", tone: "error" };
  if (entry.officialUrl?.trim()) return { text: "En CRM", tone: "ok" };
  if (entry.status === "pending") return { text: "Pendiente de archivar", tone: "pending" };
  return { text: "Sin documento", tone: "missing" };
}

type Props = {
  archiveByType: Record<LeadDocumentType, LeadDocumentArchiveEntry> | null;
  documents: LeadsOkDocuments | null;
  versionSummaries: LeadDocumentVersionSummary[];
  presentationGammaUrl: string | null;
  presentationPdfUrl: string | null;
  legacyTransientTypes: LeadDocumentType[];
  recoverBusy: boolean;
  onGoToWorkspace: (step: number) => void;
  onRecoverLegacy: () => void;
  /** Abre presentación archivada / PDF (misma lógica que el hero). */
  onOpenPresentationOfficial: () => void;
};

async function downloadPdfClient(url: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "documento.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export function Leads87LeadDocumentsBlock({
  archiveByType,
  documents,
  versionSummaries,
  presentationGammaUrl,
  presentationPdfUrl,
  legacyTransientTypes,
  recoverBusy,
  onGoToWorkspace,
  onRecoverLegacy,
  onOpenPresentationOfficial,
}: Props) {
  const presentationResolved =
    documents || presentationGammaUrl || presentationPdfUrl
      ? resolvePresentationResource(documents, presentationGammaUrl, presentationPdfUrl)
      : null;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-slate-500">
        Documentos persistidos en el CRM por tipo (<code className="text-[10px]">lead_documents</code>). La
        investigación con IA (paso 1) no es un archivo comercial: gestionala desde el workspace de investigación.
      </p>

      <div className="mt-5 space-y-2.5">
        {DOC_ORDER.map((type) => {
          const label = DOC_LABELS[type];
          const entry = archiveByType?.[type];
          const docUrl = String(documents?.[type] ?? "").trim();
          const st = statusLabel(type, entry, docUrl, presentationResolved);

          const officialNonPresentation =
            type !== "presentation" ? (entry?.officialUrl?.trim() || null) : null;
          const officialPresentation =
            type === "presentation" &&
            presentationResolved?.presentationDocumentUrl &&
            isOfficialPresentationDocumentUrl(presentationResolved.presentationDocumentUrl)
              ? presentationResolved.presentationDocumentUrl.trim()
              : null;
          const openOfficial =
            type === "presentation"
              ? officialPresentation ||
                (presentationResolved?.pdfUrl && !isTransientGammaExportPdfUrl(presentationResolved.pdfUrl)
                  ? presentationResolved.pdfUrl.trim()
                  : null) ||
                (presentationResolved?.fallbackLinkedUrl?.trim() || null)
              : officialNonPresentation;

          const auxGamma =
            type === "presentation"
              ? presentationResolved?.gammaUrl?.trim() &&
                (isGammaExternalOnlyUrl(presentationResolved.gammaUrl) ||
                  isTransientGammaExportPdfUrl(presentationResolved.gammaUrl))
                ? presentationResolved.gammaUrl.trim()
                : null
              : auxiliaryGammaOpenHref(entry);

          const transientPdf =
            type === "presentation"
              ? presentationResolved?.temporaryPdfUrl?.trim() ||
                (presentationResolved?.pdfUrl && isTransientGammaExportPdfUrl(presentationResolved.pdfUrl)
                  ? presentationResolved.pdfUrl.trim()
                  : null)
              : null;

          const fallbackOpen =
            !openOfficial && !auxGamma && !transientPdf
              ? docUrl || entry?.rawUrl?.trim() || ""
              : "";
          const anyOpenUrl = openOfficial || auxGamma || transientPdf || fallbackOpen;

          const versionHint = (() => {
            const forType = versionSummaries.filter((v) => v.type === type);
            if (forType.length <= 1) return null;
            const cur = forType.find((v) => v.is_current);
            return cur ? `Versión vigente: v${cur.version_number}` : null;
          })();

          const showRecover = legacyTransientTypes.includes(type);

          const pdfForDownload = (() => {
            if (openOfficial && isPdfUrl(openOfficial)) return openOfficial;
            if (docUrl && isPdfUrl(docUrl)) return docUrl;
            if (type === "presentation" && presentationResolved?.pdfUrl && !isTransientGammaExportPdfUrl(presentationResolved.pdfUrl)) {
              return presentationResolved.pdfUrl.trim();
            }
            return null;
          })();

          const toneClass =
            st.tone === "ok"
              ? "bg-emerald-100 text-emerald-800"
              : st.tone === "pending"
                ? "bg-amber-100 text-amber-800"
                : st.tone === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-slate-200 text-slate-600";

          return (
            <div
              key={type}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{st.text}</span>
                </div>
                {versionHint ? <p className="text-[11px] text-slate-500">{versionHint}</p> : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {anyOpenUrl ? (
                  <>
                    {openOfficial ? (
                      <button
                        type="button"
                        onClick={() =>
                          type === "presentation"
                            ? onOpenPresentationOfficial()
                            : window.open(openOfficial, "_blank", "noopener,noreferrer")
                        }
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {type === "presentation" ? "Abrir presentación comercial" : "Ver / abrir documento"}
                      </button>
                    ) : null}

                    {auxGamma && (!openOfficial || auxGamma !== openOfficial) ? (
                      <button
                        type="button"
                        onClick={() => window.open(auxGamma, "_blank", "noopener,noreferrer")}
                        className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Abrir en Gamma (externo)
                      </button>
                    ) : null}

                    {transientPdf && !openOfficial ? (
                      <button
                        type="button"
                        onClick={() => window.open(transientPdf, "_blank", "noopener,noreferrer")}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Abrir PDF Gamma (temporal)
                      </button>
                    ) : null}

                    {!openOfficial && !auxGamma && !transientPdf && fallbackOpen ? (
                      <button
                        type="button"
                        onClick={() => window.open(fallbackOpen, "_blank", "noopener,noreferrer")}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {isProposalMarkdownDataUrl(fallbackOpen) ? "Ver propuesta" : "Abrir enlace"}
                      </button>
                    ) : null}

                    {pdfForDownload && typeof window !== "undefined" ? (
                      isSameOriginPdfUrl(pdfForDownload, window.location.origin) ? (
                        <button
                          type="button"
                          onClick={() => void downloadPdfClient(pdfForDownload)}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Descargar PDF
                        </button>
                      ) : isPdfUrl(pdfForDownload) ? (
                        <a
                          href={pdfForDownload}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Descargar / abrir PDF
                        </a>
                      ) : null
                    ) : null}
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => onGoToWorkspace(WORKSPACE_STEP[type])}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Ir al workspace
                </button>

                {showRecover ? (
                  <button
                    type="button"
                    disabled={recoverBusy}
                    onClick={() => onRecoverLegacy()}
                    className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {recoverBusy ? "Archivando…" : "Reintentar archivado"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
