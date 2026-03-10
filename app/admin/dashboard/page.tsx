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
import { getLeadHealthSummary } from "@/lib/crm/leadHealth";
import { getCommercialPriorities } from "@/lib/crm/priorityEngine";
import { PipelineSummary } from "@/components/crm/dashboard/PipelineSummary";
import { LeadHealthSummary } from "@/components/crm/dashboard/LeadHealthSummary";
import { CommercialPriorities } from "@/components/crm/dashboard/CommercialPriorities";
import { CommercialAlerts } from "@/components/crm/dashboard/CommercialAlerts";
import { ActivityStateSummary } from "@/components/crm/dashboard/ActivityStateSummary";
import { StalledLeads } from "@/components/crm/dashboard/StalledLeads";
import { ConversionMetrics } from "@/components/crm/dashboard/ConversionMetrics";
import { TopOpportunities } from "@/components/crm/dashboard/TopOpportunities";
import Link from "next/link";

type Lead = {
  id: string;
  nombre: string | null;
  pipeline: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  rating?: number | null;
  email?: string | null;
  telefono?: string | null;
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
    rating: l.rating,
  };
}

const CLOSED_PIPELINES = new Set(["ganado", "perdido", "cerrado", "no interesado"]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetch("/api/admin/leads", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
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
        if (!cancelled) setError(e?.message ?? "Error cargando datos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const forMetrics = useMemo(() => leads.map(toLeadForMetrics), [leads]);
  const activeLeads = useMemo(
    () => leads.filter((l) => !CLOSED_PIPELINES.has(norm(l.pipeline))),
    [leads]
  );

  const pipelineCounts = useMemo(() => getPipelineSummary(forMetrics), [forMetrics]);
  const leadHealthSummary = useMemo(() => getLeadHealthSummary(forMetrics), [forMetrics]);
  const commercialPriorities = useMemo(() => getCommercialPriorities(forMetrics, 5), [forMetrics]);
  const commercialAlerts = useMemo(() => getCommercialAlerts(forMetrics, 8), [forMetrics]);
  const stalledLeads = useMemo(() => getStalledLeads(forMetrics, 10), [forMetrics]);
  const conversionPairs = useMemo(() => getConversionMetrics(forMetrics), [forMetrics]);
  const topOpportunities = useMemo(() => getTopOpportunities(forMetrics, 5), [forMetrics]);

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard comercial completo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Resumen ejecutivo del pipeline, alertas y oportunidades activas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <PipelineSummary
              pipelineCounts={pipelineCounts}
              totalActive={activeLeads.length}
            />
            <LeadHealthSummary summary={leadHealthSummary} />
            <CommercialPriorities priorities={commercialPriorities} />
            <CommercialAlerts alerts={commercialAlerts} />
            <ActivityStateSummary alerts={commercialAlerts} />
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
