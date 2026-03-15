"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { OportunidadWorkspace } from "../components/OportunidadWorkspace";
import Link from "next/link";

/** Forma mínima del lead devuelta por GET /api/admin/leads/[id] (misma fuente que leads/[id]/page). */
type LeadMinimal = {
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
};

function format(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

export default function OportunidadDetailPage() {
  const params = useParams();
  const rawId = (params as { id?: string | string[] })?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId ?? null;

  const [lead, setLead] = useState<LeadMinimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <PageContainer>
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/oportunidades" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
            ← Oportunidades
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Oportunidad</h1>
        <p className="mt-2 text-sm text-slate-600">
          {id ? `ID: ${id}` : "Sin ID"}
        </p>
      </div>

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
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Datos del lead</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="font-medium text-slate-700">Empresa</span>
              <p className="mt-0.5 text-slate-600">{format(lead.empresas?.nombre ?? lead.nombre)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Rubro</span>
              <p className="mt-0.5 text-slate-600">{format(lead.empresas?.rubros?.nombre)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Contacto</span>
              <p className="mt-0.5 text-slate-600">{format(lead.contacto)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Email</span>
              <p className="mt-0.5 text-slate-600">{format(lead.email)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Teléfono</span>
              <p className="mt-0.5 text-slate-600">{format(lead.telefono)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Web</span>
              <p className="mt-0.5 text-slate-600">{format(lead.website)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">LinkedIn</span>
              <p className="mt-0.5 text-slate-600">{format(lead.linkedin_empresa ?? lead.linkedin_director)}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && lead && (
        <OportunidadWorkspace lead={lead} id={id} />
      )}
    </PageContainer>
  );
}
