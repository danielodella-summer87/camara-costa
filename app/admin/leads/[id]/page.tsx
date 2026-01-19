"use client";

import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Empresa = {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  celular?: string | null;
  rut?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  web?: string | null;
  instagram?: string | null;
  rubro_id?: string | null;
  rubros?: {
    id: string;
    nombre: string | null;
  } | null;
};

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

  // ✅ nuevos campos (DB: website text, objetivos/audiencia text, tamano text, oferta text)
  website?: string | null;
  objetivos?: string | null; // texto libre (antes era array)
  audiencia?: string | null; // texto libre (antes era array)
  tamano?: string | null; // single
  oferta?: string | null; // texto
  linkedin_empresa?: string | null;
  linkedin_director?: string | null;

  rating?: number | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
  empresa_id?: string | null;
  empresas?: Empresa | null;
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
    | "linkedin_empresa"
    | "linkedin_director"
    | "empresa_id"
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

// Fallback hardcodeado (si el fetch falla)
const OBJETIVOS_OPTS_FALLBACK = [
  "Networking y alianzas",
  "Nuevas oportunidades comerciales",
  "Visibilidad y posicionamiento",
  "Acceso a eventos y rondas",
  "Beneficios y partners",
  "Aprendizaje / capacitación",
];

const AUDIENCIA_OPTS_FALLBACK = [
  "B2B",
  "B2C",
  "Gobierno",
  "Educación",
  "Industria",
  "Servicios",
  "Retail/eCommerce",
];

const TAMANO_OPTS_FALLBACK = ["1–5", "6–20", "21–50", "51–200", "200+"];

type PicklistItem = {
  id: string;
  label: string;
  sort: number;
  is_active: boolean;
};

type LeadOptionsResponse = {
  data?: {
    membership_goals?: PicklistItem[];
    icp_targets?: PicklistItem[];
    company_size?: PicklistItem[];
  } | null;
  error?: string | null;
};

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

// Convierte array a string (backward compatibility para objetivos/audiencia)
function arrayToString(v: unknown): string | null {
  if (Array.isArray(v)) {
    const cleaned = v.map((x) => String(x).trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(", ") : null;
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
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
  const [empresaIdInput, setEmpresaIdInput] = useState("");

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

  // ✅ Opciones dinámicas desde API
  const [leadOptions, setLeadOptions] = useState<{
    objetivos: string[];
    audiencia: string[];
    tamanios: string[];
  }>({
    objetivos: OBJETIVOS_OPTS_FALLBACK,
    audiencia: AUDIENCIA_OPTS_FALLBACK,
    tamanios: TAMANO_OPTS_FALLBACK,
  });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

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
      // Convertir objetivos/audiencia de array a string si vienen como array (backward compatibility)
      if (next) {
        if (Array.isArray(next.objetivos)) {
          next.objetivos = arrayToString(next.objetivos);
        }
        if (Array.isArray(next.audiencia)) {
          next.audiencia = arrayToString(next.audiencia);
        }
      }
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
      throw e; // Re-lanzar para que el caller pueda manejar el error
    } finally {
      setMutating(false);
    }
  }

  // Función reutilizable para guardar el draft actual
  async function saveDraft() {
    if (!id) return;
    
    // Solo guarda si hay cambios pendientes
    if (Object.keys(draft).length === 0) {
      return; // No hay cambios, no hace nada
    }

    const normalized: PatchPayload = {
      nombre: norm(draft.nombre),
      contacto: norm(draft.contacto),
      telefono: norm(draft.telefono),
      email: norm(draft.email),
      origen: norm(draft.origen),
      pipeline: norm(draft.pipeline),
      notas: norm(draft.notas),
      website: norm(draft.website),
      objetivos: norm(draft.objetivos),
      audiencia: norm(draft.audiencia),
      tamano: norm(draft.tamano),
      oferta: norm(draft.oferta),
      linkedin_empresa: norm(draft.linkedin_empresa),
      linkedin_director: norm(draft.linkedin_director),
      empresa_id: draft.empresa_id ?? null,
    };

    await patchLead(normalized);
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

  async function convertToMember() {
    if (!id || !lead) return;

    const ok = window.confirm(
      "¿Convertir este lead en socio? Se creará un registro en la tabla de socios."
    );
    if (!ok) return;

    setError(null);
    setMutating(true);
    try {
      // Primero guardar el draft pendiente
      await saveDraft();

      // Luego convertir a socio
      const res = await fetch(`/api/admin/leads/${id}/convert-to-member`, {
        method: "POST",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<any>;
      if (!res.ok) throw new Error(json?.error ?? "Error convirtiendo a socio");

      flash("Lead convertido en socio correctamente.");
      await fetchLead();
    } catch (e: any) {
      setError(e?.message ?? "Error convirtiendo a socio");
    } finally {
      setMutating(false);
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

  // ✅ Fetch opciones dinámicas desde API
  async function fetchLeadOptions() {
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const res = await fetch("/api/admin/config/leads/options", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadOptionsResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando opciones");

      const data = json?.data;
      if (!data) {
        throw new Error("No se recibieron opciones");
      }

      // Extraer labels de items activos y mapear a arrays de strings
      const objetivos =
        data.membership_goals
          ?.filter((item) => item.is_active)
          .map((item) => item.label.trim())
          .filter(Boolean) ?? [];

      const audiencia =
        data.icp_targets
          ?.filter((item) => item.is_active)
          .map((item) => item.label.trim())
          .filter(Boolean) ?? [];

      const tamanios =
        data.company_size
          ?.filter((item) => item.is_active)
          .map((item) => item.label.trim())
          .filter(Boolean) ?? [];

      // Solo actualizar si hay datos válidos, sino mantener fallback
      if (objetivos.length > 0 || audiencia.length > 0 || tamanios.length > 0) {
        setLeadOptions({
          objetivos: objetivos.length > 0 ? objetivos : OBJETIVOS_OPTS_FALLBACK,
          audiencia: audiencia.length > 0 ? audiencia : AUDIENCIA_OPTS_FALLBACK,
          tamanios: tamanios.length > 0 ? tamanios : TAMANO_OPTS_FALLBACK,
        });
      }
    } catch (e: any) {
      setOptionsError(e?.message ?? "Error cargando opciones");
      // Mantener fallback hardcodeado en caso de error
      setLeadOptions({
        objetivos: OBJETIVOS_OPTS_FALLBACK,
        audiencia: AUDIENCIA_OPTS_FALLBACK,
        tamanios: TAMANO_OPTS_FALLBACK,
      });
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    fetchLead();
    fetchLeadOptions();
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
      empresa_id: lead.empresa_id ?? null,
      origen: lead.origen ?? "",
      pipeline: lead.pipeline ?? "Nuevo",
      notas: lead.notas ?? "",

      website: lead.website ?? "",
      objetivos: typeof lead.objetivos === "string" ? lead.objetivos : (Array.isArray(lead.objetivos) ? lead.objetivos.join(", ") : ""),
      audiencia: typeof lead.audiencia === "string" ? lead.audiencia : (Array.isArray(lead.audiencia) ? lead.audiencia.join(", ") : ""),
      tamano: lead.tamano ?? "",
      oferta: lead.oferta ?? "",
      linkedin_empresa: lead.linkedin_empresa ?? "",
      linkedin_director: lead.linkedin_director ?? "",
    });
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setError(null);
  }

  async function saveEdit() {
    await saveDraft();
    setEditing(false);
  }

  const pipelineValue = useMemo(() => {
    if (editing) return (draft.pipeline as any) ?? "Nuevo";
    return lead?.pipeline ?? "—";
  }, [editing, draft.pipeline, lead?.pipeline]);

  const title = loading ? "Cargando…" : lead?.nombre ?? "Lead";
  const leadIdSafe = (id ?? lead?.id ?? "").trim();

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
                {lead?.is_member && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Socio
                    {lead.member_since && (
                      <span className="text-emerald-600">
                        desde {new Date(lead.member_since).toLocaleDateString("es-UY", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    )}
                  </span>
                )}
              </div>
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

              {!lead?.is_member && (
                <button
                  type="button"
                  onClick={convertToMember}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  disabled={disabled || !lead}
                  title="Convertir este lead en socio"
                >
                  Convertir en socio
                </button>
              )}

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

          {/* Warning si no está vinculado a empresa */}
          {!lead?.empresa_id && (
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-yellow-900">
                    Este lead no está vinculado a una empresa
                  </div>
                  <div className="mt-1 text-xs text-yellow-700">
                    Vincula este lead a una empresa para acceder a sus datos completos.
                  </div>
                </div>
                {editing && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={empresaIdInput}
                      onChange={(e) => setEmpresaIdInput(e.target.value)}
                      placeholder="ID de empresa"
                      className="h-9 w-48 rounded-xl border border-yellow-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-yellow-200"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!empresaIdInput.trim()) return;
                        setDraft((p) => ({ ...p, empresa_id: empresaIdInput.trim() || null }));
                        setEmpresaIdInput("");
                        // Guardar inmediatamente
                        try {
                          await patchLead({ empresa_id: empresaIdInput.trim() || null });
                          await fetchLead();
                        } catch (e: any) {
                          setError(e?.message ?? "Error vinculando empresa");
                        }
                      }}
                      className="rounded-xl border border-yellow-300 bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-900 hover:bg-yellow-200"
                    >
                      Vincular
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Sección: Datos de la empresa (solo lectura) */}
            {lead?.empresas && (
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">Datos de la empresa</div>
                <div className="mt-3 space-y-3">
                  <Field
                    label="Nombre"
                    editing={false}
                    value={lead.empresas.nombre ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Email"
                    editing={false}
                    value={lead.empresas.email ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Teléfono"
                    editing={false}
                    value={lead.empresas.telefono ?? ""}
                    onChange={() => {}}
                  />
                  {lead.empresas.celular && (
                    <Field
                      label="Celular"
                      editing={false}
                      value={lead.empresas.celular ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.rut && (
                    <Field
                      label="RUT"
                      editing={false}
                      value={lead.empresas.rut ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.direccion && (
                    <Field
                      label="Dirección"
                      editing={false}
                      value={lead.empresas.direccion ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.ciudad && (
                    <Field
                      label="Ciudad"
                      editing={false}
                      value={lead.empresas.ciudad ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.pais && (
                    <Field
                      label="País"
                      editing={false}
                      value={lead.empresas.pais ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.web && (
                    <Field
                      label="Web"
                      editing={false}
                      value={lead.empresas.web ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.instagram && (
                    <Field
                      label="Instagram"
                      editing={false}
                      value={lead.empresas.instagram ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead.empresas.rubros && (
                    <Field
                      label="Rubro"
                      editing={false}
                      value={lead.empresas.rubros.nombre ?? ""}
                      onChange={() => {}}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Sección: Datos del lead (editable) */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Datos del lead</div>

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

                <Field
                  label="LinkedIn Empresa"
                  editing={editing}
                  value={(editing ? (draft.linkedin_empresa as any) : lead?.linkedin_empresa) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, linkedin_empresa: v }))}
                  placeholder="https://linkedin.com/..."
                />

                <Field
                  label="LinkedIn Director"
                  editing={editing}
                  value={(editing ? (draft.linkedin_director as any) : lead?.linkedin_director) ?? ""}
                  onChange={(v) => setDraft((p) => ({ ...p, linkedin_director: v }))}
                  placeholder="https://linkedin.com/..."
                />

                <div>
                  <div className="text-xs text-slate-500">Objetivo</div>
                  {editing ? (
                    <textarea
                      value={(draft.objetivos as any) ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, objetivos: e.target.value }))}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Ej: Abrir mercado USA, conseguir distribuidores, networking, visibilidad..."
                    />
                  ) : (
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {lead?.objetivos ?? "—"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">A quién le vende</div>
                  {editing ? (
                    <textarea
                      value={(draft.audiencia as any) ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, audiencia: e.target.value }))}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Ej: Retailers/cadenas, importadores USA, empresas LATAM, B2B servicios profesionales..."
                    />
                  ) : (
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {lead?.audiencia ?? "—"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">Tamaño (checkbox único)</div>
                  {editing ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {leadOptions.tamanios.map((opt) => {
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
        <AiLeadReport
          key={`ai-${leadIdSafe}`}
          leadId={leadIdSafe}
          lead={lead}
          onBeforeGenerate={async () => {
            // Guardar el draft actual antes de generar el informe
            // Reutiliza la misma función que usa "Guardar"
            // Si falla, el error se propaga y no se llama a la IA
            await saveDraft();
          }}
        />

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