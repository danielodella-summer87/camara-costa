"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { OportunidadWorkspace } from "./components/OportunidadWorkspace";

type LeadOption = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  email: string | null;
  pipeline: string | null;
  empresas?: { nombre?: string | null } | null;
};

const CLOSED_PIPELINES = new Set(["ganado", "perdido", "cerrado", "no interesado"]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function leadLabel(l: LeadOption): string {
  const empresa = l.empresas?.nombre?.trim();
  const contacto = l.contacto?.trim();
  const email = l.email?.trim();
  const nombre = l.nombre?.trim();
  const part = empresa || contacto || email || nombre || "Sin nombre";
  return part;
}

export default function OportunidadesPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingLeads(true);
    fetch("/api/admin/leads", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then(async (res) => {
        const json = (await res.json()) as { data?: LeadOption[]; error?: string };
        if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        const active = data.filter((l) => l?.id && !CLOSED_PIPELINES.has(norm(l.pipeline)));
        setLeads(active);
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLeads(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = () => {
    if (!selectedLeadId?.trim()) return;
    router.push(`/admin/oportunidades/${encodeURIComponent(selectedLeadId)}`);
  };

  return (
    <PageContainer>
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Oportunidades</h1>
        <p className="mt-2 text-sm text-slate-600">Workspace estratégico comercial</p>
      </div>

      {/* Abrir oportunidad */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Abrir oportunidad</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            disabled={loadingLeads}
            className="min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">
              {loadingLeads ? "Cargando leads..." : "Seleccioná un lead activo"}
            </option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {leadLabel(l)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleOpen}
            disabled={!selectedLeadId?.trim()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Abrir oportunidad
          </button>
        </div>
      </div>

      <OportunidadWorkspace lead={null} id={null} />
    </PageContainer>
  );
}
