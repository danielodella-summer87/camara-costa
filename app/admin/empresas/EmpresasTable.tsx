"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import RubroSelect from "./RubroSelect";
import {
  badgeClassAiPriority,
  badgeClassAiRecommendation,
  getInitiativeAiAssessment,
  labelAiPriority,
  labelAiRecommendation,
} from "@/lib/ai/initiativeAssessment";
import {
  badgeClassDecisionBucket,
  decisionBucketFromEstado,
  esConvertidaVisualmente,
  labelDecisionBucket,
  matchesFiltroBucket,
  type FiltroIniciativaBucket,
} from "./iniciativaListUi";

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  rubro_id: string | null;
  estado: string | null;
  aprobada: boolean | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  instagram?: string | null;
  celular?: string | null;
  contacto_email?: string | null;
  contacto_celular?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
  created_at?: string;
  updated_at?: string;
  estado_revision?: string | null;
  fuente_remota?: string | null;
  score_preliminar?: number | null;
  converted_lead_id?: string | null;
};

type EmpresasApiResponse = {
  data?: Empresa[];
  error?: string | null;
};

type EmpresaApiResponse = {
  data?: Empresa | null;
  error?: string | null;
};

type Rubro = { id: string; nombre: string };
type RubrosApiResponse = { data?: Rubro[]; error?: string | null };

const FILTRO_CHIPS: { id: FiltroIniciativaBucket; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "nuevos", label: "Nuevos" },
  { id: "revisados", label: "Revisados" },
  { id: "convertidos", label: "Convertidos" },
  { id: "descartados", label: "Descartados" },
];

const GRID_HEAD =
  "grid grid-cols-[minmax(148px,1fr)_minmax(200px,1.05fr)_96px_minmax(92px,0.8fr)_76px_minmax(228px,1fr)] gap-x-2";

export default function EmpresasTable() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rows, setRows] = useState<Empresa[]>([]);

  const [q, setQ] = useState("");
  const [filtroBucket, setFiltroBucket] = useState<FiltroIniciativaBucket>("");

  const [editingRubroForId, setEditingRubroForId] = useState<string | null>(null);
  const [pendingRubroId, setPendingRubroId] = useState<string | null>(null);

  const rubroNombreToIdRef = useRef<Map<string, string> | null>(null);
  const rubroMapLoadingRef = useRef<Promise<Map<string, string>> | null>(null);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2800);
  }

  async function ensureRubroNombreToIdMap(): Promise<Map<string, string>> {
    if (rubroNombreToIdRef.current) return rubroNombreToIdRef.current;
    if (rubroMapLoadingRef.current) return rubroMapLoadingRef.current;

    rubroMapLoadingRef.current = (async () => {
      const res = await fetch("/api/admin/rubros", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as RubrosApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando rubros");

      const map = new Map<string, string>();
      (json?.data ?? []).forEach((r) => map.set(r.nombre, r.id));

      rubroNombreToIdRef.current = map;
      rubroMapLoadingRef.current = null;
      return map;
    })();

    return rubroMapLoadingRef.current;
  }

  async function fetchEmpresas() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/empresas", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as EmpresasApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando iniciativas");

      const list = Array.isArray(json?.data) ? json.data : [];
      setRows(
        list.map((e: any) => ({
          ...e,
          rubro_id: e?.rubro_id ?? null,
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? "Error cargando iniciativas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function patchEmpresa(
    id: string,
    payload: Partial<Pick<Empresa, "rubro_id" | "aprobada" | "estado" | "estado_revision">>
  ) {
    setError(null);
    setMutatingId(id);

    try {
      const res = await fetch(`/api/admin/empresas/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as EmpresaApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando iniciativa");

      const updated = json?.data ?? null;
      if (!updated) throw new Error("No se recibió la iniciativa actualizada");

      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ...updated, rubro_id: (updated as any).rubro_id ?? null } : r
        )
      );

      return updated;
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando iniciativa");
      throw e;
    } finally {
      setMutatingId(null);
    }
  }

  async function descartarFila(id: string) {
    if (!window.confirm("¿Descartar esta iniciativa? Podés volver a abrirla desde Detalle si hace falta.")) {
      return;
    }
    try {
      await patchEmpresa(id, { estado_revision: "descartada" });
      flash("Iniciativa marcada como descartada.");
    } catch {
      /* error en patchEmpresa */
    }
  }

  async function convertirFilaALead(id: string) {
    setError(null);
    setMutatingId(id);
    try {
      const res = await fetch(`/api/admin/empresas/${id}/convert-to-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 409) {
        const leadId = typeof json?.data?.lead_id === "string" ? json.data.lead_id.trim() : "";
        flash(
          leadId
            ? "Ya existe un lead vinculado. Actualizamos el listado."
            : "Conflicto al convertir. Revisá la ficha."
        );
        await fetchEmpresas();
        return;
      }

      if (!res.ok) {
        const msg =
          typeof json?.error === "string" ? json.error : "No se pudo convertir a lead.";
        setError(msg);
        return;
      }

      const leadId = json?.data?.lead_id;
      if (typeof leadId !== "string" || !leadId.trim()) {
        setError("No se recibió el identificador del lead creado.");
        return;
      }

      router.push(`/admin/leads87/${leadId.trim()}`);
    } catch (e: any) {
      setError(e?.message ?? "Error al convertir");
    } finally {
      setMutatingId(null);
    }
  }

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    let convertidas = 0;
    let descartadas = 0;
    for (const e of rows) {
      const k = (e.estado_revision ?? "").trim().toLowerCase();
      if (esConvertidaVisualmente(e.estado_revision, e.converted_lead_id)) convertidas += 1;
      if (k === "descartada") descartadas += 1;
    }
    return { total, convertidas, descartadas };
  }, [rows]);

  const empresasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = [...rows];

    list = list.filter((e) => matchesFiltroBucket(e.estado_revision, filtroBucket));

    if (term.length) {
      list = list.filter((e) => {
        const bucketLabel = labelDecisionBucket(decisionBucketFromEstado(e.estado_revision)).toLowerCase();
        const haystack = [
          e.nombre ?? "",
          e.rubro ?? "",
          e.telefono ?? "",
          e.email ?? "",
          e.web ?? "",
          e.fuente_remota ?? "",
          bucketLabel,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    list.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
    return list;
  }, [rows, q, filtroBucket]);

  async function startEditRubro(e: Empresa) {
    setError(null);
    setEditingRubroForId(e.id);

    if (e.rubro_id) {
      setPendingRubroId(e.rubro_id);
      return;
    }

    if (e.rubro) {
      setPendingRubroId(null);
      try {
        const map = await ensureRubroNombreToIdMap();
        const resolved = map.get(e.rubro);
        setPendingRubroId(resolved ?? null);
      } catch (err: any) {
        setError(err?.message ?? "No pude cargar rubros para resolver rubro_id.");
      }
      return;
    }

    setPendingRubroId(null);
  }

  function cancelEditRubro() {
    setEditingRubroForId(null);
    setPendingRubroId(null);
  }

  async function saveEditRubro(e: Empresa) {
    if (!pendingRubroId) {
      setError("Elegí un rubro antes de guardar.");
      return;
    }

    const prevRubroId = e.rubro_id;
    const prevRubro = e.rubro;

    setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, rubro_id: pendingRubroId } : r)));

    try {
      const updated = await patchEmpresa(e.id, { rubro_id: pendingRubroId });
      flash(`Rubro guardado: ${updated.rubro ?? "OK"}`);
      setEditingRubroForId(null);
      setPendingRubroId(null);
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.id === e.id ? { ...r, rubro_id: prevRubroId ?? null, rubro: prevRubro ?? null } : r
        )
      );
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bandeja de decisión</h2>
          <p className="text-sm text-slate-600">
            Revisá, descartá o convertí a lead sin salir del listado. La columna{" "}
            <span className="font-medium text-slate-800">Sugerencia IA</span> es una heurística local (no es un modelo
            remoto ni guarda nada): te orienta; la decisión sigue siendo tuya.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchEmpresas}
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          disabled={loading || !!mutatingId}
        >
          Refrescar
        </button>
      </div>

      {/* Contadores */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm">
          <span className="text-slate-500">Total</span>{" "}
          <span className="font-semibold text-slate-900">{stats.total}</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-sm">
          <span className="text-emerald-800/90">Convertidas a lead</span>{" "}
          <span className="font-semibold text-emerald-900">{stats.convertidas}</span>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-2 text-sm">
          <span className="text-red-800/90">Descartadas</span>{" "}
          <span className="font-semibold text-red-900">{stats.descartadas}</span>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filtros por estado comercial */}
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
        {FILTRO_CHIPS.map((chip) => {
          const active = filtroBucket === chip.id;
          return (
            <button
              key={chip.id || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFiltroBucket(chip.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, rubro, contacto, web o estado…"
          className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-2 text-sm sm:max-w-xl"
        />
        {rows.length > 0 ? (
          <p className="text-xs text-slate-500 lg:text-right">
            Mostrando{" "}
            <span className="font-semibold text-slate-700">{empresasFiltradas.length}</span> de{" "}
            <span className="font-semibold text-slate-700">{rows.length}</span>
            {filtroBucket || q.trim() ? " (filtros activos)" : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <div className="min-w-[940px]">
          <div className={`${GRID_HEAD} bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600`}>
            <div>Iniciativa</div>
            <div>
              <div>Sugerencia IA</div>
              <div className="mt-0.5 text-[10px] font-normal text-slate-400">
                prioridad · acción · motivo
              </div>
            </div>
            <div className="text-center">Estado</div>
            <div>Rubro</div>
            <div className="text-center">Lead</div>
            <div className="text-right">Acciones</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">
              {rows.length === 0
                ? "No hay iniciativas cargadas. Usá Nueva iniciativa o Importar desde la cabecera."
                : "Ningún registro coincide con búsqueda o filtro. Probá otro chip o limpiá el texto."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {empresasFiltradas.map((e) => {
                const busy = mutatingId === e.id;
                const isEditingRubro = editingRubroForId === e.id;
                const revision = (e.estado_revision ?? "").trim().toLowerCase();
                const tieneLead = Boolean(e.converted_lead_id?.trim());
                const puedeConvertir =
                  revision !== "descartada" &&
                  revision !== "convertida_a_lead" &&
                  !tieneLead;
                const puedeDescartar =
                  revision !== "descartada" && revision !== "convertida_a_lead" && !tieneLead;
                const bucket = decisionBucketFromEstado(e.estado_revision);
                const ia = getInitiativeAiAssessment(e);

                return (
                  <div key={e.id} className={`${GRID_HEAD} items-center px-4 py-3 text-sm`}>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{e.nombre}</div>
                      {e.fuente_remota?.trim() || typeof e.score_preliminar === "number" ? (
                        <div
                          className="mt-0.5 truncate text-xs text-slate-500"
                          title={e.fuente_remota?.trim() || undefined}
                        >
                          {[
                            e.fuente_remota?.trim(),
                            typeof e.score_preliminar === "number" ? `Score ${e.score_preliminar}/10` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClassAiPriority(ia.aiPriority)}`}
                          title="Prioridad sugerida (heurística, no guardada)"
                        >
                          {labelAiPriority(ia.aiPriority)}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClassAiRecommendation(ia.aiRecommendation)}`}
                          title="Recomendación sugerida (no ejecuta acciones)"
                        >
                          {labelAiRecommendation(ia.aiRecommendation)}
                        </span>
                      </div>
                      <p
                        className="line-clamp-1 text-[11px] leading-snug text-slate-500"
                        title={ia.aiReason}
                      >
                        {ia.aiReason}
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <span
                        className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClassDecisionBucket(bucket)}`}
                        title={labelDecisionBucket(bucket)}
                      >
                        {labelDecisionBucket(bucket)}
                      </span>
                    </div>

                    <div className="min-w-0 text-slate-700">
                      {!isEditingRubro ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate">{e.rubro ?? "—"}</span>
                          <button
                            type="button"
                            onClick={() => startEditRubro(e)}
                            className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                            disabled={busy || loading}
                          >
                            Editar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="min-w-[200px] flex-1">
                            <RubroSelect
                              value={pendingRubroId}
                              onChange={(next) => setPendingRubroId(next)}
                              disabled={busy || loading}
                              placeholder="Rubro…"
                            />
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => saveEditRubro(e)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              disabled={
                                busy || loading || !pendingRubroId || pendingRubroId === (e.rubro_id ?? null)
                              }
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditRubro}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              disabled={busy || loading}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 text-center text-slate-700">
                      {e.converted_lead_id?.trim() ? (
                        <Link
                          href={`/admin/leads87/${e.converted_lead_id.trim()}`}
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Abrir
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {puedeConvertir ? (
                        <button
                          type="button"
                          onClick={() => convertirFilaALead(e.id)}
                          disabled={busy || loading}
                          className="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? "…" : "Convertir a Lead"}
                        </button>
                      ) : null}

                      {puedeDescartar ? (
                        <button
                          type="button"
                          onClick={() => descartarFila(e.id)}
                          disabled={busy || loading}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Descartar
                        </button>
                      ) : null}

                      <Link
                        href={`/admin/empresas/${e.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Detalle
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        El rubro se guarda al confirmar con OK. Convertir abre el lead en LEADS87 cuando la operación es correcta.
      </p>
    </div>
  );
}
