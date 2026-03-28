"use client";

/**
 * Guía estratégica del proceso — 8 etapas colapsables.
 * Contenido validado: no reinterpretar, no resumir.
 * Usado por LEADS87 y reutilizable desde OportunidadWorkspace.
 */

export function GuiaEstrategicaProceso({ currentStageIndex }: { currentStageIndex: number | null }) {
  const stage = (i: number) => {
    const completed = currentStageIndex !== null && i < currentStageIndex;
    const active = currentStageIndex !== null && i === currentStageIndex;
    return `rounded-lg border bg-slate-50/50 ${completed ? "border-emerald-300 bg-emerald-50/30" : ""} ${active ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`;
  };
  const summary = (i: number, title: string) => (
    <>
      {currentStageIndex !== null && i < currentStageIndex && "✓ "}
      {currentStageIndex !== null && i === currentStageIndex && "→ "}
      {title}
    </>
  );

  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm [&_summary]:cursor-pointer [&_summary]:select-none [&_summary]:rounded-lg [&_summary]:px-3 [&_summary]:py-2 [&_summary]:font-medium [&_summary]:text-slate-700 [&_summary]:hover:bg-slate-100/50">
      <summary className="text-sm">Guía estratégica del proceso</summary>
      <div className="mt-5 space-y-3.5">
        <details className={stage(0)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(0, "Etapa 1 — Lead creado / datos base")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Comprender el negocio del cliente antes de sugerir soluciones.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>✔ Lead registrado</li>
                <li>✔ Responsable asignado</li>
                <li>☐ Web analizada</li>
                <li>☐ LinkedIn de la organización revisado</li>
                <li>☐ Competencia identificada</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Antes de hablar de servicios, demuestra que entiendes cómo gana dinero el cliente.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Proponer redes sociales sin analizar primero el modelo de captación del negocio.</p>
            </div>
          </div>
        </details>

        <details className={stage(1)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(1, "Etapa 2 — Investigación")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Recolectar datos del mercado, competencia y perfil del cliente.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ Fuentes verificadas</li>
                <li>☐ Pauta y canales revisados</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Usa datos concretos en la conversación para generar credibilidad.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Basarse solo en lo que dice el cliente sin contrastar con datos.</p>
            </div>
          </div>
        </details>

        <details className={stage(2)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(2, "Etapa 3 — Diagnóstico comercial")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Identificar fortalezas, debilidades y oportunidades del negocio del lead.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ FODA o equivalente</li>
                <li>☐ Oportunidades priorizadas</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Presenta el diagnóstico como un espejo del negocio, no como crítica.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Saltar al cierre sin que el cliente reconozca el diagnóstico.</p>
            </div>
          </div>
        </details>

        <details className={stage(3)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(3, "Etapa 4 — Estrategia")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Definir el rumbo y las prioridades de crecimiento con el cliente.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ Visión alineada</li>
                <li>☐ Métricas acordadas</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Ancla la estrategia en objetivos que el cliente ya verbalizó.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Imponer una estrategia sin co-crearla con el decisor.</p>
            </div>
          </div>
        </details>

        <details className={stage(4)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(4, "Etapa 5 — Estructura de servicios")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Traducir la estrategia en una oferta concreta de servicios y alcance.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ Servicios alineados al diagnóstico</li>
                <li>☐ Inversión y plazos definidos</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Enlaza cada servicio con un dolor u oportunidad que el cliente ya reconoció.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Vender paquetes estándar sin personalizar al diagnóstico.</p>
            </div>
          </div>
        </details>

        <details className={stage(5)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(5, "Etapa 6 — Propuesta comercial")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Documentar la oferta, condiciones e inversión para aprobación del cliente.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ Propuesta generada</li>
                <li>☐ Revisada con responsable</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Presenta la propuesta como el siguiente paso natural del diagnóstico.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Enviar la propuesta por correo sin haber alineado expectativas antes.</p>
            </div>
          </div>
        </details>

        <details className={stage(6)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(6, "Etapa 7 — Presentación")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Exponer la propuesta y el valor de forma clara y persuasiva.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ Material preparado</li>
                <li>☐ Objeciones anticipadas</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Deja espacio para preguntas y no satures con slides.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Leer la presentación en lugar de conversar con el cliente.</p>
            </div>
          </div>
        </details>

        <details className={stage(7)}>
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
            {summary(7, "Etapa 8 — Seguimiento y cierre")}
          </summary>
          <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-medium text-slate-700">Objetivo</p>
              <p className="mt-0.5">Cerrar el acuerdo y definir próximos pasos operativos.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Checklist</p>
              <ul className="mt-0.5 list-none space-y-0.5">
                <li>☐ Respuesta del cliente registrada</li>
                <li>☐ Próxima actividad agendada</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700">Tip de neuroventas</p>
              <p className="mt-0.5">Refuerza el beneficio ganado y reduce la incertidumbre post-compra.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Error común</p>
              <p className="mt-0.5">Desaparecer después de enviar la propuesta sin seguimiento.</p>
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
