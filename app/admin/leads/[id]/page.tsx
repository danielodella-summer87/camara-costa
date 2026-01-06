"use client";

import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
  estado?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // ✅ nuevos campos (DB: website text, objetivos/audiencia jsonb, tamano text, oferta text)
  website?: string | null;
  objetivos?: string[] | null; // multi
  audiencia?: string[] | null; // multi
  tamano?: string | null; // single
  oferta?: string | null; // texto

  rating?: number | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
};

type LeadApiResponse = {
  data?: Lead | null;
  error?: string | null;
};

type PatchPayload = Partial<
  Pick<
    Lead,
    | "nombre"
    | "contacto"
    | "telefono"
    | "email"
    | "origen"
    | "pipeline"
    | "notas"
    | "website"
    | "objetivos"
    | "audiencia"
    | "tamano"
    | "oferta"
  >
>;

type Proposal = {
  id: string;
  lead_id: string;

  title?: string | null;
  notes?: string | null;

  file_bucket?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;

  file_size?: number | null; // bytes
  signed_url?: string | null; // puede venir en list (si lo devolvés)
  url?: string | null; // compat

  created_at?: string | null;
  sent_at?: string | null;
};

type ApiResp<T> = {
  data?: T | null;
  error?: string | null;
};

const OBJETIVOS_OPTS = [
  "Networking y alianzas",
  "Nuevas oportunidades comerciales",
  "Visibilidad y posicionamiento",
  "Acceso a eventos y rondas",
  "Beneficios y partners",
  "Aprendizaje / capacitación",
];

const AUDIENCIA_OPTS = [
  "B2B",
  "B2C",
  "Gobierno",
  "Educación",
  "Industria",
  "Servicios",
  "Retail/eCommerce",
];

const TAMANO_OPTS = ["1–5", "6–20", "21–50", "51–200", "200+"];

function norm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normArr(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const cleaned = v.map((x) => String(x).trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function bytes(n?: number | null) {
  if (!n || !Number.isFinite(n)) return null;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">
              {title}
            </div>
            <div className="text-xs text-slate-500">
              Historial de PDFs enviados.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function PillMulti({
  label,
  editing,
  value,
  options,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: string[] | null | undefined;
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const current = Array.isArray(value) ? value : [];

  const toggle = (opt: string) => {
    const has = current.includes(opt);
    const next = has ? current.filter((x) => x !== opt) : [...current, opt];
    onChange(next);
  };

  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>

      {editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = current.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
                aria-pressed={active}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {current.length ? (
            current.map((opt) => (
              <span
                key={opt}
                className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {opt}
              </span>
            ))
          ) : (
            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
              —
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = (params as any)?.id as string | string[] | undefined;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [lead, setLead] = useState<Lead | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatchPayload>({});

  // ✅ propuestas
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSentAt, setUploadSentAt] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [openingProposalId, setOpeningProposalId] = useState<string | null>(
    null
  );
  const [mailingProposalId, setMailingProposalId] = useState<string | null>(
    null
  );

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function fetchLead() {
    if (!id) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando lead");

      const next = (json?.data ?? null) as Lead | null;
      setLead(next);

      if (!editing) setDraft({});
    } catch (e: any) {
      setError(e?.message ?? "Error cargando lead");
      setLead(null);
    } finally {
      setLoading(false);
    }
  }

  async function patchLead(payload: PatchPayload) {
    if (!id) return;

    setError(null);
    setMutating(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as LeadApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando lead");

      const updated = json?.data ?? null;
      if (!updated) throw new Error("No se recibió el lead actualizado");

      setLead(updated);
      flash("Guardado.");
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando lead");
    } finally {
      setMutating(false);
    }
  }

  async function deleteLead() {
    if (!id) return;

    const ok = window.confirm(
      "¿Eliminar este lead? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando lead");

      router.push("/admin/leads");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando lead");
    } finally {
      setDeleting(false);
    }
  }

  // ✅ propuestas (GET list)
  async function fetchProposals() {
    if (!id) return;
    setProposalsError(null);
    setProposalsLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/proposals`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<Proposal[]>;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando propuestas");

      const rows = Array.isArray(json?.data) ? json.data : [];
      setProposals(rows);
    } catch (e: any) {
      setProposalsError(e?.message ?? "Error cargando propuestas");
      setProposals([]);
    } finally {
      setProposalsLoading(false);
    }
  }

  // ✅ traer URL firmada fresca por proposalId (a prueba de expiración / campos)
  async function getFreshSignedUrl(proposalId: string): Promise<string | null> {
    if (!id) return null;

    const res = await fetch(`/api/admin/leads/${id}/proposals/${proposalId}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });

    const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
    if (!res.ok)
      throw new Error((json as any)?.error ?? "No se pudo obtener la URL del PDF");

    const row = (json as any)?.data ?? null;
    const url =
      (row?.signed_url && String(row.signed_url).trim()) ||
      (row?.url && String(row.url).trim()) ||
      null;

    return url;
  }

  async function openProposal(proposalId: string) {
    if (!proposalId) return;
    setOpeningProposalId(proposalId);
    setProposalsError(null);
    try {
      const url = await getFreshSignedUrl(proposalId);
      if (!url) throw new Error("La API no devolvió signed_url/url para este PDF.");

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setProposalsError(e?.message ?? "No se pudo abrir el PDF");
    } finally {
      setOpeningProposalId(null);
    }
  }

  async function emailProposal(p: Proposal) {
    const to = lead?.email?.trim() ?? "";
    if (!to) {
      setProposalsError("Este lead no tiene email cargado.");
      return;
    }

    setMailingProposalId(p.id);
    setProposalsError(null);
    try {
      const url = await getFreshSignedUrl(p.id);
      if (!url) throw new Error("No hay URL disponible para enviar.");

      const name =
        (p.title && p.title.trim()) ||
        (p.file_name && p.file_name.trim()) ||
        "Propuesta";

      const subject = `Propuesta: ${name}`;
      const body = `Hola,\n\nTe comparto la propuesta en PDF:\n${url}\n\nSaludos.`;

      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;

      window.location.href = mailto;
    } catch (e: any) {
      setProposalsError(e?.message ?? "No se pudo preparar el email");
    } finally {
      setMailingProposalId(null);
    }
  }

  // ✅ propuestas (POST multipart)
  async function uploadProposal() {
    if (!id) return;
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file) {
      setProposalsError("Seleccioná un PDF primero.");
      return;
    }
    if (file.type !== "application/pdf") {
      setProposalsError("El archivo debe ser PDF.");
      return;
    }

    setUploading(true);
    setProposalsError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const t = uploadTitle.trim();
      if (t) fd.append("title", t);

      const sentAt = uploadSentAt.trim();
      if (sentAt) fd.append("sent_at", sentAt);

      const res = await fetch(`/api/admin/leads/${id}/proposals`, {
        method: "POST",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok) throw new Error((json as any)?.error ?? "Error subiendo propuesta");

      if (fileRef.current) fileRef.current.value = "";
      setUploadTitle("");
      setUploadSentAt("");
      flash("Propuesta subida.");

      await fetchProposals();
    } catch (e: any) {
      setProposalsError(e?.message ?? "Error subiendo propuesta");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    fetchLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const disabled = loading || mutating || deleting;

  function startEdit() {
    if (!lead) return;
    setEditing(true);
    setDraft({
      nombre: lead.nombre ?? "",
      contacto: lead.contacto ?? "",
      telefono: lead.telefono ?? "",
      email: lead.email ?? "",
      origen: lead.origen ?? "",
      pipeline: lead.pipeline ?? "Nuevo",
      notas: lead.notas ?? "",

      website: lead.website ?? "",
      objetivos: Array.isArray(lead.objetivos) ? lead.objetivos : [],
      audiencia: Array.isArray(lead.audiencia) ? lead.audiencia : [],
      tamano: lead.tamano ?? "",
      oferta: lead.oferta ?? "",
    });
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setError(null);
  }

  async function saveEdit() {
    const normalized: PatchPayload = {
      nombre: norm(draft.nombre),
      contacto: norm(draft.contacto),
      telefono: norm(draft.telefono),
      email: norm(draft.email),
      origen: norm(draft.origen),
      pipeline: norm(draft.pipeline),
      notas: norm(draft.notas),

      website: norm(draft.website),
      objetivos: normArr(draft.objetivos),
      audiencia: normArr(draft.audiencia),
      tamano: norm(draft.tamano),
      oferta: norm(draft.oferta),
    };

    await patchLead(normalized);
    setEditing(false);
  }

  const pipelineValue = useMemo(() => {
    if (editing) return (draft.pipeline as any) ?? "Nuevo";
    return lead?.pipeline ?? "—";
  }, [editing, draft.pipeline, lead?.pipeline]);

  const title = loading ? "Cargando…" : lead?.nombre ?? "Lead";
  const leadIdSafe = (lead?.id ?? id ?? "").trim();

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Detalle, edición, propuestas e informe IA.
              </p>

              <div className="mt-3 inline-flex overflow-hidden rounded-xl border bg-white">
                <Link
                  href="/admin/leads"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Lista
                </Link>
                <Link
                  href="/admin/leads/kanban"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Kanban
                </Link>
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                  Ficha
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchLead}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={disabled}
              >
                Refrescar
              </button>

              <button
                type="button"
                onClick={async () => {
                  setProposalsOpen(true);
                  await fetchProposals();
                }}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={disabled || !lead}
                title="Historial de propuestas (PDF)"
              >
                Propuestas
              </button>

              {!editing ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={disabled || !lead}
                >
                  Editar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={disabled}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={disabled}
                  >
                    Guardar
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={deleteLead}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                disabled={disabled || !lead}
                title="Eliminar lead"
              >
                Eliminar
              </button>
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

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Contacto</div>

              <div className="mt-3 space-y-3">
                <Field
                  label="Nombre"
                  editing={editing}
                  value={(editing ? (draft.nombre as any) : lead?.nombre) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, nombre: v }))}
                />
                <Field
                  label="Contacto"
                  editing={editing}
                  value={(editing ? (draft.contacto as any) : lead?.contacto) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, contacto: v }))}
                />
                <Field
                  label="Teléfono"
                  editing={editing}
                  value={(editing ? (draft.telefono as any) : lead?.telefono) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, telefono: v }))}
                />
                <Field
                  label="Email"
                  editing={editing}
                  value={(editing ? (draft.email as any) : lead?.email) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, email: v }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">
                Perfil / Afiliación
              </div>

              <div className="mt-3 space-y-3">
                <Field
                  label="Origen"
                  editing={editing}
                  value={(editing ? (draft.origen as any) : lead?.origen) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, origen: v }))}
                />
                <Field
                  label="Pipeline"
                  editing={editing}
                  value={
                    editing
                      ? ((draft.pipeline as any) ?? "Nuevo")
                      : (pipelineValue ?? "")
                  }
                  onChange={(v) => setDraft((p) => ({ ...p, pipeline: v }))}
                  placeholder="Nuevo"
                />

                <Field
                  label="Website"
                  editing={editing}
                  value={(editing ? (draft.website as any) : lead?.website) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, website: v }))}
                  placeholder="https://..."
                />

                <PillMulti
                  label="Objetivo(s) (checkbox)"
                  editing={editing}
                  value={editing ? (draft.objetivos as any) : lead?.objetivos}
                  options={OBJETIVOS_OPTS}
                  onChange={(next) => setDraft((p) => ({ ...p, objetivos: next }))}
                />

                <PillMulti
                  label="A quién le vende (checkbox)"
                  editing={editing}
                  value={editing ? (draft.audiencia as any) : lead?.audiencia}
                  options={AUDIENCIA_OPTS}
                  onChange={(next) => setDraft((p) => ({ ...p, audiencia: next }))}
                />

                <div>
                  <div className="text-xs text-slate-500">Tamaño (checkbox único)</div>
                  {editing ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TAMANO_OPTS.map((opt) => {
                        const active = ((draft.tamano as any) ?? "") === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({ ...p, tamano: active ? "" : opt }))
                            }
                            className={[
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              active
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-700 hover:bg-slate-50",
                            ].join(" ")}
                            aria-pressed={active}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {lead?.tamano ?? "—"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Qué ofrece a la Cámara / comunidad
                  </div>
                  {editing ? (
                    <textarea
                      value={(draft.oferta as any) ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, oferta: e.target.value }))}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Ej: descuentos, expertise, charlas, referrals, partnership…"
                    />
                  ) : (
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {lead?.oferta ?? "—"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">Notas (memo)</div>
                  {editing ? (
                    <textarea
                      value={(draft.notas as any) ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, notas: e.target.value }))}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      rows={5}
                      placeholder="Notas internas…"
                    />
                  ) : (
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {lead?.notas ?? "—"}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div className="rounded-xl border bg-white px-3 py-2">
                    <div className="font-semibold">Creado</div>
                    <div className="mt-1">
                      {formatDateTime(lead?.created_at ?? null)}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white px-3 py-2">
                    <div className="font-semibold">Actualizado</div>
                    <div className="mt-1">
                      {formatDateTime(lead?.updated_at ?? null)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!loading && !lead && (
            <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              No se encontró el lead.
            </div>
          )}
        </div>

        {/* ✅ Agente IA (FODA + oportunidades + PDF) */}
        <AiLeadReport key={`ai-${leadIdSafe}`} leadId={leadIdSafe} lead={lead} />

        <Modal
          open={proposalsOpen}
          title={`Propuestas · ${lead?.nombre ?? "Lead"}`}
          onClose={() => setProposalsOpen(false)}
        >
          {proposalsError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {proposalsError}
            </div>
          )}

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="grow">
                <div className="text-xs text-slate-500">Título (opcional)</div>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Ej: Propuesta Growth Q1"
                  disabled={proposalsLoading || uploading}
                />
              </div>

              <div className="w-full sm:w-56">
                <div className="text-xs text-slate-500">Fecha envío (opcional)</div>
                <input
                  value={uploadSentAt}
                  onChange={(e) => setUploadSentAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="2026-01-05T14:00:00-03:00"
                  disabled={proposalsLoading || uploading}
                />
              </div>

              <div className="w-full sm:w-auto">
                <div className="text-xs text-slate-500">PDF</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={proposalsLoading || uploading}
                />
              </div>

              <button
                type="button"
                onClick={uploadProposal}
                disabled={proposalsLoading || uploading}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {uploading ? "Subiendo…" : "Subir"}
              </button>

              <button
                type="button"
                onClick={fetchProposals}
                disabled={proposalsLoading || uploading}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {proposalsLoading ? "Cargando…" : "Refrescar"}
              </button>
            </div>

            <div className="mt-4">
              {proposalsLoading ? (
                <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
                  Cargando propuestas…
                </div>
              ) : proposals.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
                  No hay propuestas cargadas todavía.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border">
                  <div className="grid grid-cols-12 gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    <div className="col-span-5">Documento</div>
                    <div className="col-span-3">Creado</div>
                    <div className="col-span-2">Enviado</div>
                    <div className="col-span-2 text-right">Acciones</div>
                  </div>

                  <div className="divide-y">
                    {proposals.map((p) => {
                      const name =
                        (p.title && p.title.trim()) ||
                        (p.file_name && p.file_name.trim()) ||
                        p.id;

                      const isOpening = openingProposalId === p.id;
                      const isMailing = mailingProposalId === p.id;

                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-12 items-center px-3 py-2 text-sm"
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="truncate font-medium text-slate-900">{name}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {p.file_name ? (
                                <span className="truncate">{p.file_name}</span>
                              ) : null}
                              {p.file_size ? (
                                <span className="ml-2 rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-600">
                                  {bytes(p.file_size)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="col-span-3 text-xs text-slate-600">
                            {formatDateTime(p.created_at ?? null)}
                          </div>

                          <div className="col-span-2 text-xs text-slate-600">
                            {formatDateTime(p.sent_at ?? null)}
                          </div>

                          <div className="col-span-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openProposal(p.id)}
                              disabled={isOpening || proposalsLoading || uploading}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              title="Abrir PDF"
                            >
                              {isOpening ? "Abriendo…" : "Abrir"}
                            </button>

                            <button
                              type="button"
                              onClick={() => emailProposal(p)}
                              disabled={isMailing || proposalsLoading || uploading}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              title={lead?.email ? `Enviar a ${lead.email}` : "Este lead no tiene email"}
                            >
                              {isMailing ? "Preparando…" : "Mail"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-slate-500">
                “Abrir” siempre pide una <span className="font-semibold">signed_url fresca</span> al endpoint del proposal,
                así evitamos expiración o campos faltantes.
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  editing,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      {editing ? (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          placeholder={placeholder}
        />
      ) : (
        <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value?.trim?.() ? value : "—"}
        </div>
      )}
    </div>
  );
}