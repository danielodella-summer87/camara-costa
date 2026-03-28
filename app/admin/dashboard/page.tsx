"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  getPipelineSummary,
  getStalledLeads,
  getConversionMetrics,
  getTopOpportunities,
  getCommercialAlerts,
  type LeadForMetrics,
} from "@/lib/crm/metrics";
import { mergeDocumentsForFlow, getLeadMacroFlowDisplay } from "@/lib/crm/getLeadDerivedFlow";
import {
  toMacroLeadFromApiRow,
  getDashboardCommercialBucket,
  summarizeCommercialFlowKpis,
} from "@/lib/crm/dashboardCommercialFlow";
import type { LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";
import { getLeadHealthSummary } from "@/lib/crm/leadHealth";
import { getCommercialPriorities } from "@/lib/crm/priorityEngine";
import { CommercialFlowKpis } from "@/components/crm/dashboard/CommercialFlowKpis";
import { PipelineSummary } from "@/components/crm/dashboard/PipelineSummary";
import { LeadHealthSummary } from "@/components/crm/dashboard/LeadHealthSummary";
import { CommercialPriorities } from "@/components/crm/dashboard/CommercialPriorities";
import { CommercialAlerts } from "@/components/crm/dashboard/CommercialAlerts";
import { ActivityStateSummary } from "@/components/crm/dashboard/ActivityStateSummary";
import { StalledLeads } from "@/components/crm/dashboard/StalledLeads";
import { ConversionMetrics } from "@/components/crm/dashboard/ConversionMetrics";
import { TopOpportunities } from "@/components/crm/dashboard/TopOpportunities";
import {
  PropuestasEsperandoRespuesta,
  type PropuestaEnviadaLead,
} from "@/components/crm/dashboard/PropuestasEsperandoRespuesta";
import Link from "next/link";
import { isLeadActive } from "@/lib/leads/leadStatusPolicy";
import { APP_SUITE_CONFIG } from "@/lib/config/appSuiteConfig";

/** Normaliza string | null | undefined a string | null para tipos estrictos. */
function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

type Lead = {
  id: string;
  nombre: string | null;
  contacto?: string | null;
  pipeline: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  rating?: number | null;
  email?: string | null;
  telefono?: string | null;
  website?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  notas?: string | null;
  ai_report?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  proposal_reviewed?: boolean | null;
  commercial_stage?: string | null;
  commercial_strategy_json?: unknown;
  strategy_approved_at?: string | null;
  empresas?: { nombre?: string | null } | null;
  flow_documents?: LeadsOkDocuments;
  pending_agenda_accion?: { tipo: string; fecha_limite: string; hora?: string | null } | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

function toLeadForMetrics(l: Lead): LeadForMetrics {
  return {
    id: l.id,
    nombre: l.nombre,
    pipeline: l.pipeline,
    created_at: l.created_at,
    updated_at: l.updated_at,
    next_activity_type: l.next_activity_type,
    next_activity_at: l.next_activity_at,
    pending_agenda_accion: l.pending_agenda_accion ?? null,
    rating: l.rating,
    proposal_confirmed_at: l.proposal_confirmed_at,
    proposal_sent_at: l.proposal_sent_at,
  };
}

function enrichLeadForMetrics(l: Lead): LeadForMetrics {
  const macro = toMacroLeadFromApiRow(l);
  const docs = mergeDocumentsForFlow(macro, l.flow_documents ?? null);
  const snap = getLeadMacroFlowDisplay(macro, docs);
  const bucket = getDashboardCommercialBucket(macro, docs, l.pipeline);
  return {
    ...toLeadForMetrics(l),
    leads87Flow: {
      progress: snap.progress,
      stageLabel: snap.label,
      isFlowCompleted: snap.isFlowCompleted,
      bucket,
    },
    leads87_flow_completed: snap.isFlowCompleted,
  };
}

function daysSinceSent(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)));
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    const ac = new AbortController();
    const timeoutMs = 45_000;
    const timeoutId = window.setTimeout(() => ac.abort(), timeoutMs);

    fetch("/api/admin/leads", {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal: ac.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiResp<Lead[]>;
        if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        setLeads(data);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof Error && e.name === "AbortError") {
          setError(`La carga de leads superó ${timeoutMs / 1000}s. Revisá la red o la sesión.`);
        } else {
          setError(e instanceof Error ? e.message : "Error cargando datos");
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  const forMetrics = useMemo(() => leads.map(enrichLeadForMetrics), [leads]);
  const activeLeads = useMemo(() => leads.filter((l) => isLeadActive(l.pipeline)), [leads]);

  const commercialFlowKpis = useMemo(
    () =>
      summarizeCommercialFlowKpis(
        leads.map((l) => {
          const macro = toMacroLeadFromApiRow(l);
          const docs = mergeDocumentsForFlow(macro, l.flow_documents ?? null);
          return { macroLead: macro, documents: docs, pipeline: l.pipeline };
        })
      ),
    [leads]
  );

  const pipelineCounts = useMemo(() => getPipelineSummary(forMetrics), [forMetrics]);
  const leadHealthSummary = useMemo(() => getLeadHealthSummary(forMetrics), [forMetrics]);
  const commercialPriorities = useMemo(() => getCommercialPriorities(forMetrics, 5), [forMetrics]);
  const commercialAlerts = useMemo(() => getCommercialAlerts(forMetrics, 8), [forMetrics]);
  const stalledLeads = useMemo(() => getStalledLeads(forMetrics, 10), [forMetrics]);
  const conversionPairs = useMemo(() => getConversionMetrics(forMetrics), [forMetrics]);
  const topOpportunities = useMemo(() => getTopOpportunities(forMetrics, 5), [forMetrics]);

  const propuestasEsperandoRespuesta = useMemo((): PropuestaEnviadaLead[] => {
    return leads
      .filter(
        (l) =>
          l.proposal_confirmed_at &&
          l.proposal_sent_at &&
          isLeadActive(l.pipeline)
      )
      .map((l): PropuestaEnviadaLead => {
        const sentAt = normalizeNullableString(l.proposal_sent_at);
        return {
          id: String(l.id ?? ""),
          nombre: normalizeNullableString(l.nombre),
          pipeline: normalizeNullableString(l.pipeline),
          proposal_sent_at: sentAt,
          daysSinceSent: daysSinceSent(sentAt ?? l.proposal_sent_at),
        };
      })
      .slice(0, 10);
  }, [leads]);

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Suite:</span> {APP_SUITE_CONFIG.suiteName}
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-medium text-slate-800">Módulo activo principal:</span>{" "}
          {APP_SUITE_CONFIG.modules.leads.name}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard comercial completo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Resumen ejecutivo del pipeline, alertas y oportunidades activas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={APP_SUITE_CONFIG.modules.leads.href}
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {APP_SUITE_CONFIG.modules.leads.name}
            </Link>
            <Link
              href="/admin/agenda"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver Agenda
            </Link>
            <Link
              href="/admin/leads"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Lista
            </Link>
            <Link
              href="/admin/leads/kanban"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Kanban
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex justify-center py-12">
            <div className="text-slate-500">Cargando…</div>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <CommercialFlowKpis summary={commercialFlowKpis} />
            <PipelineSummary
              pipelineCounts={pipelineCounts}
              totalActive={activeLeads.length}
            />
            <LeadHealthSummary summary={leadHealthSummary} />
            <CommercialPriorities priorities={commercialPriorities} />
            <CommercialAlerts alerts={commercialAlerts} />
            <ActivityStateSummary alerts={commercialAlerts} />
            <PropuestasEsperandoRespuesta leads={propuestasEsperandoRespuesta} />
            <div className="grid gap-8 lg:grid-cols-2">
              <StalledLeads leads={stalledLeads} />
              <ConversionMetrics pairs={conversionPairs} />
            </div>
            <TopOpportunities leads={topOpportunities} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
