"use client";

import { useEffect, useMemo, useState } from "react";

type LeadServiceProposal = {
  id: string;
  service_id: string;
  codigo: string | null;
  nombre: string | null;
  mes: number;
  precio: number | null;
  moneda: string | null;
  alcance_editado: string | null;
  observaciones: string | null;
  billing_type?: string | null;
};

type EasyService = {
  id: string;
  codigo: string;
  nombre: string;
  categoria?: string | null;
  descripcion_corta?: string | null;
  alcance_base?: string | null;
  precio_base?: number | null;
  moneda?: string | null;
  billing_type?: string | null;
  orden?: number | null;
};

type Suggested = {
  service: EasyService;
  priority: "alta" | "media" | "baja";
  reason: string;
};

type Props = {
  leadId: string;
  aiReport?: string | null;
  /** Sin esto no se puede confirmar estructura ni priorizar sugerencias solo con informe. */
  strategyApproved?: boolean;
  /** Contenido de estrategia (aprobada o borrador) para matchear servicios. */
  strategyContextText?: string;
  proposalConfirmedAt?: string | null;
  onStructureConfirmed?: () => void;
  onConfirmReadinessChange?: (ready: boolean, busy: boolean) => void;
};

function getCols(n: number) {
  const safe = Math.max(1, Math.min(24, n));
  return Array.from({ length: safe }).map((_, i) => ({ key: `m_${i + 1}`, label: `Mes ${i + 1}` }));
}

function parseTabs(report: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rx = /###\s+TAB:\s*(\w+)\s*\n/gi;
  const hits: Array<{ id: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(report)) !== null) hits.push({ id: m[1], start: m.index + m[0].length });
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].start;
    const rest = report.slice(start);
    const next = rest.match(/###\s+TAB:\s*\w+\s*\n/i);
    const end = next && typeof next.index === "number" ? start + next.index : report.length;
    const content = report.slice(start, end).trim();
    if (content) out[hits[i].id] = content;
  }
  return out;
}

function includesAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function matchesService(s: EasyService, words: string[]) {
  const text = [s.codigo, s.nombre, s.categoria, s.descripcion_corta, s.alcance_base].filter(Boolean).join(" ").toLowerCase();
  return words.some((w) => text.includes(w.toLowerCase()));
}

export function Leads87ServicesWorkspace({
  leadId,
  aiReport,
  strategyApproved = false,
  strategyContextText = "",
  proposalConfirmedAt,
  onStructureConfirmed,
  onConfirmReadinessChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<EasyService[]>([]);
  const [rows, setRows] = useState<LeadServiceProposal[]>([]);
  const [months, setMonths] = useState(6);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [selectedScope, setSelectedScope] = useState("");
  const [selectedNotes, setSelectedNotes] = useState("");
  const cols = useMemo(() => getCols(months), [months]);
  const confirmed = Boolean(proposalConfirmedAt?.trim());
  const canConfirmStructure = !loading && !confirmed && rows.length > 0 && strategyApproved;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [catRes, leadRes] = await Promise.all([
          fetch("/api/admin/services", { cache: "no-store" }).then((r) => r.json()),
          fetch(`/api/admin/leads/${leadId}/services`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setCatalog(Array.isArray(catRes?.services) ? catRes.services : []);
        setRows(Array.isArray(leadRes?.services) ? leadRes.services : []);
      } catch {
        if (!cancelled) setError("No se pudo cargar la propuesta de servicios.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const selectedService = useMemo(() => catalog.find((s) => s.id === selectedServiceId) ?? null, [catalog, selectedServiceId]);

  useEffect(() => {
    if (selectedService?.alcance_base) setSelectedScope(selectedService.alcance_base);
  }, [selectedServiceId, selectedService]);

  const suggested = useMemo(() => {
    const used = new Set(rows.map((r) => r.service_id));
    const tabs = parseTabs(String(aiReport ?? ""));
    const fromStrategy = String(strategyContextText ?? "").trim();
    const fromReport = [tabs.ACCIONES, tabs.plan_crecimiento, tabs.OPORTUNIDADES, tabs.propuesta_easy].filter(Boolean).join("\n\n");
    const source = fromStrategy.length > 0 ? fromStrategy : fromReport;
    if (!source.trim()) return [] as Suggested[];
    const out: Suggested[] = [];
    const add = (sourceWords: string[], svcWords: string[], priority: Suggested["priority"], reason: string) => {
      if (!includesAny(source, sourceWords)) return;
      for (const s of catalog) {
        if (used.has(s.id)) continue;
        if (!matchesService(s, svcWords)) continue;
        out.push({ service: s, priority, reason });
      }
    };
    add(["estrategia", "prioridades", "hoja de ruta"], ["consultoria", "estrategia", "growth", "diagnostico"], "alta", "El informe sugiere orden estratégico comercial.");
    add(["captación", "ads", "pauta", "tráfico"], ["pauta", "ads", "google", "meta", "captacion"], "media", "El informe detecta oportunidad de acelerar demanda.");
    add(["linkedin", "autoridad", "social selling"], ["linkedin", "social selling", "contenido"], "media", "El informe recomienda posicionamiento profesional.");
    add(["web", "landing", "conversión"], ["web", "landing", "sitio", "pagina"], "media", "El informe sugiere fortalecer base web.");
    const byId = new Map<string, Suggested>();
    const rank = { alta: 0, media: 1, baja: 2 } as const;
    for (const s of out) {
      const prev = byId.get(s.service.id);
      if (!prev || rank[s.priority] < rank[prev.priority]) byId.set(s.service.id, s);
    }
    return Array.from(byId.values()).slice(0, 6);
  }, [catalog, rows, aiReport, strategyContextText]);

  const byMonthTotal = useMemo(() => {
    const totals: Record<string, number> = {};
    cols.forEach((c, idx) => {
      const m = idx + 1;
      totals[c.key] = rows.reduce((sum, r) => (r.mes === m ? sum + (Number(r.precio) || 0) : sum), 0);
    });
    return totals;
  }, [rows, cols]);

  const phaseRows = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const bt = String(r.billing_type ?? "").toLowerCase();
        const phase = bt === "one_time" && r.mes === 1 ? "Diagnóstico y Base" : bt === "monthly" ? "Optimización y Crecimiento" : "Implementación";
        acc[phase].push(r);
        return acc;
      },
      {
        "Diagnóstico y Base": [] as LeadServiceProposal[],
        Implementación: [] as LeadServiceProposal[],
        "Optimización y Crecimiento": [] as LeadServiceProposal[],
      }
    );
  }, [rows]);

  async function reloadRows() {
    const json = await fetch(`/api/admin/leads/${leadId}/services`, { cache: "no-store" }).then((r) => r.json());
    setRows(Array.isArray(json?.services) ? json.services : []);
  }

  async function addService(serviceId: string, scope?: string, notes?: string, price?: number | null) {
    if (!serviceId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          mes: 1,
          precio: price ?? null,
          alcance_editado: scope?.trim() || null,
          observaciones: notes?.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo agregar el servicio.");
      await reloadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(proposalId: string) {
    if (!confirm("¿Eliminar este servicio de la propuesta?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/services/${proposalId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo eliminar.");
      await reloadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStructure() {
    setConfirming(true);
    setError(null);
    try {
      const draft = {
        months: cols.map((c) => ({ key: c.key, label: c.label })),
        rows: rows.map((r) => ({ proposalId: r.id, serviceId: r.service_id, valuesByMonth: { [cols[Math.max(0, r.mes - 1)]?.key ?? "m_1"]: Number(r.precio) || 0 } })),
      };
      const res = await fetch(`/api/admin/leads/${leadId}/proposal/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo confirmar.");
      onStructureConfirmed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    onConfirmReadinessChange?.(canConfirmStructure, confirming);
  }, [canConfirmStructure, confirming, onConfirmReadinessChange]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Armá la propuesta comercial inteligente sin salir de LEADS87: sugerencias, estructura por mes, narrativa y fases.
      </p>
      {strategyApproved ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Estrategia confirmada</span>
          <span>Podés armar la estructura de servicios y confirmarla cuando esté lista.</span>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Estrategia pendiente.</span> Volvé al Paso 3 y confirmá la estrategia comercial para
          habilitar la confirmación de estructura de servicios. Las sugerencias usan el informe solo como respaldo hasta que
          haya texto de estrategia.
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-slate-500">Cargando catálogo y propuesta…</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Servicios sugeridos</h3>
            {strategyApproved ? (
              <p className="mt-1 text-xs text-slate-600">Priorización según estrategia confirmada (canales y foco declarados).</p>
            ) : (
              <p className="mt-1 text-xs text-amber-800">Sin estrategia confirmada: sugerencias basadas en el informe IA (modo respaldo).</p>
            )}
            <div className="mt-3 space-y-2">
              {suggested.length === 0 ? (
                <p className="text-xs text-slate-500">Sin sugerencias automáticas por ahora.</p>
              ) : (
                suggested.map((s) => (
                  <div key={s.service.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.service.codigo} — {s.service.nombre}</p>
                        <p className="text-xs text-slate-600">{s.reason}</p>
                      </div>
                      <button type="button" onClick={() => addService(s.service.id, s.service.alcance_base ?? undefined, `Sugerido (${s.priority})`, s.service.precio_base ?? null)} disabled={saving || confirmed} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50">
                        Agregar sugerencia
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">Agregar servicio a la propuesta</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— Seleccionar servicio —</option>
                {catalog.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
              </select>
              <input value={selectedPrice} onChange={(e) => setSelectedPrice(e.target.value)} type="number" step={0.01} placeholder="Precio" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => addService(selectedServiceId, selectedScope, selectedNotes, selectedPrice === "" ? null : Number(selectedPrice))}
                disabled={saving || confirmed}
                className="rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Agregar a propuesta
              </button>
            </div>
            <textarea value={selectedScope} onChange={(e) => setSelectedScope(e.target.value)} rows={2} placeholder="Alcance editable" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={selectedNotes} onChange={(e) => setSelectedNotes(e.target.value)} rows={2} placeholder="Observaciones" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Propuesta por mes</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMonths((m) => Math.max(1, m - 1))} disabled={confirmed} className="rounded border px-2 py-1 text-xs">- Mes</button>
                <button type="button" onClick={() => setMonths((m) => Math.min(24, m + 1))} disabled={confirmed} className="rounded border px-2 py-1 text-xs">+ Mes</button>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay servicios cargados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="px-2 py-2 text-left">Servicio</th>
                      {cols.map((c) => <th key={c.key} className="px-2 py-2 text-right">{c.label}</th>)}
                      <th className="px-2 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="px-2 py-2">{[r.codigo, r.nombre].filter(Boolean).join(" — ")}</td>
                        {cols.map((c, i) => (
                          <td key={c.key} className="px-2 py-2 text-right">{r.mes === i + 1 ? (Number(r.precio) || 0).toLocaleString("es-UY") : "—"}</td>
                        ))}
                        <td className="px-2 py-2 text-right">
                          <button type="button" onClick={() => deleteService(r.id)} disabled={saving || confirmed} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-50">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td className="px-2 py-2 font-semibold">Total</td>
                      {cols.map((c) => <td key={c.key} className="px-2 py-2 text-right font-semibold">{(byMonthTotal[c.key] || 0).toLocaleString("es-UY")}</td>)}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div id="leads87-services-confirm" className="scroll-mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">Avanzar en el flujo</h3>
            <p className="mt-1 text-xs text-emerald-900/85">
              Al confirmar se guarda la estructura de servicios y podés continuar con la propuesta comercial (Paso 5).
            </p>
            {confirmed ? (
              <p className="mt-3 text-sm font-medium text-emerald-800">Estructura confirmada — seguí en Propuesta comercial.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void confirmStructure()}
                  disabled={loading || confirming || rows.length === 0}
                  className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming ? "Confirmando…" : "Confirmar estructura y avanzar a propuesta"}
                </button>
                {rows.length === 0 && !loading ? (
                  <p className="mt-2 text-xs text-slate-600">Agregá al menos un servicio para habilitar el avance.</p>
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Narrativa comercial base</h3>
              <p className="mt-2 text-sm text-slate-700">
                La propuesta combina diagnóstico, implementación y crecimiento continuo para pasar de acciones aisladas a un sistema comercial sostenible.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Fases de la propuesta</h3>
              {Object.entries(phaseRows).map(([phase, items]) => (
                <p key={phase} className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">{phase}:</span> {items.length} servicio(s)
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

