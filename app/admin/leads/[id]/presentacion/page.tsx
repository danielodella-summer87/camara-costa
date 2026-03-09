"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DOC_ORDER: ("diagnostic" | "strategy" | "proposal")[] = ["diagnostic", "strategy", "proposal"];
const DOC_LABELS: Record<"diagnostic" | "strategy" | "proposal", string> = {
  diagnostic: "Diagnóstico Comercial",
  strategy: "Visión Estratégica",
  proposal: "Propuesta Comercial",
};

type DocUrls = { diagnostic: string | null; strategy: string | null; proposal: string | null };

/** Orden: diagnostic, strategy, proposal. Solo los que existan. */
function orderedUrlsFromDocs(docs: DocUrls): string[] {
  return DOC_ORDER.map((t) => docs[t]).filter(Boolean) as string[];
}

function orderedTypesFromDocs(docs: DocUrls): ("diagnostic" | "strategy" | "proposal")[] {
  return DOC_ORDER.filter((t) => docs[t]);
}

export default function LeadPresentacionPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [urls, setUrls] = useState<DocUrls>({ diagnostic: null, strategy: null, proposal: null });
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const loadDocuments = useCallback(() => {
    if (!id?.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; documents?: DocUrls }) => {
        if (data?.ok && data.documents) {
          setUrls({
            diagnostic: data.documents.diagnostic ?? null,
            strategy: data.documents.strategy ?? null,
            proposal: data.documents.proposal ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const orderedUrls = orderedUrlsFromDocs(urls);
  const orderedTypes = orderedTypesFromDocs(urls);
  const hasAny = orderedUrls.length > 0;
  const currentUrl = orderedUrls[currentIndex] ?? null;
  const currentType = orderedTypes[currentIndex];
  const currentLabel = currentType ? DOC_LABELS[currentType] : "";
  const canNext = currentIndex < orderedUrls.length - 1;
  const canPrev = currentIndex > 0;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={id ? `/admin/leads/${id}?tab=comercial&section=proceso-comercial` : "/admin/leads"}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Volver al lead
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Presentación al cliente</h1>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Cargando documentos…
          </div>
        ) : !hasAny ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">
              No hay documentos generados para este lead. Generá los tres documentos (Diagnóstico, Visión Estratégica, Propuesta) desde el proceso comercial del lead.
            </p>
            <Link
              href={id ? `/admin/leads/${id}?tab=comercial&section=proceso-comercial` : "/admin/leads"}
              className="mt-4 inline-block rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Ir al proceso comercial
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between rounded-t-xl border border-b-0 border-slate-200 bg-white px-4 py-2">
              <span className="text-sm font-medium text-slate-700">
                {currentLabel}
              </span>
              <span className="text-xs text-slate-500">
                {currentIndex + 1} de {orderedUrls.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white">
              {currentUrl ? (
                <iframe
                  src={currentUrl}
                  title={currentLabel}
                  className="h-[70vh] w-full min-h-[400px]"
                  sandbox="allow-same-origin allow-scripts allow-popups"
                />
              ) : (
                <div className="flex h-[70vh] min-h-[400px] items-center justify-center text-slate-500">
                  Este documento aún no fue generado.
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Documento anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, orderedUrls.length - 1))}
                disabled={!canNext}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente documento
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
