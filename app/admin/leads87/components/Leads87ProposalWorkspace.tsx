"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isPdfUrl } from "@/lib/leads/presentationUtils";
import { getLeads87ProposalPhase, type Leads87ProposalPhase } from "@/lib/crm/leads87ProposalPhase";

type LeadServiceRow = {
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

type Props = {
  leadId: string;
  leadDisplayName: string;
  proposalUrl: string | null | undefined;
  /** Alineado con isCommercialStrategyApproved (lead + docs) en la página. */
  commercialStrategyApproved?: boolean;
  structureConfirmed: boolean;
  onDocumentCreated: () => void;
  onRegisterCreateAction?: (action: (() => Promise<void>) | null) => void;
  onCreateReadinessChange?: (ready: boolean, busy: boolean) => void;
  proposalReviewed?: boolean;
  proposalReviewPatchBusy?: boolean;
  onMarkProposalReviewed?: () => void | Promise<void>;
};

function buildProposalMarkdown(leadName: string, rows: LeadServiceRow[]): string {
  const safeName = leadName.trim() || "Lead";
  let md = `# Propuesta comercial\n\n**Cliente:** ${safeName}\n\n## Servicios incluidos\n\n`;
  if (rows.length === 0) {
    md += "_No hay ítems en la estructura de servicios. Completá y confirmá el paso Servicios antes de generar la propuesta._\n\n";
  } else {
    md += "| Código | Servicio | Mes | Precio | Moneda | Alcance / notas |\n";
    md += "|--------|----------|-----|--------|--------|------------------|\n";
    for (const r of rows) {
      const scope = [r.alcance_editado, r.observaciones].filter(Boolean).join(" · ") || "—";
      const precio = r.precio != null ? String(r.precio) : "—";
      const moneda = r.moneda?.trim() || "—";
      md += `| ${(r.codigo ?? "—").replace(/\|/g, "/")} | ${(r.nombre ?? "—").replace(/\|/g, "/")} | ${r.mes} | ${precio} | ${moneda.replace(/\|/g, "/")} | ${scope.replace(/\|/g, "/").replace(/\n/g, " ")} |\n`;
    }
    md += "\n";
  }
  md += "## Próximos pasos\n\n";
  md += "- Revisar montos y alcance con el cliente.\n";
  md += "- Ajustar en Servicios si hace falta y volver a generar el borrador.\n\n";
  md += `---\n_Borrador generado en LEADS87 · ${new Date().toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" })}_\n`;
  return md;
}

function decodeMarkdownDataUrl(url: string): string | null {
  const u = url.trim();
  if (!u.startsWith("data:text/markdown")) return null;
  const i = u.indexOf(",");
  if (i < 0) return null;
  try {
    return decodeURIComponent(u.slice(i + 1));
  } catch {
    return null;
  }
}

/** URL que el navegador puede abrir en nueva pestaña (evita “Abrir documento” inerte). */
function isProposalUrlOpenableInNewTab(url: string | null | undefined): boolean {
  const v = String(url ?? "").trim();
  if (!v || v === "#") return false;
  if (v.startsWith("data:text/markdown")) {
    return v.includes(",") && decodeMarkdownDataUrl(v) != null;
  }
  if (v.startsWith("/")) return true;
  if (v.startsWith("http://") || v.startsWith("https://")) {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function phaseBadgeClass(phase: Leads87ProposalPhase): string {
  if (phase === "NOT_CREATED") return "bg-slate-200 text-slate-700";
  if (phase === "CREATED_REVIEW_PENDING") return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

function phaseLabel(phase: Leads87ProposalPhase): string {
  if (phase === "NOT_CREATED") return "Propuesta en construcción";
  if (phase === "CREATED_REVIEW_PENDING") return "Propuesta generada — revisión pendiente";
  return "Lista para generar presentación comercial";
}

export function Leads87ProposalWorkspace({
  leadId,
  leadDisplayName,
  proposalUrl,
  commercialStrategyApproved = false,
  structureConfirmed,
  onDocumentCreated,
  onRegisterCreateAction,
  onCreateReadinessChange,
  proposalReviewed = false,
  proposalReviewPatchBusy = false,
  onMarkProposalReviewed,
}: Props) {
  const [rows, setRows] = useState<LeadServiceRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proposalReviewRef = useRef<HTMLDivElement | null>(null);

  const hasDoc = Boolean(proposalUrl?.trim());
  const phase = getLeads87ProposalPhase(proposalUrl, proposalReviewed);

  const inlineMarkdown = useMemo(
    () => (proposalUrl?.trim() ? decodeMarkdownDataUrl(proposalUrl.trim()) : null),
    [proposalUrl]
  );
  const isExternalPdf = Boolean(proposalUrl?.trim() && isPdfUrl(proposalUrl));
  const isHttpLike =
    Boolean(proposalUrl?.trim()) &&
    (proposalUrl!.trim().startsWith("http://") || proposalUrl!.trim().startsWith("https://"));
  const canOpenPersisted = isProposalUrlOpenableInNewTab(proposalUrl);

  const canCreate = structureConfirmed && !hasDoc && !loadingRows && rows.length > 0;

  const createProposalDocument = useCallback(async () => {
    if (!leadId.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const svcRes = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/services`, { cache: "no-store" });
      const svcJson = (await svcRes.json().catch(() => ({}))) as { services?: LeadServiceRow[] };
      const freshRows = Array.isArray(svcJson?.services) ? svcJson.services : [];
      setRows(freshRows);
      if (freshRows.length === 0) {
        throw new Error("No hay servicios en la propuesta. Completá el paso Servicios primero.");
      }
      const md = buildProposalMarkdown(leadDisplayName, freshRows);
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ type: "proposal", markdown: md }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "No se pudo guardar el documento de propuesta.");
      }
      onDocumentCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la propuesta.");
    } finally {
      setCreating(false);
    }
  }, [leadId, leadDisplayName, onDocumentCreated]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRows(true);
    fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/services`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { services?: LeadServiceRow[] }) => {
        if (!cancelled) setRows(Array.isArray(j?.services) ? j.services : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    onCreateReadinessChange?.(canCreate, creating);
  }, [canCreate, creating, onCreateReadinessChange]);

  useEffect(() => {
    if (!onRegisterCreateAction) return;
    if (canCreate) {
      onRegisterCreateAction(async () => {
        await createProposalDocument();
      });
    } else {
      onRegisterCreateAction(null);
    }
    return () => onRegisterCreateAction(null);
  }, [canCreate, createProposalDocument, onRegisterCreateAction]);

  const scrollToReview = useCallback(() => {
    proposalReviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const phaseSummary = useMemo(() => {
    const labels = {
      "Diagnóstico y Base": 0,
      Implementación: 0,
      "Optimización y Crecimiento": 0,
    } as Record<string, number>;
    for (const r of rows) {
      const bt = String(r.billing_type ?? "").toLowerCase();
      const m = Number(r.mes) || 1;
      const phase =
        bt === "one_time" && m === 1 ? "Diagnóstico y Base" : bt === "monthly" ? "Optimización y Crecimiento" : "Implementación";
      labels[phase] += 1;
    }
    return labels;
  }, [rows]);

  return (
    <div id="leads87-proposal-flow" className="space-y-4">
      {commercialStrategyApproved ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Estrategia confirmada</span>
          <span>Podés generar y revisar la propuesta con normalidad.</span>
        </div>
      ) : null}
      <p className="text-sm text-slate-600">
        {hasDoc
          ? "Revisá el borrador, los servicios incluidos y el texto generado. Cuando esté conforme, confirmá la revisión: se guarda en el lead y podés generar la presentación comercial en el paso 6."
          : "Generá un borrador en base a la estructura de servicios confirmada. Se guarda como documento del lead; después podés revisarlo acá antes de seguir."}
      </p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${phaseBadgeClass(phase)}`}>
          {phaseLabel(phase)}
        </span>
      </div>

      {!structureConfirmed && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Primero confirmá la estructura de servicios en el paso anterior.
        </p>
      )}

      {structureConfirmed && !hasDoc && loadingRows && <p className="text-sm text-slate-500">Cargando servicios de la propuesta…</p>}

      {structureConfirmed && !hasDoc && !loadingRows && rows.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          No hay servicios en la propuesta. Volvé al paso <strong>Servicios</strong>, agregá al menos un ítem y confirmá la estructura.
        </p>
      )}

      {structureConfirmed && !hasDoc && !loadingRows && rows.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          Listos para incluir en el borrador: <strong className="text-slate-800">{rows.length}</strong> ítem(es) de servicio.
        </div>
      )}

      {hasDoc ? (
        <div id="leads87-proposal-review" ref={proposalReviewRef} className="space-y-4 scroll-mt-4">
          {rows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Servicios incluidos (estructura actual)
              </h3>
              <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-xs text-slate-700">
                  <thead className="sticky top-0 bg-slate-100 font-medium text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5">Código</th>
                      <th className="px-2 py-1.5">Servicio</th>
                      <th className="px-2 py-1.5">Mes</th>
                      <th className="px-2 py-1.5">Precio</th>
                      <th className="px-2 py-1.5">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">{r.codigo ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.nombre ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.mes}</td>
                        <td className="px-2 py-1.5">
                          {r.precio != null ? r.precio : "—"} {r.moneda?.trim() ?? ""}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">
                          {[r.alcance_editado, r.observaciones].filter(Boolean).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {inlineMarkdown ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen / narrativa del borrador</h3>
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">{inlineMarkdown}</pre>
              </div>
            </div>
          ) : null}

          {!inlineMarkdown && isHttpLike ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="font-medium text-slate-800">Documento externo</p>
              <p className="mt-1 text-xs text-slate-600">
                La propuesta está guardada como enlace. Usá el paso 2/3 más abajo para abrirla si el enlace es válido.
              </p>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fases de la propuesta</h3>
              <p className="mt-2 space-y-1 text-sm text-slate-700">
                {Object.entries(phaseSummary).map(([phase, n]) => (
                  <span key={phase} className="block">
                    <span className="font-medium text-slate-800">{phase}:</span> {n} servicio(s)
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasDoc && phase === "CREATED_REVIEW_PENDING" && !proposalReviewed && onMarkProposalReviewed ? (
        <div className="rounded-lg border-2 border-slate-200 bg-slate-50/90 p-4">
          <p className="text-sm font-semibold text-slate-900">Revisión de la propuesta — tres pasos en orden</p>
          <p className="mt-1 text-xs text-slate-600">
            Solo el paso 3/3 cierra esta etapa y habilita la presentación comercial (paso 6). El contenido del borrador quedó
            arriba para revisarlo antes de confirmar.
          </p>
          <ol className="mt-4 list-none space-y-4 p-0">
            <li className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">1/3 Revisar contenido en esta pantalla</p>
              <p className="mt-1 text-xs text-slate-600">
                Validá la tabla de servicios, la narrativa del borrador y las fases antes de abrir el archivo o confirmar.
              </p>
              <button
                type="button"
                onClick={scrollToReview}
                className="mt-3 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Ir al contenido del borrador
              </button>
            </li>
            <li className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">2/3 Abrir el documento persistido</p>
              {canOpenPersisted ? (
                <>
                  <p className="mt-1 text-xs text-slate-600">Abrí el archivo en otra pestaña si necesitás ver el PDF o el enlace completo.</p>
                  <a
                    href={proposalUrl!.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    {isExternalPdf
                      ? "Abrir PDF de propuesta 2/3"
                      : isHttpLike
                        ? "Abrir documento de propuesta 2/3"
                        : "Abrir borrador (markdown) 2/3"}
                  </a>
                </>
              ) : (
                <p className="mt-1 text-xs text-amber-900">
                  No hay un enlace válido para abrir en otra pestaña. Usá el resumen del paso 1; si falta el archivo,
                  regenerá el borrador o verificá que el documento quedó guardado en el CRM.
                </p>
              )}
            </li>
            <li className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
              <p className="text-sm font-semibold text-slate-800">3/3 Confirmar la revisión</p>
              <p className="mt-1 text-xs text-slate-600">
                Cuando el contenido te cierra, confirmá: es la única acción que desbloquea el paso 6.
              </p>
              <button
                type="button"
                onClick={() => void onMarkProposalReviewed()}
                disabled={proposalReviewPatchBusy}
                className="mt-3 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {proposalReviewPatchBusy ? "Guardando…" : "Confirmar revisión 3/3"}
              </button>
            </li>
          </ol>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => void createProposalDocument()}
              disabled={creating || !structureConfirmed}
              className="text-sm font-medium text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-800 disabled:opacity-50"
            >
              {creating ? "Regenerando borrador…" : "Regenerar borrador (opcional)"}
            </button>
          </div>
        </div>
      ) : null}

      {(!hasDoc || phase === "READY_FOR_PRESENTATION") && (
        <div className="flex flex-wrap items-center gap-2">
          {!hasDoc ? (
            <button
              type="button"
              onClick={() => void createProposalDocument()}
              disabled={!canCreate || creating}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
            >
              {creating ? "Creando propuesta…" : "Crear propuesta comercial"}
            </button>
          ) : (
            <>
              {canOpenPersisted ? (
                <a
                  href={proposalUrl!.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  {isExternalPdf ? "Abrir PDF de propuesta" : isHttpLike ? "Abrir documento de propuesta" : "Abrir borrador (markdown)"}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void createProposalDocument()}
                disabled={creating || !structureConfirmed}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {creating ? "Regenerando…" : "Regenerar borrador"}
              </button>
            </>
          )}
        </div>
      )}

      {hasDoc && phase === "CREATED_REVIEW_PENDING" && (
        <p className="text-xs text-slate-600">
          Hasta que confirmes la revisión, el flujo se mantiene en <strong>Propuesta comercial</strong>. Al confirmar, el CRM pasa a Presentación y podés generar la <strong>presentación comercial</strong> en el paso 6.
        </p>
      )}
    </div>
  );
}
