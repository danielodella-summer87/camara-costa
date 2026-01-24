"use client";

import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { LeadDocsModal } from "@/components/leads/LeadDocsModal";
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
  contacto_nombre?: string | null;
  contacto_celular?: string | null;
  contacto_email?: string | null;
  etiquetas?: string | null;
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
  meet_url?: string | null;

  rating?: number | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
  empresa_id?: string | null;
  empresas?: Empresa | null;
  score?: number | null;
  score_categoria?: string | null;
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
    | "meet_url"
    | "empresa_id"
    | "score"
    | "score_categoria"
  >
>;


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

  // ✅ Documentación
  const [docsOpen, setDocsOpen] = useState(false);

  // ✅ Meet Asistido
  const [startingMeet, setStartingMeet] = useState(false);
  const [meetWindowOpened, setMeetWindowOpened] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const meetWinRef = useRef<Window | null>(null);

  // ✅ Tabs
  const [activeTab, setActiveTab] = useState<"empresa" | "lead" | "ia">("empresa");

  // Función reutilizable para abrir Meet en ventana popup controlada
  function openMeetWindow(meetUrl: string) {
    // Si ya existe una ventana abierta y no cerrada, hacer focus y retornar
    if (meetWinRef.current && !meetWinRef.current.closed) {
      meetWinRef.current.focus();
      return;
    }

    const name = "meet_assistido_window";
    const width = 500;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
    const w = window.open(meetUrl, name, features);

    if (w === null) {
      // Popup bloqueado, fallback a nueva pestaña
      window.open(meetUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Ventana abierta exitosamente
    meetWinRef.current = w;
    w.focus();
    sessionStorage.setItem("meetWindowOpened", "true");
    setMeetWindowOpened(!!meetWinRef.current && !meetWinRef.current.closed);
  }

  // Monitorear estado de la ventana para detectar cierre
  useEffect(() => {
    // Interval para detectar cierre de ventana
    let intervalId: number | null = null;
    
    if (meetWindowOpened && meetWinRef.current) {
      intervalId = window.setInterval(() => {
        if (meetWinRef.current?.closed === true) {
          setMeetWindowOpened(false);
          sessionStorage.removeItem("meetWindowOpened");
          meetWinRef.current = null;
        } else {
          // Actualizar estado basado en estado real de la ventana
          setMeetWindowOpened(!!meetWinRef.current && !meetWinRef.current.closed);
        }
      }, 1500);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [meetWindowOpened]);

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
      meet_url: norm(draft.meet_url),
      empresa_id: draft.empresa_id ?? null,
      score: draft.score ?? null,
      score_categoria: draft.score_categoria ?? null,
    };

    await patchLead(normalized);
  }

  // Función para obtener sesión activa
  async function fetchActiveSession() {
    if (!id) return;
    
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/meet-sessions?status=active`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      
      const json = (await res.json()) as ApiResp<any>;
      if (res.ok && json?.data) {
        setActiveSession({ id: json.data.id });
      } else {
        setActiveSession(null);
      }
    } catch (e: any) {
      console.warn("Error obteniendo sesión activa:", e?.message);
      setActiveSession(null);
    } finally {
      setLoadingSession(false);
    }
  }

  async function startMeetSession() {
    if (!id) {
      setError("ID de lead no disponible");
      return;
    }

    // Si ya hay sesión activa, navegar a ella en lugar de crear una nueva
    if (activeSession?.id) {
      router.push(`/admin/leads/${id}/meet-sessions/${activeSession.id}`);
      return;
    }

    setStartingMeet(true);
    setError(null);
    try {
      // Determinar el URL final: usar el del lead o pedirlo al usuario
      let urlFinal: string | null = lead?.meet_url ?? null;

      if (!urlFinal || urlFinal.trim().length === 0) {
        // Pedir URL al usuario
        const urlInput = window.prompt("Pegá el link de Google Meet (https://meet.google.com/...)");
        
        if (!urlInput || urlInput.trim().length === 0) {
          setError("Debes ingresar un link de Google Meet");
          setStartingMeet(false);
          return;
        }

        const urlTrimmed = urlInput.trim();
        
        // Validar que empiece con "https://meet.google.com/"
        if (!urlTrimmed.startsWith("https://meet.google.com/")) {
          setError("El link debe empezar con https://meet.google.com/");
          setStartingMeet(false);
          return;
        }

        urlFinal = urlTrimmed;

        // Guardar el URL en el lead
        const patchRes = await fetch(`/api/admin/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meet_url: urlFinal }),
        });

        const patchJson = (await patchRes.json().catch(() => ({}))) as LeadApiResponse;
        if (!patchRes.ok) {
          throw new Error(patchJson?.error ?? "Error guardando el link de Meet");
        }

        // Actualizar el estado local del lead
        if (patchJson?.data) {
          setLead(patchJson.data);
        }
      }

      // Iniciar sesión con el URL final
      const res = await fetch(`/api/admin/leads/${id}/meet-sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meet_url: urlFinal }),
      });

      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok) {
        throw new Error(json?.error ?? "Error al iniciar sesión de Meet");
      }

      if (res.status === 201 && json?.data) {
        const session = json.data;
        const sessionId = session?.id;
        
        if (!sessionId) {
          throw new Error("No se recibió sessionId en la respuesta");
        }

        // Abrir Google Meet en ventana popup controlada
        if (urlFinal) {
          openMeetWindow(urlFinal);
        }

        flash("Sesión de Meet iniciada");

        // Redirigir inmediatamente a la pantalla exclusiva del Meet
        window.location.href = `/admin/leads/${id}/meet-sessions/${sessionId}`;
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error("Error desconocido");
      setError(error.message);
      setStartingMeet(false);
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
    fetchActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refrescar sesión activa después de iniciar una nueva
  useEffect(() => {
    if (!startingMeet) {
      fetchActiveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingMeet]);

  const disabled = loading || mutating || deleting;

  function startEdit() {
    if (!lead) return;
    setEditing(true);
    setDraft({
      nombre: lead.nombre ?? "",
      contacto: lead.contacto ?? "",
      score: lead.score ?? 0,
      score_categoria: lead.score_categoria ?? null,
      telefono: lead.telefono ?? "",
      email: lead.email ?? "",
      empresa_id: lead.empresa_id ?? null,
      origen: lead.origen ?? "",
      pipeline: lead.pipeline ?? "Nuevo",
      notas: lead.notas ?? "",

      website: lead.website ?? "",
      objetivos: lead.objetivos ?? "",
      audiencia: lead.audiencia ?? "",
      tamano: lead.tamano ?? "",
      oferta: lead.oferta ?? "",
      linkedin_empresa: lead.linkedin_empresa ?? "",
      linkedin_director: lead.linkedin_director ?? "",
      meet_url: lead.meet_url ?? "",
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

  const leadForAi = useMemo(() => {
    if (!lead) return null;

    const toArray = (value: unknown): string[] | null => {
      if (!value) return null;

      if (Array.isArray(value)) {
        return value.map(String).map(v => v.trim()).filter(Boolean);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed.split(",").map(v => v.trim()).filter(Boolean);
      }

      return null;
    };

    return {
      ...lead,
      objetivos: toArray(lead.objetivos),
      audiencia: toArray(lead.audiencia),
    };
  }, [lead]);

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
                Detalle, edición e informe IA.
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
                onClick={() => {
                  if (id) {
                    setDocsOpen(true);
                  }
                }}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={disabled || !id}
                title="Documentación PDF del lead"
              >
                Documentación
              </button>

              <button
                type="button"
                onClick={startMeetSession}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled || !id || startingMeet || loadingSession}
                title={activeSession ? "Ir a sesión activa de Meet asistido" : "Iniciar sesión de Meet asistido"}
              >
                {startingMeet ? "Iniciando…" : activeSession ? "Ir a Meet Asistido" : "Iniciar Meet Asistido"}
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

          {/* Tabs */}
          {lead && (
            <div className="mt-4 inline-flex overflow-hidden rounded-xl border bg-white">
              <button
                type="button"
                onClick={() => setActiveTab("empresa")}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "empresa"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                Datos Empresa
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("lead")}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "lead"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                Datos Lead
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ia")}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "ia"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                Agente IA
              </button>
            </div>
          )}

          {/* Warning si no está vinculado a empresa */}
          {!lead?.empresa_id && activeTab === "empresa" && (
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-yellow-900">
                    Este lead no está vinculado a una entidad
                  </div>
                  <div className="mt-1 text-xs text-yellow-700">
                    Vincula este lead a una entidad para acceder a sus datos completos.
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

          {/* Contenido de Tabs */}
          {activeTab === "empresa" && (
            <div className="mt-5 grid grid-cols-1 gap-4">
              {/* Sección: Datos de Empresa (base) - solo lectura */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">Datos de Entidad</div>
                <div className="mt-3 space-y-3">
                  <Field
                    label="Nombre"
                    editing={false}
                    value={lead?.empresas?.nombre ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Contacto"
                    editing={false}
                    value={lead?.empresas?.contacto_nombre ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Teléfono"
                    editing={false}
                    value={lead?.empresas?.telefono ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Email"
                    editing={false}
                    value={lead?.empresas?.email ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Rubro"
                    editing={false}
                    value={lead?.empresas?.rubros?.nombre ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Dirección"
                    editing={false}
                    value={lead?.empresas?.direccion ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Website"
                    editing={false}
                    value={lead?.empresas?.web ?? ""}
                    onChange={() => {}}
                  />
                  <Field
                    label="Instagram"
                    editing={false}
                    value={lead?.empresas?.instagram ?? ""}
                    onChange={() => {}}
                  />
                  {lead?.empresas?.celular && (
                    <Field
                      label="Celular"
                      editing={false}
                      value={lead.empresas.celular ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead?.empresas?.rut && (
                    <Field
                      label="RUT"
                      editing={false}
                      value={lead.empresas.rut ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead?.empresas?.ciudad && (
                    <Field
                      label="Ciudad"
                      editing={false}
                      value={lead.empresas.ciudad ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead?.empresas?.pais && (
                    <Field
                      label="País"
                      editing={false}
                      value={lead.empresas.pais ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead?.empresas?.contacto_celular && (
                    <Field
                      label="Contacto (celular)"
                      editing={false}
                      value={lead.empresas.contacto_celular ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead?.empresas?.contacto_email && (
                    <Field
                      label="Contacto (email)"
                      editing={false}
                      value={lead.empresas.contacto_email ?? ""}
                      onChange={() => {}}
                    />
                  )}
                  {lead?.empresas?.etiquetas && (
                    <Field
                      label="Etiquetas"
                      editing={false}
                      value={lead.empresas.etiquetas ?? ""}
                      onChange={() => {}}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "lead" && (
            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">
                  Estado Comercial
                </div>

                <div className="mt-3 space-y-3">
                  {/* Score (0-10 estrellas) */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">
                      Calidad del lead
                    </div>
                    {editing ? (
                      <StarRating
                        value={draft.score ?? null}
                        onChange={(v) => setDraft((p) => ({ ...p, score: v }))}
                        disabled={disabled}
                      />
                    ) : (
                      <>
                        {lead?.score !== null && lead?.score !== undefined ? (
                          <>
                            <StarRating
                              value={lead.score}
                              onChange={() => {}}
                              disabled={true}
                            />
                            {lead?.score_categoria && (
                              <div className="mt-1 text-xs text-slate-500">
                                Categoría IA: {lead.score_categoria}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-slate-500">
                            Sin score IA
                          </div>
                        )}
                      </>
                    )}
                  </div>

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
                  <div className="text-xs text-slate-500">Google Meet URL</div>
                  {editing ? (
                    <input
                      value={(draft.meet_url as any) ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, meet_url: e.target.value }))}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    />
                  ) : (
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {lead?.meet_url ? (
                        <a
                          href={lead.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {lead.meet_url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  )}
                </div>

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
          )}

          {activeTab === "ia" && (
            <div className="mt-5">
              {/* ✅ Agente IA (FODA + oportunidades + PDF) */}
              <AiLeadReport
                key={`ai-${leadIdSafe}`}
                leadId={leadIdSafe}
                lead={leadForAi as any}
                onBeforeGenerate={async () => {
                  // Guardar el draft actual antes de generar el informe
                  // Reutiliza la misma función que usa "Guardar"
                  // Si falla, el error se propaga y no se llama a la IA
                  await saveDraft();
                }}
              />
            </div>
          )}

          {!loading && !lead && (
            <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              No se encontró el lead.
            </div>
          )}
        </div>

        {/* ✅ Meet Asistido */}
        {lead && (
          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Meet Asistido</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Inicia una sesión de coaching en vivo con transcripción y semáforo estratégico
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {lead.meet_url && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (lead.meet_url) {
                          openMeetWindow(lead.meet_url);
                        }
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Abrir Meet (Ventana)
                    </button>
                    {meetWindowOpened && (
                      <div className="text-xs text-slate-600 text-center">
                        Meet abierto en ventana externa
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {activeSession ? (
              <div className="mt-4">
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold mb-2">Sesión activa</div>
                  <div className="text-xs text-slate-600 mb-3">
                    Hay una sesión de Meet Asistido en curso. Usá el botón superior "Ir a Meet Asistido" para acceder al panel de coaching.
                  </div>
                  <Link
                    href={`/admin/leads/${id}/meet-sessions/${activeSession.id}`}
                    className="inline-block rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Abrir panel de sesión
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                No hay una sesión activa. Iniciá Meet Asistido desde el botón superior.
              </div>
            )}
          </div>
        )}


        <LeadDocsModal
          open={docsOpen}
          onClose={() => setDocsOpen(false)}
          leadId={id ?? ""}
          leadName={lead?.nombre ?? null}
        />
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

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const handleClick = (star: number) => {
    if (disabled) return;
    // Si clickeamos la misma estrella que ya está seleccionada, la deseleccionamos (null)
    if (value === star) {
      onChange(null);
    } else {
      onChange(star);
    }
  };

  // Si value es null, no mostrar estrellas (solo en modo lectura)
  if (value === null && disabled) {
    return null;
  }

  // Normalizar: null se trata como 0 solo para mostrar estrellas (en modo edición)
  const normalizedValue = value ?? 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={disabled}
            className={`text-xl transition-all ${
              star <= normalizedValue
                ? "text-yellow-400"
                : "text-slate-300"
            } ${
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:scale-110"
            }`}
            title={normalizedValue === star ? "Quitar score" : `Calificar ${star}/10`}
          >
            ★
          </button>
        ))}
      </div>
      {normalizedValue === 0 && !disabled && (
        <span className="text-xs text-slate-500">Sin calificar</span>
      )}
      {normalizedValue > 0 && (
        <span className="text-xs text-slate-600">
          {normalizedValue}/10
        </span>
      )}
    </div>
  );
}