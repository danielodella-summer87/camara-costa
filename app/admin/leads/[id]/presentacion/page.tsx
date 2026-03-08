"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "lead_commercial_docs";
const DOC_LABELS = ["Diagnóstico Comercial", "Visión Estratégica", "Propuesta Comercial"] as const;

type DocUrls = { diagnostic: string | null; strategy: string | null; proposal: string | null };

function getUrlsForLead(leadId: string): DocUrls {
  if (typeof window === "undefined") return { diagnostic: null, strategy: null, proposal: null };
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}_${leadId}`);
    if (!raw) return { diagnostic: null, strategy: null, proposal: null };
    const parsed = JSON.parse(raw) as DocUrls;
    return {
      diagnostic: parsed.diagnostic ?? null,
      strategy: parsed.strategy ?? null,
      proposal: parsed.proposal ?? null,
    };
  } catch {
    return { diagnostic: null, strategy: null, proposal: null };
  }
}

function getUrlAtOrder(urls: DocUrls, index: number): string | null {
  if (index === 0) return urls.diagnostic;
  if (index === 1) return urls.strategy;
  return urls.proposal;
}

export default function LeadPresentacionPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [urls, setUrls] = useState<DocUrls>({ diagnostic: null, strategy: null, proposal: null });
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    setUrls(getUrlsForLead(id));
  }, [id]);

  const orderedUrls = [urls.diagnostic, urls.strategy, urls.proposal].filter(Boolean) as string[];
  const hasAny = orderedUrls.length > 0;
  const currentUrl = getUrlAtOrder(urls, currentIndex);
  const canNext = currentIndex < 2 && getUrlAtOrder(urls, currentIndex + 1);
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

        {!hasAny ? (
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
                {DOC_LABELS[currentIndex]}
              </span>
              <span className="text-xs text-slate-500">
                {currentIndex + 1} de 3
              </span>
            </div>
            <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white">
              {currentUrl ? (
                <iframe
                  src={currentUrl}
                  title={DOC_LABELS[currentIndex]}
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
                onClick={() => setCurrentIndex((i) => (i < 2 ? i + 1 : i))}
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
