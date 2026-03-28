"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { OportunidadWorkspace } from "../components/OportunidadWorkspace";
import RubroSelect from "../../empresas/RubroSelect";
import Link from "next/link";

/** Forma mínima del lead devuelta por GET /api/admin/leads/[id] (empresas incluye rubro_id y rubros). */
type LeadMinimal = {
  id?: string | null;
  empresa_id?: string | null;
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  linkedin_director?: string | null;
  pipeline?: string | null;
  empresas?: {
    id?: string | null;
    nombre?: string | null;
    rubro_id?: string | null;
    rubros?: { id?: string | null; nombre?: string | null } | null;
  } | null;
};

function format(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

function normPipeline(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPipelineNuevo(pipeline: string | null | undefined): boolean {
  return normPipeline(pipeline) === "nuevo";
}

/** Índice de etapa (0–7) según pipeline, alineado con OportunidadWorkspace. */
const PIPELINE_TO_STAGE: Record<string, number> = {
  nuevo: 0,
  contactado: 1,
  investigacion: 1,
  analisis: 2,
  diagnostico: 2,
  estrategia: 3,
  servicios: 4,
  propuesta: 5,
  presentacion: 6,
  seguimiento: 7,
  cierre: 7,
};

const PROGRESS_STAGES = ["Lead", "Investigación", "Diagnóstico", "Estrategia", "Servicios", "Propuesta", "Presentación", "Cierre"];

function getCurrentStageIndex(pipeline: string | null | undefined): number | null {
  const key = normPipeline(pipeline);
  if (!key) return null;
  const idx = PIPELINE_TO_STAGE[key];
  return typeof idx === "number" ? idx : null;
}

/** Si la etapa está en error o bloqueada (preparado para lógica futura). */
function isStageBlockedOrError(_lead: LeadMinimal | null, _stageIndex: number): boolean {
  return false;
}

function hasValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** true si empresa/nombre, contacto y (email o teléfono) están completos (etapa Lead lista para avanzar). */
function isLeadComplete(lead: LeadMinimal | null): boolean {
  if (!lead) return false;
  const empresa = lead.empresas?.nombre ?? lead.nombre;
  const contacto = lead.contacto;
  const emailOrPhone = hasValue(lead.email) || hasValue(lead.telefono);
  return hasValue(empresa) && hasValue(contacto) && emailOrPhone;
}

/** Alias para compatibilidad. */
const isRequiredLeadDataComplete = isLeadComplete;

/** Lista de datos mínimos que faltan para completar la etapa Lead. */
function getLeadMissingRequired(lead: LeadMinimal | null): string[] {
  if (!lead) return ["Empresa", "Contacto", "Email o teléfono"];
  const missing: string[] = [];
  const empresa = lead.empresas?.nombre ?? lead.nombre;
  if (!hasValue(empresa)) missing.push("Empresa o nombre");
  if (!hasValue(lead.contacto)) missing.push("Contacto");
  if (!hasValue(lead.email) && !hasValue(lead.telefono)) missing.push("Email o teléfono");
  return missing;
}

/** Nombres de campos recomendados que faltan. */
function getMissingRecommendedFields(lead: LeadMinimal | null): string[] {
  if (!lead) return [];
  const missing: string[] = [];
  if (!hasValue(lead.empresas?.rubros?.nombre)) missing.push("Rubro");
  if (!hasValue(lead.website)) missing.push("Web");
  const linkedin = lead.linkedin_empresa ?? lead.linkedin_personal ?? lead.linkedin_director;
  if (!hasValue(linkedin)) missing.push("LinkedIn");
  return missing;
}

export default function OportunidadDetailPage() {
  const params = useParams();
  const rawId = (params as { id?: string | string[] })?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId ?? null;

  const [lead, setLead] = useState<LeadMinimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [editForm, setEditForm] = useState<{
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    website: string;
    linkedin_empresa: string;
    linkedin_personal: string;
    rubro_id: string | null;
  }>({ nombre: "", contacto: "", email: "", telefono: "", website: "", linkedin_empresa: "", linkedin_personal: "", rubro_id: null });
  const focusContextoRef = useRef<(() => void) | null>(null);
  const focusInvestigacionRef = useRef<(() => void) | null>(null);
  const focusWorkspaceStageRef = useRef<((stageIndex: number) => void) | null>(null);
  const [datosLeadOpen, setDatosLeadOpen] = useState(false);

  /** Única fuente de verdad: etapa activa. Si Lead está completada y pipeline sigue "nuevo", la etapa activa es Investigación (1). */
  const activeStageIndex = (() => {
    const fromPipeline = getCurrentStageIndex(lead?.pipeline);
    if (fromPipeline === null) return 0;
    if (fromPipeline === 0 && lead && isLeadComplete(lead)) return 1;
    return fromPipeline;
  })();

  const refetchLead = useCallback(() => {
    if (!id) return;
    fetch(`/api/admin/leads/${id}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    })
      .then(async (res) => {
        const json = (await res.json()) as { data?: LeadMinimal; error?: string };
        if (!res.ok) {
          setError(json?.error ?? "Error cargando lead");
          setLead(null);
          return;
        }
        setLead(json?.data ?? null);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Error cargando oportunidad");
        setLead(null);
      });
  }, [id]);

  const startEditing = useCallback(() => {
    if (!lead) return;
    setEditForm({
      nombre: (lead.empresas?.nombre ?? lead.nombre ?? "").trim(),
      contacto: (lead.contacto ?? "").trim(),
      email: (lead.email ?? "").trim(),
      telefono: (lead.telefono ?? "").trim(),
      website: (lead.website ?? "").trim(),
      linkedin_empresa: (lead.linkedin_empresa ?? "").trim(),
      linkedin_personal: (lead.linkedin_personal ?? lead.linkedin_director ?? "").trim(),
      rubro_id: lead.empresas?.rubro_id ?? lead.empresas?.rubros?.id ?? null,
    });
    setEditingLead(true);
  }, [lead]);

  const saveLeadData = useCallback(async () => {
    if (!id || !lead?.id) return;
    setSavingLead(true);
    try {
      const body: Record<string, string | null | boolean> = {
        nombre: editForm.nombre || null,
        contacto: editForm.contacto || null,
        email: editForm.email || null,
        telefono: editForm.telefono || null,
        website: editForm.website || null,
        linkedin_empresa: editForm.linkedin_empresa || null,
        linkedin_personal: editForm.linkedin_personal || null,
      };
      if (!editForm.linkedin_empresa && !editForm.linkedin_personal) body.allow_clear_linkedin = true;
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: LeadMinimal; error?: string };
      if (!res.ok) {
        setError(json?.error ?? "Error al guardar");
        return;
      }
      const empresaId = lead.empresa_id ?? lead.empresas?.id;
      if (empresaId) {
        const rubroIdToSave = (editForm.rubro_id && String(editForm.rubro_id).trim()) || null;
        const empRes = await fetch(`/api/admin/empresas/${encodeURIComponent(empresaId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ rubro_id: rubroIdToSave }),
        });
        if (!empRes.ok) {
          const empJson = (await empRes.json()) as { error?: string };
          setError(empJson?.error ?? "Error al guardar rubro");
          return;
        }
      }
      setEditingLead(false);
      setError(null);
      refetchLead();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingLead(false);
    }
  }, [id, lead?.id, editForm, refetchLead]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    fetch(`/api/admin/leads/${id}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    })
      .then(async (res) => {
        const json = (await res.json()) as { data?: LeadMinimal; error?: string };
        if (!res.ok) {
          setError(json?.error ?? "Error cargando lead");
          setLead(null);
          return;
        }
        setLead(json?.data ?? null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Error cargando oportunidad");
        setLead(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const leadDisplayName = (lead?.empresas?.nombre ?? lead?.nombre ?? "").trim() || "Sin nombre";

  return (
    <PageContainer>
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/oportunidades" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
            ← Oportunidades
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Oportunidad —{" "}
          {!loading && lead ? (
            <button
              type="button"
              onClick={() => setDatosLeadOpen((o) => !o)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              aria-expanded={datosLeadOpen}
            >
              <span className={leadDisplayName === "Sin nombre" ? "text-slate-500 font-medium" : "text-emerald-700 font-semibold hover:text-emerald-800"}>
                {leadDisplayName}
              </span>
              <span className="text-slate-400" aria-hidden>
                {datosLeadOpen ? "↓" : "↑"}
              </span>
            </button>
          ) : (
            <span className={leadDisplayName === "Sin nombre" ? "text-slate-500 font-medium" : "text-emerald-700 font-semibold"}>{leadDisplayName}</span>
          )}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {id ? `ID: ${id}` : "Sin ID"}
        </p>

        {!loading && lead && datosLeadOpen && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha del lead</span>
              {!editingLead ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Editar
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLead(false)}
                    disabled={savingLead}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveLeadData}
                    disabled={savingLead}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingLead ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              )}
            </div>
            {editingLead ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <label className="block text-xs text-slate-500">Empresa / Nombre</label>
                  <input
                    type="text"
                    value={editForm.nombre}
                    onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Contacto</label>
                  <input
                    type="text"
                    value={editForm.contacto}
                    onChange={(e) => setEditForm((f) => ({ ...f, contacto: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Email</label>
                  <input
                    type="text"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Teléfono</label>
                  <input
                    type="text"
                    value={editForm.telefono}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Rubro</label>
                  <div className="mt-0.5">
                    {lead.empresa_id ?? lead.empresas?.id ? (
                      <RubroSelect
                        value={editForm.rubro_id ?? null}
                        onChange={(nextId) => setEditForm((f) => ({ ...f, rubro_id: nextId }))}
                        placeholder="Seleccionar rubro…"
                      />
                    ) : (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">Sin empresa vinculada.</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Web</label>
                  <input
                    type="text"
                    value={editForm.website}
                    onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500">LinkedIn</label>
                  <input
                    type="text"
                    value={editForm.linkedin_empresa || editForm.linkedin_personal}
                    onChange={(e) => setEditForm((f) => ({ ...f, linkedin_empresa: e.target.value, linkedin_personal: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="URL LinkedIn empresa o perfil"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div><p className="text-xs text-slate-500">Empresa</p><p className="text-sm font-medium text-slate-800">{format(lead.empresas?.nombre ?? lead.nombre)}</p></div>
                <div><p className="text-xs text-slate-500">Contacto</p><p className="text-sm font-medium text-slate-800">{format(lead.contacto)}</p></div>
                <div><p className="text-xs text-slate-500">Email</p><p className="text-sm font-medium text-slate-800">{format(lead.email)}</p></div>
                <div><p className="text-xs text-slate-500">Teléfono</p><p className="text-sm font-medium text-slate-800">{format(lead.telefono)}</p></div>
                <div><p className="text-xs text-slate-500">Rubro</p><p className="text-sm font-medium text-slate-800">{format(lead.empresas?.rubros?.nombre)}</p></div>
                <div><p className="text-xs text-slate-500">Web</p><p className="text-sm font-medium text-slate-800">{format(lead.website)}</p></div>
                <div><p className="text-xs text-slate-500">LinkedIn</p><p className="text-sm font-medium text-slate-800">{format(lead.linkedin_empresa ?? lead.linkedin_personal ?? lead.linkedin_director)}</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && lead && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-4">
          {PROGRESS_STAGES.map((label, i) => {
            const currentIdx = activeStageIndex;
            const completed = currentIdx !== null && i < currentIdx;
            const active = currentIdx !== null && i === currentIdx;
            const pending = currentIdx !== null && i > currentIdx;
            const blocked = isStageBlockedOrError(lead, i);
            const state: "completed" | "active" | "pending" | "error" = blocked
              ? "error"
              : completed
                ? "completed"
                : active
                  ? "active"
                  : "pending";
            const cn =
              state === "error"
                ? "rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800"
                : state === "completed"
                  ? "rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                  : state === "active"
                    ? "rounded-full border-2 border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 animate-pulse"
                    : "rounded-full border border-orange-200 bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800";
            const icon = state === "error" ? "!" : state === "completed" ? "✓" : state === "active" ? "●" : "○";
            return (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-300">→</span>}
                <span className={`inline-flex items-center gap-2 ${cn}`}>
                  <span aria-hidden>{icon}</span>
                  <span>{label}</span>
                </span>
              </span>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm text-slate-600">Cargando oportunidad...</p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 p-5">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {!loading && id && !lead && !error && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm font-medium text-slate-700">Oportunidad no encontrada</p>
        </div>
      )}

      {!loading && lead && (
        <div className="mt-6 rounded-xl border-2 border-slate-300 bg-slate-50/80 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Siguiente paso recomendado</h2>
          {isPipelineNuevo(lead.pipeline) ? (
            <>
              {isLeadComplete(lead) ? (
                <>
                  <p className="mt-2 text-sm text-slate-600">Lead completo. Podés avanzar a investigación.</p>
                  {getMissingRecommendedFields(lead).length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Recomendado completar: {getMissingRecommendedFields(lead).join(", ")}.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      focusInvestigacionRef.current?.();
                      requestAnimationFrame(() => {
                        setTimeout(() => {
                          const target = document.getElementById("oportunidad-tab-investigacion");
                          target?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                      });
                    }}
                    className="mt-4 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Ir a investigación
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-600">Completa los datos mínimos antes de avanzar.</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                    {getLeadMissingRequired(lead).map((item) => (
                      <li key={item}>Falta: {item}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      focusContextoRef.current?.();
                      requestAnimationFrame(() => {
                        const target = document.getElementById("oportunidad-contexto");
                        target?.scrollIntoView({ behavior: "smooth" });
                      });
                    }}
                    className="mt-4 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Completar datos
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">Revisá el workspace según la etapa actual.</p>
              <button
                type="button"
                onClick={() => {
                  focusWorkspaceStageRef.current?.(activeStageIndex);
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      const target = document.getElementById("oportunidad-contexto");
                      target?.scrollIntoView({ behavior: "smooth" });
                    }, 50);
                  });
                }}
                className="mt-4 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Ir al workspace
              </button>
            </>
          )}
        </div>
      )}

      {!loading && lead && (
        <OportunidadWorkspace
          lead={lead}
          id={id}
          activeStageIndex={activeStageIndex}
          onLeadUpdated={refetchLead}
          focusContextoRef={focusContextoRef}
          focusInvestigacionRef={focusInvestigacionRef}
          focusWorkspaceStageRef={focusWorkspaceStageRef}
          onRequestEditLead={() => {
            setDatosLeadOpen(true);
            startEditing();
            requestAnimationFrame(() => {
              document.querySelector("[aria-expanded='true']")?.closest("div.border-b")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
        />
      )}
    </PageContainer>
  );
}
