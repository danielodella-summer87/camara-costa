"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { getLeadsOkMacroFlow, type LeadForLeadsOkMacro, type LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";
import { getLeadsOkMicroFlow } from "@/lib/crm/leadsOkMicroFlow";
import {
  getPresentationPrimaryUrl,
  isLikelyEmbedBlocked,
  PRESENTATION_POPUP_FEATURES,
  PRESENTATION_POPUP_NAME,
} from "@/lib/leads/presentationUtils";
import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { GuiaEstrategicaProceso } from "../components/GuiaEstrategicaProceso";
import RubroSelect from "../../empresas/RubroSelect";

function getWorkspaceFrameSrc(leadId: string, microStepId: number): string {
  if (microStepId === 6) return `/admin/leads/${leadId}/presentacion`;
  if (microStepId === 4) return `/admin/leads/${leadId}?tab=consultor&section=services-proposal`;
  if (microStepId === 5) return `/admin/leads/${leadId}?tab=consultor&section=proposal-export`;
  return `/admin/leads/${leadId}?tab=comercial&section=ia-report-block`;
}

const PROGRESS_STAGES = ["Lead", "Investigación", "Diagnóstico", "Estrategia", "Servicios", "Propuesta", "Presentación", "Cierre"];

export default function Leads87DetailPage() {
  const params = useParams();
  const rawId = (params as { id?: string | string[] })?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId ?? null;

  const workspaceRef = useRef<HTMLDivElement>(null);
  const fichaRef = useRef<HTMLDivElement>(null);
  const [fullLead, setFullLead] = useState<LeadForLeadsOkMacro | null>(null);
  const [documents, setDocuments] = useState<LeadsOkDocuments | null>(null);
  const [loadingLead, setLoadingLead] = useState(true);
  const [activeWorkspaceStep, setActiveWorkspaceStep] = useState<number>(1);
  const [reportGeneratedLocally, setReportGeneratedLocally] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<number>(1);
  const [fichaLeadOpen, setFichaLeadOpen] = useState(false);
  const [presentationGammaUrl, setPresentationGammaUrl] = useState<string | null>(null);
  const [presentationPdfUrl, setPresentationPdfUrl] = useState<string | null>(null);
  const [editingFicha, setEditingFicha] = useState(false);
  const [savingFicha, setSavingFicha] = useState(false);
  const [fichaError, setFichaError] = useState<string | null>(null);
  type FichaForm = {
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    website: string;
    linkedin_empresa: string;
    linkedin_director: string;
    rubro_id: string | null;
    origen: string;
    objetivos: string;
    audiencia: string;
    tamano: string;
  };
  const [editForm, setEditForm] = useState<FichaForm>({
    nombre: "",
    contacto: "",
    email: "",
    telefono: "",
    website: "",
    linkedin_empresa: "",
    linkedin_director: "",
    rubro_id: null,
    origen: "",
    objetivos: "",
    audiencia: "",
    tamano: "",
  });

  const goToWorkspace = useCallback((stepId: number) => {
    setActiveWorkspaceStep(stepId);
    setExpandedStepId(stepId);
    setTimeout(() => workspaceRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }, []);

  useEffect(() => {
    if (!id?.trim()) {
      setFullLead(null);
      setDocuments(null);
      setLoadingLead(false);
      return;
    }
    let cancelled = false;
    setLoadingLead(true);
    Promise.all([
      fetch(`/api/admin/leads/${id}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([leadRes, docsRes]) => {
        if (cancelled) return;
        setFullLead((leadRes?.data ?? null) as LeadForLeadsOkMacro | null);
        setDocuments(docsRes?.ok && docsRes?.documents ? docsRes.documents : null);
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
  }, [id]);

  useEffect(() => {
    if (!id) setReportGeneratedLocally(false);
  }, [id]);

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

  const activeMacro = useMemo(() => macroStages.find((s) => s.status === "active"), [macroStages]);
  const activeMicro = useMemo(() => microSteps.find((s) => s.status === "active"), [microSteps]);

  /** Índice de etapa activa 0–7 para stepper y guía estratégica. */
  const currentStageIndex = activeMacro != null ? (activeMacro.id - 1) : 0;

  useEffect(() => {
    if (activeMicro) {
      setActiveWorkspaceStep(activeMicro.id);
      setExpandedStepId(activeMicro.id);
    }
  }, [id, activeMicro?.id]);

  const refetchLead = useCallback(() => {
    if (!id?.trim()) return;
    Promise.all([
      fetch(`/api/admin/leads/${id}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([leadRes, docsRes]) => {
      setFullLead((leadRes?.data ?? null) as LeadForLeadsOkMacro | null);
      setDocuments(docsRes?.ok && docsRes?.documents ? docsRes.documents : null);
      if ((leadRes?.data as LeadForLeadsOkMacro)?.ai_report?.trim()) setReportGeneratedLocally(false);
    });
  }, [id]);

  const handleReportGenerated = useCallback(() => {
    setReportGeneratedLocally(true);
    refetchLead();
  }, [refetchLead]);

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

  const startEditingFicha = useCallback(() => {
    if (!fullLead) return;
    const lead = fullLead as LeadForLeadsOkMacro & {
      empresa_id?: string | null;
      empresas?: { id?: string; nombre?: string | null; rubro_id?: string | null; rubros?: { id?: string | null } | null } | null;
      website?: string | null;
      linkedin_empresa?: string | null;
      linkedin_director?: string | null;
      origen?: string | null;
      objetivos?: string | null;
      audiencia?: string | null;
      tamano?: string | null;
    };
    setEditForm({
      nombre: (lead.empresas?.nombre ?? lead.nombre ?? "").trim(),
      contacto: (lead.contacto ?? "").trim(),
      email: (lead.email ?? "").trim(),
      telefono: (lead.telefono ?? "").trim(),
      website: (lead.website ?? "").trim(),
      linkedin_empresa: (lead.linkedin_empresa ?? "").trim(),
      linkedin_director: (lead.linkedin_director ?? "").trim(),
      rubro_id: lead.empresas?.rubro_id ?? (lead.empresas as { rubros?: { id?: string | null } | null })?.rubros?.id ?? null,
      origen: (lead.origen ?? "").trim(),
      objetivos: (lead.objetivos ?? "").trim(),
      audiencia: (lead.audiencia ?? "").trim(),
      tamano: (lead.tamano ?? "").trim(),
    });
    setEditingFicha(true);
    setFichaError(null);
  }, [fullLead]);

  const saveFicha = useCallback(async () => {
    if (!id?.trim() || !fullLead?.id) return;
    setSavingFicha(true);
    setFichaError(null);
    try {
      const body: Record<string, string | null | boolean> = {
        nombre: editForm.nombre.trim() || null,
        contacto: editForm.contacto.trim() || null,
        email: editForm.email.trim() || null,
        telefono: editForm.telefono.trim() || null,
        website: editForm.website.trim() || null,
        linkedin_empresa: editForm.linkedin_empresa.trim() || null,
        linkedin_director: editForm.linkedin_director.trim() || null,
        origen: editForm.origen.trim() || null,
        objetivos: editForm.objetivos.trim() || null,
        audiencia: editForm.audiencia.trim() || null,
        tamano: editForm.tamano.trim() || null,
      };
      if (!editForm.linkedin_empresa.trim() && !editForm.linkedin_director.trim()) body.allow_clear_linkedin = true;
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok) {
        setFichaError(json?.error ?? "Error al guardar");
        return;
      }
      const empresaId = (fullLead as { empresa_id?: string | null; empresas?: { id?: string } | null }).empresa_id ?? (fullLead as { empresas?: { id?: string } | null }).empresas?.id;
      if (empresaId) {
        const rubroIdToSave = (editForm.rubro_id && String(editForm.rubro_id).trim()) || null;
        const empRes = await fetch(`/api/admin/empresas/${encodeURIComponent(empresaId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ rubro_id: rubroIdToSave }),
        });
        if (!empRes.ok) {
          const empJson = (await empRes.json()) as { error?: string };
          setFichaError(empJson?.error ?? "Error al guardar rubro");
          return;
        }
      }
      setEditingFicha(false);
      refetchLead();
    } catch (e) {
      setFichaError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingFicha(false);
    }
  }, [id, fullLead, editForm, refetchLead]);

  const goToFichaAndEdit = useCallback(() => {
    setFichaLeadOpen(true);
    setEditingFicha(false);
    startEditingFicha();
    setTimeout(() => fichaRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [startEditingFicha]);

  const leadDisplayName = (fullLead?.nombre?.trim() || fullLead?.empresas?.nombre?.trim() || id || "—") as string;
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

  if (!id) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-600">ID de lead no válido.</p>
      </PageContainer>
    );
  }

  const leadWithExtras = fullLead as LeadForLeadsOkMacro & {
    empresa_id?: string | null;
    empresas?: { nombre?: string | null; web?: string | null; rubros?: { nombre?: string | null } | null } | null;
    comerciales?: { id?: string; nombre?: string } | null;
    comercial?: { id?: string; nombre?: string } | null;
    website?: string | null;
    linkedin_empresa?: string | null;
    linkedin_director?: string | null;
  };
  const comercialNombre = leadWithExtras?.comercial?.nombre ?? (Array.isArray(leadWithExtras?.comerciales) ? leadWithExtras?.comerciales?.[0]?.nombre : leadWithExtras?.comerciales?.nombre) ?? null;
  const rubroNombre = leadWithExtras?.empresas?.rubros?.nombre ?? null;
  const web = leadWithExtras?.website ?? leadWithExtras?.empresas?.web ?? null;
  const linkedin = leadWithExtras?.linkedin_empresa ?? leadWithExtras?.linkedin_director ?? null;

  function cell(v: string | null | undefined): string {
    const t = typeof v === "string" ? v.trim() : "";
    return t || "—";
  }

  return (
    <PageContainer>
      {/* Header + Ficha del lead (contexto) */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/leads87" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
            ← LEADS87
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          LEADS87 —{" "}
          {!loadingLead && fullLead ? (
            <button
              type="button"
              onClick={() => setFichaLeadOpen((o) => !o)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              aria-expanded={fichaLeadOpen}
            >
              <span className={leadDisplayName === "—" ? "text-slate-500 font-medium" : "text-emerald-700 font-semibold hover:text-emerald-800"}>
                {leadDisplayName}
              </span>
              <span className="text-slate-400" aria-hidden>{fichaLeadOpen ? "▼" : "▶"}</span>
            </button>
          ) : (
            <span className={leadDisplayName === "—" ? "text-slate-500 font-medium" : "text-emerald-700 font-semibold"}>{loadingLead ? "Cargando…" : leadDisplayName}</span>
          )}
        </h1>
        <p className="mt-2 text-sm text-slate-600">Versión definitiva del sistema comercial. Un solo flujo, toda la información.</p>

        {!loadingLead && fullLead && fichaLeadOpen && (
          <div ref={fichaRef} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto del lead</span>
              {!editingFicha ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={startEditingFicha}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  <Link
                    href={`/admin/oportunidades/${id}`}
                    className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    Abrir en Oportunidades
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingFicha(false); setFichaError(null); }}
                    disabled={savingFicha}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveFicha}
                    disabled={savingFicha}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingFicha ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              )}
            </div>
            {fichaError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{fichaError}</p>
            )}
            {editingFicha ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <label className="block text-xs text-slate-500">Empresa</label>
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
                  <label className="block text-xs text-slate-500">Web</label>
                  <input
                    type="text"
                    value={editForm.website}
                    onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Rubro</label>
                  <div className="mt-0.5">
                    {(leadWithExtras?.empresa_id ?? (leadWithExtras?.empresas as { id?: string } | null)?.id) ? (
                      <RubroSelect
                        value={editForm.rubro_id ?? null}
                        onChange={(nextId) => setEditForm((f) => ({ ...f, rubro_id: nextId }))}
                        placeholder="Seleccionar rubro…"
                      />
                    ) : (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">Sin empresa vinculada</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500">LinkedIn (empresa o director)</label>
                  <div className="mt-0.5 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Empresa"
                      value={editForm.linkedin_empresa}
                      onChange={(e) => setEditForm((f) => ({ ...f, linkedin_empresa: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Director"
                      value={editForm.linkedin_director}
                      onChange={(e) => setEditForm((f) => ({ ...f, linkedin_director: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Origen</label>
                  <input
                    type="text"
                    value={editForm.origen}
                    onChange={(e) => setEditForm((f) => ({ ...f, origen: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Objetivo</label>
                  <input
                    type="text"
                    value={editForm.objetivos}
                    onChange={(e) => setEditForm((f) => ({ ...f, objetivos: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Audiencia</label>
                  <input
                    type="text"
                    value={editForm.audiencia}
                    onChange={(e) => setEditForm((f) => ({ ...f, audiencia: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Tamaño</label>
                  <input
                    type="text"
                    value={editForm.tamano}
                    onChange={(e) => setEditForm((f) => ({ ...f, tamano: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><p className="text-xs text-slate-500">Empresa</p><p className="font-medium text-slate-800">{cell(leadWithExtras?.empresas?.nombre ?? fullLead?.nombre)}</p></div>
                <div><p className="text-xs text-slate-500">Contacto</p><p className="font-medium text-slate-800">{cell(fullLead?.contacto)}</p></div>
                <div><p className="text-xs text-slate-500">Email</p><p className="font-medium text-slate-800">{cell(fullLead?.email)}</p></div>
                <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium text-slate-800">{cell(fullLead?.telefono)}</p></div>
                <div><p className="text-xs text-slate-500">Rubro</p><p className="font-medium text-slate-800">{cell(rubroNombre)}</p></div>
                <div><p className="text-xs text-slate-500">Web</p><p className="font-medium text-slate-800">{cell(web)}</p></div>
                <div className="col-span-2"><p className="text-xs text-slate-500">LinkedIn</p><p className="font-medium text-slate-800">{cell(linkedin)}</p></div>
                <div><p className="text-xs text-slate-500">Origen</p><p className="font-medium text-slate-800">{cell((fullLead as { origen?: string | null }).origen)}</p></div>
                <div><p className="text-xs text-slate-500">Objetivo</p><p className="font-medium text-slate-800">{cell((fullLead as { objetivos?: string | null }).objetivos)}</p></div>
                <div><p className="text-xs text-slate-500">Responsable</p><p className="font-medium text-slate-800">{cell(comercialNombre)}</p></div>
                <div><p className="text-xs text-slate-500">Pipeline</p><p className="font-medium text-slate-800">{cell(fullLead?.pipeline)}</p></div>
                <p className="col-span-2 mt-2 text-xs text-slate-500">Pipeline y responsable solo se editan en Oportunidades.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* A) Stepper horizontal superior */}
      {!loadingLead && fullLead && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-4">
          {PROGRESS_STAGES.map((label, i) => {
            const completed = currentStageIndex > i;
            const active = currentStageIndex === i;
            const pending = currentStageIndex < i;
            const cn = completed
              ? "rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
              : active
                ? "rounded-full border-2 border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 animate-pulse"
                : "rounded-full border border-orange-200 bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800";
            const icon = completed ? "✓" : active ? "●" : "○";
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

      {loadingLead && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm text-slate-600">Cargando oportunidad…</p>
        </div>
      )}

      {!loadingLead && !fullLead && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm text-slate-700">Lead no encontrado.</p>
        </div>
      )}

      {!loadingLead && fullLead && (
        <>
          {/* Bloque siguiente acción recomendada */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-800">Lead:</span> {leadDisplayName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Etapa macro:</span> {activeMacro?.title ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Paso micro:</span> {activeMicro?.title ?? "—"}
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
                  <p className="mt-2 text-xs text-slate-500">Completá los datos del lead en la ficha de abajo (empresa, contacto, email, objetivos, etc.) para habilitar el siguiente paso.</p>
                  <button
                    type="button"
                    onClick={goToFichaAndEdit}
                    className="mt-3 w-full rounded-lg bg-slate-800 px-4 py-3 text-base font-medium text-white hover:bg-slate-700"
                  >
                    Completar datos aquí
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-800">Siguiente acción recomendada</p>
                  <p className="mt-0.5 text-sm text-slate-600">{nextAction}</p>
                  <button
                    type="button"
                    disabled={isComplete || !activeMicro}
                    onClick={() => activeMicro && handleStepAction(activeMicro.id)}
                    className={`mt-3 w-full rounded-lg px-4 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                      isComplete || !activeMicro ? "cursor-not-allowed bg-slate-200 text-slate-600" : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {nextAction}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Progreso del proceso comercial */}
          {macroStages.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-slate-700">Progreso del proceso comercial</h3>
              {(() => {
                const total = 8;
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
                          role="progressbar"
                          aria-valuenow={percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Progreso del proceso comercial"
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

          {/* B) Flujo macro del proceso */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Flujo macro del proceso</h2>
            <p className="mt-0.5 text-sm text-slate-500">Etapas calculadas según datos reales del lead.</p>
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
                        <li key={i} className={`flex items-center gap-2 text-xs ${item.done ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
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

          {/* C) Bloques del análisis comercial */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Bloques del análisis comercial</h3>
            <p className="mt-1 text-xs text-slate-600">El análisis comercial genera estos bloques para apoyar las siguientes etapas.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          </div>

          {/* D) Flujo micro + Workspace del paso activo */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Guía de pasos y workspace</h2>
            <p className="mt-0.5 text-sm text-slate-500">Pasos detallados y herramientas del paso activo.</p>
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
                    <span className={step.status === "completed" ? "text-slate-800" : step.status === "active" ? "font-semibold text-slate-900" : "text-slate-500"}>
                      {step.title}
                    </span>
                    {step.status === "completed" && <span className="ml-auto text-xs text-emerald-700">Completado</span>}
                    {step.status === "active" && <span className="ml-auto text-xs font-medium text-emerald-700">Activo</span>}
                  </summary>
                  <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                    {step.status === "pending" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-center">
                        <p className="text-sm font-medium text-amber-900">Primero completa el paso anterior</p>
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
                              <span aria-hidden>🔒</span> Análisis ya generado
                            </div>
                            <button
                              type="button"
                              onClick={() => goToWorkspace(2)}
                              className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                            >
                              Ir a diagnóstico comercial
                            </button>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => goToWorkspace(1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ir a ver informe comercial
                              </button>
                              <button type="button" onClick={() => goToWorkspace(1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ir al workspace para regenerar análisis
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-slate-800">Acción recomendada</p>
                            <button type="button" onClick={() => goToWorkspace(1)} className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
                              Generar análisis comercial
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {step.status !== "pending" && step.subSteps.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {step.subSteps.map((sub, i) => (
                          <li key={i} className={`flex items-center gap-2 text-xs ${sub.status === "done" ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                              {sub.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
                            </span>
                            {sub.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {step.status !== "pending" && <p className="text-xs text-slate-500"><span className="font-medium text-slate-600">Qué obtiene:</span> {step.queObtiene}</p>}
                    {step.status !== "pending" && step.id >= 2 && step.id <= 6 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => handleStepAction(step.id)}
                          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium ${
                            step.status === "active" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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

          {/* E) Workspace del paso activo */}
          <div ref={workspaceRef} className="mt-8 scroll-mt-6">
            <h2 className="text-lg font-semibold text-slate-900">Workspace del paso activo</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Paso {activeWorkspaceStep}: {activeWorkspaceStep === 1 && "Análisis del lead"}
              {activeWorkspaceStep === 2 && "Diagnóstico comercial"}
              {activeWorkspaceStep === 3 && "Estrategia de crecimiento"}
              {activeWorkspaceStep === 4 && "Estructura de servicios"}
              {activeWorkspaceStep === 5 && "Propuesta comercial"}
              {activeWorkspaceStep === 6 && "Presentación para el cliente"}
            </p>
            <div className="mt-4 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm min-h-[320px]">
              {activeWorkspaceStep >= 1 && activeWorkspaceStep <= 3 ? (
                <AiLeadReport
                  key={`leads87-ai-${id}-${activeWorkspaceStep}`}
                  leadId={id}
                  lead={fullLead as any}
                  allowedProfiles={["comercial"]}
                  initialProfile="comercial"
                  onBeforeGenerate={async () => {}}
                  onPromptSaved={refetchLead}
                  onReportGenerated={handleReportGenerated}
                  onPresentationSignalChange={(signal) => {
                    if (signal?.gammaUrl != null) setPresentationGammaUrl(signal.gammaUrl ?? null);
                    if (signal?.pdfUrl != null) setPresentationPdfUrl(signal.pdfUrl ?? null);
                  }}
                  titleLabel={
                    activeWorkspaceStep === 1 ? "Paso 1 — Análisis del lead (IA)" :
                    activeWorkspaceStep === 2 ? "Paso 2 — Diagnóstico comercial" :
                    "Paso 3 — Estrategia de crecimiento"
                  }
                  subtitleLabel="Este análisis genera la base que alimenta el diagnóstico y la visión estratégica."
                  buttonHelperText="Usa IA para analizar el lead y generar el informe comercial."
                  buttonTooltipContent="Ejecuta el análisis con IA."
                />
              ) : (
                <iframe
                  title={`Workspace paso ${activeWorkspaceStep}`}
                  src={getWorkspaceFrameSrc(id, activeWorkspaceStep)}
                  className="w-full min-h-[600px] rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>

          {/* Reportes y documentos */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Reportes y documentos</h2>
            <p className="mt-0.5 text-xs text-slate-500">Entregables del proceso. Ver y descargar desde el workspace si hace falta.</p>

            <div className="mt-5 space-y-2.5">
              {/* Informe comercial */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">Informe comercial</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    (fullLead?.ai_report?.trim() || reportGeneratedLocally)
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {(fullLead?.ai_report?.trim() || reportGeneratedLocally) ? "Generado" : "No generado"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(fullLead?.ai_report?.trim() || reportGeneratedLocally) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => goToWorkspace(1)}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Ir a ver informe
                      </button>
                      <button
                        type="button"
                        onClick={() => goToWorkspace(1)}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Ir a ver / descargar PDF
                      </button>
                    </>
                  ) : (
                    <span
                      title="Completa el paso anterior para desbloquear"
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-500 opacity-50"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
                      </svg>
                      Bloqueado
                    </span>
                  )}
                </div>
              </div>

              {/* Gamma comercial */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">Gamma comercial</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    presentationGammaUrl
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {presentationGammaUrl ? "Listo" : "No generado"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {presentationGammaUrl ? (
                    <button
                      type="button"
                      onClick={() => window.open(presentationGammaUrl, "_blank")}
                      className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Abrir Gamma
                    </button>
                  ) : (
                    <span
                      title="Completa el paso anterior para desbloquear"
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-500 opacity-50"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
                      </svg>
                      Bloqueado
                    </span>
                  )}
                </div>
              </div>

              {/* Diagnóstico, Estrategia, Propuesta (preparados) */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">Diagnóstico / Estrategia / Propuesta</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {documents?.diagnostic ? "Diagnóstico listo" : documents?.strategy ? "Estrategia listo" : documents?.proposal ? "Propuesta listo" : "Según etapa"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => goToWorkspace(2)}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Ir al workspace (diagnóstico / estrategia / propuesta)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* F) Guía estratégica del proceso */}
          <div className="mt-8">
            <GuiaEstrategicaProceso currentStageIndex={currentStageIndex} />
          </div>
        </>
      )}
    </PageContainer>
  );
}
