"use client";

import { useRef } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ExternalLink, Maximize2 } from "lucide-react";

const FLIPBOOK_URL = "https://online.fliphtml5.com/easydigitalagency/CRM-con-Inteligencia-Comercial/";

export default function NeuroventasPage() {
  const flipbookRef = useRef<HTMLDivElement>(null);

  const handleFullscreen = () => {
    const el = flipbookRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {
        window.open(FLIPBOOK_URL, "_blank", "noopener,noreferrer");
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <PageContainer>
      {/* A) Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manual de neuroventas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Material de consulta y capacitación comercial dentro de Summer87 Intelligence.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <a
            href={FLIPBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir en nueva pestaña
          </a>
          <button
            type="button"
            onClick={handleFullscreen}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
          >
            <Maximize2 className="h-4 w-4" />
            Pantalla completa
          </button>
        </div>
      </div>

      {/* B) Grid: flipbook + bloque complementario */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Bloque principal: flipbook */}
        <div
          ref={flipbookRef}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="min-h-[480px] sm:min-h-[560px] lg:min-h-[720px] w-full">
            <iframe
              title="Manual de neuroventas — Summer87 Intelligence"
              src={FLIPBOOK_URL}
              className="h-full min-h-[480px] w-full sm:min-h-[560px] lg:min-h-[720px]"
              allowFullScreen
            />
          </div>
          <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-500">
            Si no ves el manual aquí, usa «Abrir en nueva pestaña» o «Pantalla completa».
          </p>
        </div>

        {/* C) Bloque complementario: cards */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Puntos clave del manual</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Guía de apoyo para el proceso comercial
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Material útil para diagnóstico, propuesta y cierre
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Recomendado para comerciales y consultores
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Puede consultarse durante reuniones o preparación previa
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Uso recomendado</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Usa este manual como apoyo antes de reuniones, durante el armado de propuestas y para
              reforzar criterios comerciales.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
