"use client";

import { useState } from "react";

/** Forma mínima del lead (misma que /admin/oportunidades/[id]). */
export type OportunidadLeadProp = {
  id?: string | null;
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  linkedin_empresa?: string | null;
  linkedin_director?: string | null;
  empresas?: {
    nombre?: string | null;
    rubros?: { nombre?: string | null } | null;
  } | null;
} | null;

const WORKSPACE_TABS = [
  { id: "contexto", label: "Contexto" },
  { id: "investigacion", label: "Investigación" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "acciones", label: "Acciones" },
  { id: "servicios", label: "Servicios" },
  { id: "propuesta", label: "Propuesta" },
] as const;

function format(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

type Props = { lead: OportunidadLeadProp; id: string | null };

export function OportunidadWorkspace({ lead, id: _id }: Props) {
  const [workspaceTab, setWorkspaceTab] = useState<(typeof WORKSPACE_TABS)[number]["id"]>("contexto");

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Guía estratégica del proceso */}
      <div className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Guía estratégica del proceso</h2>
        <div className="mt-5 space-y-3.5">
          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Contexto del lead
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
                  <li>☐ LinkedIn empresa revisado</li>
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Investigación comercial
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Diagnóstico estratégico
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Estrategia de crecimiento
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Servicios recomendados
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Propuesta comercial
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Presentación
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

          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              Seguimiento y cierre
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
      </div>

      {/* Mapa técnico del proceso */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Mapa técnico del proceso</h2>

        <div className="mt-5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Lead</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-800">Investigación</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Diagnóstico</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Estrategia</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Servicios</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Propuesta</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Presentación</span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Cierre</span>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Etapa actual:</span> Investigación</p>
          <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-700">Paso actual:</span> Análisis del lead</p>
          <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-700">Siguiente paso:</span> Diagnóstico comercial</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investigación</p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              <li>activos digitales</li>
              <li>redes sociales</li>
              <li>posicionamiento</li>
              <li>competencia</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnóstico</p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              <li>FODA</li>
              <li>fricciones comerciales</li>
              <li>oportunidades</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Workspace operativo */}
      <div className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <h2 className="text-base font-semibold text-slate-800">Workspace operativo</h2>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkspaceTab(tab.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                workspaceTab === tab.id
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          {workspaceTab === "contexto" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="font-medium text-slate-700">Empresa</span><span className="ml-2 text-slate-600">{format(lead?.empresas?.nombre ?? lead?.nombre)}</span></div>
                <div><span className="font-medium text-slate-700">Rubro</span><span className="ml-2 text-slate-600">{format(lead?.empresas?.rubros?.nombre)}</span></div>
                <div><span className="font-medium text-slate-700">Objetivo</span><span className="ml-2 text-slate-600">—</span></div>
                <div><span className="font-medium text-slate-700">Contacto</span><span className="ml-2 text-slate-600">{format(lead?.contacto)}</span></div>
                <div><span className="font-medium text-slate-700">Web</span><span className="ml-2 text-slate-600">{format(lead?.website)}</span></div>
                <div><span className="font-medium text-slate-700">LinkedIn</span><span className="ml-2 text-slate-600">{format(lead?.linkedin_empresa ?? lead?.linkedin_director)}</span></div>
                <div><span className="font-medium text-slate-700">Redes</span><span className="ml-2 text-slate-600">—</span></div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lectura automática del CRM</p>
                <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                  <li>Madurez digital: media</li>
                  <li>Confianza digital: baja</li>
                  <li>Infraestructura comercial: débil</li>
                  <li>Potencial de oportunidad: alto</li>
                </ul>
              </div>
            </div>
          )}
          {workspaceTab === "investigacion" && (
            <div className="space-y-4">
              <div>
                <button type="button" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                  Generar análisis comercial
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documentos generados</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">PDF informe comercial</button>
                  <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Generar Gamma comercial</button>
                  <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Copiar</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-xs font-semibold text-slate-600">Investigación</p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                    <li>investigación digital</li>
                    <li>redes sociales</li>
                    <li>posicionamiento en mercado</li>
                    <li>competencia</li>
                    <li>LinkedIn tomadores decisión</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-xs font-semibold text-slate-600">Diagnóstico</p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                    <li>FODA</li>
                    <li>oportunidades</li>
                    <li>prestigio IA</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-xs font-semibold text-slate-600">Estrategia</p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                    <li>plan de crecimiento</li>
                    <li>visión estratégica</li>
                    <li>oportunidades de negocio EASY</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-xs font-semibold text-slate-600">Conversión</p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                    <li>acciones</li>
                    <li>materiales listos</li>
                    <li>cierre de venta</li>
                    <li>propuesta crecimiento EASY</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Personalización IA</p>
                <p className="text-xs text-slate-600 mb-4">El prompt original no se modifica; solo podés trabajar sobre una copia personalizada por lead.</p>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">Investigación digital</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt original (solo lectura)</p>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">Analizar presencia digital del lead: web, redes, contenido publicado y coherencia de mensaje. No modificar este texto.</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt personalizado</p>
                        <textarea readOnly placeholder="Copia editable para este lead" className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 min-h-[72px] resize-y" defaultValue="Incluir también revisión de LinkedIn empresa y competencia directa." />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver original</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar copia</button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">FODA</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt original (solo lectura)</p>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">Elaborar FODA del negocio del lead a partir de la investigación. Fortalezas, debilidades, oportunidades y amenazas. No modificar este texto.</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt personalizado</p>
                        <textarea readOnly placeholder="Copia editable para este lead" className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 min-h-[72px] resize-y" defaultValue="Priorizar oportunidades de membresía y eventos." />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver original</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar copia</button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">Plan de crecimiento</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt original (solo lectura)</p>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">Proponer plan de crecimiento a 30–90 días alineado al diagnóstico. Acciones concretas y prioridad. No modificar este texto.</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt personalizado</p>
                        <textarea readOnly placeholder="Copia editable para este lead" className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 min-h-[72px] resize-y" defaultValue="" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver original</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar copia</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {workspaceTab === "diagnostico" && (
            <ul className="space-y-2 text-sm text-slate-600">
              <li><span className="font-medium text-slate-700">Problema detectado</span> —</li>
              <li><span className="font-medium text-slate-700">FODA</span> —</li>
              <li><span className="font-medium text-slate-700">Fricciones comerciales</span> —</li>
              <li><span className="font-medium text-slate-700">Oportunidades</span> —</li>
            </ul>
          )}
          {workspaceTab === "acciones" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones 72 horas</p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Contactar al decisor para alinear expectativas</li>
                  <li>Enviar resumen del diagnóstico por correo</li>
                  <li>Agendar reunión de presentación de propuesta</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan 30–90 días</p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Implementar primer bloque de servicios acordados</li>
                  <li>Revisión de resultados y ajustes</li>
                  <li>Cierre de ciclo y renovación o ampliación</li>
                </ul>
              </div>
            </div>
          )}
          {workspaceTab === "servicios" && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Problema</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Acción</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Servicio</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-600">
                  <tr><td className="border border-slate-200 px-3 py-2">Baja visibilidad en redes</td><td className="border border-slate-200 px-3 py-2">Estrategia y gestión</td><td className="border border-slate-200 px-3 py-2">Community management</td></tr>
                  <tr><td className="border border-slate-200 px-3 py-2">Falta de datos de conversión</td><td className="border border-slate-200 px-3 py-2">Implementar medición</td><td className="border border-slate-200 px-3 py-2">Pixel y CAPI</td></tr>
                  <tr><td className="border border-slate-200 px-3 py-2">Desalineación con competencia</td><td className="border border-slate-200 px-3 py-2">Posicionamiento</td><td className="border border-slate-200 px-3 py-2">Consultoría estratégica</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {workspaceTab === "propuesta" && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Generar propuesta</button>
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Generar presentación</button>
            </div>
          )}
        </div>
      </div>

      {/* Reportes y documentos */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="text-sm font-semibold text-slate-800">Reportes y documentos</h2>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-slate-200 pb-4 text-sm text-slate-600">
          <span><span className="font-medium text-slate-700">Total documentos:</span> 4</span>
          <span><span className="font-medium text-slate-700">Última actualización:</span> Hoy</span>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Informe de investigación</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Borrador</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Diagnóstico comercial</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Generado</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Plan estratégico</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Listo</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Propuesta comercial</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Generado</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
