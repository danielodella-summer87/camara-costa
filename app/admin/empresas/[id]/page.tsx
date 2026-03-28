"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RubroSelect from "../RubroSelect";
import {
  ESTADOS_REVISION_INICIATIVA,
  badgeClassEstadoRevision,
  labelEstadoRevisionIniciativa,
} from "@/lib/crm/iniciativaEstadoRevision";
import { linkedinExternalHref } from "@/lib/social/linkedinUrl";
import {
  INITIATIVE_KIND_STANDARD,
  INITIATIVE_KIND_STARTUP,
  MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH,
  isStartupInitiativeKind,
} from "@/lib/crm/initiativeKind";

type Empresa = {
  id: string;
  nombre: string;
  tipo?: "empresa" | "profesional" | "institucion" | null;
  rubro: string | null; // nombre (display) - legacy
  rubro_id: string | null; // UUID real
  rubros?: { id: string; nombre: string } | null; // join a rubros
  estado: string | null;
  aprobada: boolean | null;
  descripcion?: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  instagram?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  direccion?: string | null;
  created_at?: string;
  updated_at?: string;
  import_batch_id?: string | null;
  import_row_number?: number | null;
  estado_revision?: string | null;
  fuente_remota?: string | null;
  score_preliminar?: number | null;
  converted_lead_id?: string | null;
  initiative_kind?: string | null;
  project_description?: string | null;
  contacto_nombre?: string | null;
  entity_import_batches?: {
    id: string;
    concepto: string | null;
    created_at: string;
    filename: string | null;
  } | null;
};

type EmpresaApiResponse = {
  data?: Empresa | null;
  error?: string | null;
};

// lo que mandamos al PATCH (usa rubro_id, no rubro nombre)
type PatchPayload = Partial<
  Pick<
    Empresa,
    | "nombre"
    | "tipo"
    | "rubro_id"
    | "telefono"
    | "email"
    | "web"
    | "instagram"
    | "linkedin_empresa"
    | "linkedin_personal"
    | "direccion"
    | "descripcion"
    | "initiative_kind"
    | "project_description"
    | "contacto_nombre"
    | "aprobada"
    | "estado"
    | "estado_revision"
    | "fuente_remota"
    | "score_preliminar"
  >
>;

function normalizeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normalizeWebUrl(web: string | null | undefined): string | null {
  if (!web) return null;
  const trimmed = web.trim();
  if (!trimmed) return null;

  // Si ya tiene protocolo (http:// o https://), devolver tal cual
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Si no tiene protocolo, agregar https://
  return `https://${trimmed}`;
}

export default function EmpresaDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = (params as any)?.id as string | string[] | undefined;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Aviso amistoso si el backend responde 409 (idempotencia). */
  const [convertConflict, setConvertConflict] = useState<{
    leadId: string;
    code: "already_converted" | "ACTIVE_LEAD_EXISTS";
  } | null>(null);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [leadsCount, setLeadsCount] = useState<number | null>(null);

  // modo edición
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatchPayload>({});

  // Modal nuevo rubro
  const [showNewRubroModal, setShowNewRubroModal] = useState(false);
  const [newRubroNombre, setNewRubroNombre] = useState("");
  const [creatingRubro, setCreatingRubro] = useState(false);
  const [rubroError, setRubroError] = useState<string | null>(null);
  const [rubroRefreshTrigger, setRubroRefreshTrigger] = useState(0);
  const [newRubroId, setNewRubroId] = useState<string | null>(null);
  const [digitalOpenEdit, setDigitalOpenEdit] = useState(false);

  async function fetchEmpresa(targetId?: string) {
    const finalId = targetId ?? id;
    if (!finalId) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/empresas/${finalId}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as EmpresaApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando iniciativa");

      const next = (json?.data ?? null) as Empresa | null;

      setEmpresa(
        next
          ? {
              ...next,
              rubro_id: (next as any).rubro_id ?? null,
            }
          : null
      );

      setLeadsCount(null);
      fetch(`/api/admin/leads?empresa_id=${finalId}&limit=500`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { data?: unknown[] }) => {
          setLeadsCount(Array.isArray(j?.data) ? j.data.length : 0);
        })
        .catch(() => setLeadsCount(0));

      // si NO estoy editando, limpio draft
      if (!editing) setDraft({});
    } catch (e: any) {
      setError(e?.message ?? "Error cargando iniciativa");
      setEmpresa(null);
    } finally {
      setLoading(false);
    }
  }

  async function patchEmpresa(payload: PatchPayload) {
    if (!id) return;

    setError(null);
    setMutating(true);

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

      await fetchEmpresa(id);
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando iniciativa");
    } finally {
      setMutating(false);
    }
  }

  // ✅ CLAVE: cuando cambia el ID (navegás a otra empresa), reseteamos edición y draft
  useEffect(() => {
    setEditing(false);
    setDraft({});
    setError(null);
    setNewRubroId(null);
    fetchEmpresa(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-seleccionar nuevo rubro después de que se refresque la lista
  useEffect(() => {
    if (newRubroId && rubroRefreshTrigger > 0) {
      // Pequeño delay para asegurar que el selector se haya actualizado
      const timer = setTimeout(() => {
        setDraft((d) => ({ ...d, rubro_id: newRubroId }));
        setNewRubroId(null); // Limpiar después de seleccionar
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [newRubroId, rubroRefreshTrigger]);

  function startEdit() {
    if (!empresa) return;
    setEditing(true);
    setDraft({
      nombre: empresa.nombre ?? "",
      tipo: (empresa.tipo ?? "empresa") as "empresa" | "profesional" | "institucion",
      rubro_id: empresa.rubro_id ?? null, // ✅ IMPORTANTE
      contacto_nombre: empresa.contacto_nombre ?? "",
      telefono: empresa.telefono ?? "",
      email: empresa.email ?? "",
      web: empresa.web ?? "",
      instagram: empresa.instagram ?? "",
      linkedin_empresa: empresa.linkedin_empresa ?? "",
      linkedin_personal: empresa.linkedin_personal ?? "",
      direccion: empresa.direccion ?? "",
      descripcion: empresa.descripcion ?? "",
      initiative_kind: (empresa.initiative_kind ?? INITIATIVE_KIND_STANDARD) as
        | typeof INITIATIVE_KIND_STANDARD
        | typeof INITIATIVE_KIND_STARTUP,
      project_description: empresa.project_description ?? "",
      estado_revision: (empresa.estado_revision ?? "en_revision") as Empresa["estado_revision"],
      fuente_remota: empresa.fuente_remota ?? "",
      score_preliminar:
        empresa.score_preliminar != null && !Number.isNaN(empresa.score_preliminar)
          ? empresa.score_preliminar
          : null,
    });
    setDigitalOpenEdit(isStartupInitiativeKind(empresa.initiative_kind));
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setError(null);
  }

  async function saveEdit() {
    const kind =
      draft.initiative_kind === INITIATIVE_KIND_STARTUP ? INITIATIVE_KIND_STARTUP : INITIATIVE_KIND_STANDARD;
    const projRaw = typeof draft.project_description === "string" ? draft.project_description.trim() : "";
    if (kind === INITIATIVE_KIND_STARTUP && projRaw.length < MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH) {
      setError(`Modo startup: «Describa su proyecto» debe tener al menos ${MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }

    const normalized: PatchPayload = {
      nombre: normalizeStr(draft.nombre) ?? undefined,
      tipo: draft.tipo ?? "empresa",
      rubro_id: draft.rubro_id ?? null,
      contacto_nombre: normalizeStr(draft.contacto_nombre as unknown as string),
      telefono: normalizeStr(draft.telefono),
      email: normalizeStr(draft.email),
      web: normalizeStr(draft.web),
      instagram: normalizeStr(draft.instagram),
      linkedin_empresa: normalizeStr(draft.linkedin_empresa as unknown as string),
      linkedin_personal: normalizeStr(draft.linkedin_personal as unknown as string),
      direccion: normalizeStr(draft.direccion),
      descripcion: normalizeStr(draft.descripcion),
      initiative_kind: kind,
      project_description: kind === INITIATIVE_KIND_STARTUP ? projRaw || null : normalizeStr(draft.project_description as unknown as string),
      estado_revision: typeof draft.estado_revision === "string" ? draft.estado_revision : undefined,
      fuente_remota: normalizeStr(draft.fuente_remota as unknown as string),
      score_preliminar: (() => {
        const v = draft.score_preliminar as number | string | null | undefined;
        if (v === null || v === undefined) return null;
        if (typeof v === "string" && v.trim() === "") return null;
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isNaN(n)) return null;
        const r = Math.round(n);
        if (r < 0 || r > 10) return null;
        return r;
      })(),
    };

    await patchEmpresa(normalized);
    setEditing(false);
  }

  async function createNewRubro() {
    const nombre = newRubroNombre.trim();
    if (!nombre) {
      setRubroError("El nombre del rubro es requerido");
      return;
    }

    setRubroError(null);
    setCreatingRubro(true);

    try {
      const res = await fetch("/api/admin/rubros", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ nombre }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Error creando rubro");
      }

      const newRubro = json.data;
      if (newRubro?.id && newRubro?.nombre) {
        // Guardar el ID del nuevo rubro para auto-seleccionarlo después del refresh
        setNewRubroId(newRubro.id);

        // Refrescar la lista de rubros
        setRubroRefreshTrigger((prev) => prev + 1);

        // Cerrar modal y limpiar
        setShowNewRubroModal(false);
        setNewRubroNombre("");
      }
    } catch (e: any) {
      setRubroError(e?.message ?? "Error creando rubro");
    } finally {
      setCreatingRubro(false);
    }
  }

  async function convertToLead() {
    const empresaId = id;

    if (!empresaId) {
      setError("Falta el identificador de la iniciativa en la URL.");
      return;
    }

    try {
      setError(null);
      setConvertConflict(null);

      const res = await fetch(
        `/api/admin/empresas/${empresaId}/convert-to-lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const json = await res.json();
      const conflictId =
        typeof json?.data?.lead_id === "string" ? json.data.lead_id.trim() : "";
      if (res.status === 409 && conflictId) {
        const code =
          json?.data?.code === "ACTIVE_LEAD_EXISTS" ? "ACTIVE_LEAD_EXISTS" : "already_converted";
        setConvertConflict({ leadId: conflictId, code });
        await fetchEmpresa(empresaId);
        return;
      }
      if (!res.ok) {
        const msg =
          typeof json?.error === "string" ? json.error : "No se pudo convertir a lead.";
        setError(msg);
        return;
      }

      const leadId = json?.data?.lead_id;
      if (!leadId) {
        setError("No se recibió el identificador del lead creado.");
        return;
      }

      router.push(`/admin/leads87/${leadId}`);
    } catch (e: any) {
      setError(e.message || "Error al convertir");
    }
  }

  const disabled = loading || mutating;
  const revision = (empresa?.estado_revision ?? "").trim().toLowerCase();
  const cannotConvertToLead = revision === "descartada" || revision === "convertida_a_lead";
  const convertedLeadId = empresa?.converted_lead_id?.trim() || null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {loading ? "Cargando…" : empresa?.nombre ?? "Iniciativa"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Ingreso preliminar antes del lead comercial. Validá datos y, cuando corresponda, convertí a lead (se guarda un snapshot en el lead).
            </p>
            {empresa && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClassEstadoRevision(empresa.estado_revision)}`}
                >
                  {labelEstadoRevisionIniciativa(empresa.estado_revision)}
                </span>
                {empresa.fuente_remota?.trim() ? (
                  <span className="text-xs text-slate-500">Fuente: {empresa.fuente_remota.trim()}</span>
                ) : null}
                {typeof empresa.score_preliminar === "number" ? (
                  <span className="text-xs text-slate-500">Score preliminar: {empresa.score_preliminar}/10</span>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchEmpresa(id)}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled}
            >
              Refrescar
            </button>

            {!editing ? (
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={disabled || !empresa}
                >
                  Editar
                </button>

                <div className="flex flex-col items-start gap-0.5">
                  {convertedLeadId ? (
                    <Link
                      href={`/admin/leads87/${convertedLeadId}`}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                    >
                      Abrir lead vinculado
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={convertToLead}
                      className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={disabled || !empresa || cannotConvertToLead}
                      title={
                        cannotConvertToLead
                          ? revision === "descartada"
                            ? "Iniciativa descartada: no se puede convertir a lead."
                            : "Ya convertida a lead: usá «Abrir lead vinculado»."
                          : "Crear lead comercial con snapshot de esta iniciativa"
                      }
                    >
                      Convertir a lead
                    </button>
                  )}
                  {leadsCount !== null && leadsCount > 0 && (
                    <p className="text-sm text-slate-600">
                      {leadsCount} lead{leadsCount !== 1 ? "s" : ""} vinculado{leadsCount !== 1 ? "s" : ""}{" "}
                      <Link href={`/admin/leads?empresa_id=${id}`} className="font-medium text-blue-600 hover:underline">
                        ver en listado
                      </Link>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={disabled}
                >
                  Guardar
                </button>

                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={disabled}
                >
                  Cancelar
                </button>
              </>
            )}

            <Link
              href="/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      {empresa && convertedLeadId ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-emerald-900">Convertida a lead</p>
              <p className="mt-1 text-emerald-800/95">
                El comercial trabaja sobre el lead (datos en snapshot). No es necesario volver a convertir.
              </p>
            </div>
            <Link
              href={`/admin/leads87/${convertedLeadId}`}
              className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100/80"
            >
              Abrir lead vinculado
            </Link>
          </div>
        </div>
      ) : null}

      {convertConflict ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold text-amber-900">
            {convertConflict.code === "ACTIVE_LEAD_EXISTS"
              ? "Ya hay un lead activo para esta iniciativa"
              : "Esta iniciativa ya fue convertida a lead"}
          </p>
          <p className="mt-1 text-amber-800/95">
            {convertConflict.code === "ACTIVE_LEAD_EXISTS"
              ? "Con la configuración actual no se permite otro lead activo (los pipelines de cierre no cuentan como activos). Abrí el lead existente o cerrá el pipeline del anterior."
              : "No se creó otro lead. Podés abrir el existente en LEADS87 o en el listado de leads."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/admin/leads87/${convertConflict.leadId}`}
              className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100/80"
            >
              Abrir lead en LEADS87
            </Link>
            <Link
              href={`/admin/leads/${convertConflict.leadId}`}
              className="inline-flex rounded-xl border border-amber-200 bg-transparent px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100/50"
            >
              Ficha clásica
            </Link>
            <button
              type="button"
              onClick={() => setConvertConflict(null)}
              className="rounded-xl border border-amber-200 bg-transparent px-4 py-2 text-sm text-amber-900 hover:bg-amber-100/50"
            >
              Cerrar aviso
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Cargando datos…</div>
        ) : !empresa ? (
          <div className="text-sm text-slate-500">No se encontró la iniciativa.</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              {!editing ? (
                <>
                  <Field
                    label="Clasificación"
                    value={
                      empresa.tipo === "empresa"
                        ? "Empresa"
                        : empresa.tipo === "profesional"
                        ? "Profesional"
                        : empresa.tipo === "institucion"
                        ? "Institución"
                        : "—"
                    }
                  />
                  <Field
                    label="Tipo de iniciativa"
                    value={
                      isStartupInitiativeKind(empresa.initiative_kind)
                        ? "Startup / proyecto temprano"
                        : "Estándar"
                    }
                  />
                  <Field
                    label="Rubro"
                    value={(empresa.rubros as any)?.nombre ?? empresa.rubro ?? "—"}
                  />
                  <Field label="Contacto" value={empresa.contacto_nombre?.trim() || "—"} />
                  <Field label="Teléfono" value={empresa.telefono ?? "—"} />
                  <Field label="Email" value={empresa.email ?? "—"} />
                  <Field label="Dirección" value={empresa.direccion ?? "—"} />
                  <Field
                    label="Estado de revisión"
                    value={labelEstadoRevisionIniciativa(empresa.estado_revision)}
                  />
                  <Field label="Fuente remota" value={empresa.fuente_remota?.trim() || "—"} />
                  <Field
                    label="Score preliminar"
                    value={
                      typeof empresa.score_preliminar === "number"
                        ? `${empresa.score_preliminar}/10`
                        : "—"
                    }
                  />
                </>
              ) : (
                <>
                  <InputField
                    label="Nombre"
                    value={(draft.nombre as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, nombre: v }))}
                    disabled={disabled}
                  />

                  <div className="rounded-xl border p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Modo comercial</div>
                    <select
                      value={(draft.initiative_kind as string) ?? INITIATIVE_KIND_STANDARD}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          initiative_kind: e.target.value as typeof INITIATIVE_KIND_STANDARD | typeof INITIATIVE_KIND_STARTUP,
                        }))
                      }
                      disabled={disabled}
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value={INITIATIVE_KIND_STANDARD}>Estándar</option>
                      <option value={INITIATIVE_KIND_STARTUP}>Startup / proyecto temprano</option>
                    </select>
                  </div>

                  <InputField
                    label="Contacto (nombre)"
                    value={(draft.contacto_nombre as string) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, contacto_nombre: v }))}
                    disabled={disabled}
                  />

                  <div className="rounded-xl border p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Clasificación</div>
                    <select
                      value={(draft.tipo as any) ?? "empresa"}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          tipo: e.target.value as "empresa" | "profesional" | "institucion",
                        }))
                      }
                      disabled={disabled}
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                    >
                      <option value="empresa">Empresa</option>
                      <option value="profesional">Profesional</option>
                      <option value="institucion">Institución</option>
                    </select>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-slate-600">
                        Rubro
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewRubroModal(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        disabled={disabled}
                      >
                        + Rubro
                      </button>
                    </div>
                    <div className="mt-2">
                      <RubroSelect
                        value={(newRubroId ??
                          draft.rubro_id ??
                          empresa.rubro_id) ?? null}
                        onChange={(nextId) => {
                          setDraft((d) => ({ ...d, rubro_id: nextId }));
                          if (nextId !== newRubroId) {
                            setNewRubroId(null);
                          }
                        }}
                        disabled={disabled}
                        refreshTrigger={rubroRefreshTrigger}
                      />
                    </div>
                  </div>

                  <InputField
                    label="Teléfono"
                    value={(draft.telefono as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, telefono: v }))}
                    disabled={disabled}
                  />

                  <InputField
                    label="Email"
                    value={(draft.email as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
                    disabled={disabled}
                  />

                  <InputField
                    label="Dirección"
                    value={(draft.direccion as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, direccion: v }))}
                    disabled={disabled}
                  />

                  <div className="rounded-xl border p-4 md:col-span-2">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Estado de revisión</div>
                    <select
                      value={(draft.estado_revision as string) ?? "en_revision"}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, estado_revision: e.target.value }))
                      }
                      disabled={disabled || revision === "convertida_a_lead"}
                      className="w-full max-w-md rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {ESTADOS_REVISION_INICIATIVA.map((k) => (
                        <option
                          key={k}
                          value={k}
                          disabled={
                            k === "convertida_a_lead" && revision !== "convertida_a_lead"
                          }
                        >
                          {labelEstadoRevisionIniciativa(k)}
                        </option>
                      ))}
                    </select>
                    {revision === "convertida_a_lead" ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Convertida a lead: el estado queda fijado salvo corrección en base de datos.
                      </p>
                    ) : null}
                  </div>

                  <InputField
                    label="Fuente remota (ej. LinkedIn)"
                    value={(draft.fuente_remota as string) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, fuente_remota: v }))}
                    disabled={disabled}
                    placeholder="integración / campaña"
                  />

                  <div className="rounded-xl border p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">
                      Score preliminar (0–10)
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      value={
                        draft.score_preliminar === null || draft.score_preliminar === undefined
                          ? ""
                          : String(draft.score_preliminar)
                      }
                      onChange={(e) => {
                        const t = e.target.value.trim();
                        if (!t) setDraft((d) => ({ ...d, score_preliminar: null }));
                        else {
                          const n = Number(t);
                          setDraft((d) => ({
                            ...d,
                            score_preliminar: Number.isNaN(n) ? null : n,
                          }));
                        }
                      }}
                      disabled={disabled}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            {!editing ? (
              <>
                {empresa.project_description?.trim() ? (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <div className="text-xs font-semibold text-indigo-900">Describa su proyecto</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                      {empresa.project_description}
                    </div>
                  </div>
                ) : null}
                {empresa.descripcion ? (
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-600">Descripción</div>
                    <div className="mt-1 text-sm text-slate-800">{empresa.descripcion}</div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {isStartupInitiativeKind(draft.initiative_kind as string) ? (
                  <TextareaField
                    label={`Describa su proyecto (mín. ${MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH} caracteres)`}
                    value={(draft.project_description as string) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, project_description: v }))}
                    disabled={disabled}
                    rows={12}
                  />
                ) : (
                  <TextareaField
                    label="Descripción (opcional)"
                    value={(draft.descripcion as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, descripcion: v }))}
                    disabled={disabled}
                  />
                )}
              </>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {!editing ? (
                <>
                  <Field label="Web" value={empresa.web ?? "—"} />
                  <Field label="Instagram" value={empresa.instagram ?? "—"} />
                  <Field label="LinkedIn organización" value={empresa.linkedin_empresa?.trim() || "—"} />
                  <Field label="LinkedIn contacto" value={empresa.linkedin_personal?.trim() || "—"} />
                </>
              ) : isStartupInitiativeKind(draft.initiative_kind as string) ? (
                <div className="md:col-span-2 space-y-3 rounded-xl border p-4">
                  <button
                    type="button"
                    onClick={() => setDigitalOpenEdit((o) => !o)}
                    className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-800"
                  >
                    <span>Presencia digital (opcional)</span>
                    <span className="text-slate-400">{digitalOpenEdit ? "▲" : "▼"}</span>
                  </button>
                  {digitalOpenEdit ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <InputField
                        label="Web"
                        value={(draft.web as any) ?? ""}
                        onChange={(v) => setDraft((d) => ({ ...d, web: v }))}
                        disabled={disabled}
                        placeholder="https://…"
                      />
                      <InputField
                        label="Instagram"
                        value={(draft.instagram as any) ?? ""}
                        onChange={(v) => setDraft((d) => ({ ...d, instagram: v }))}
                        disabled={disabled}
                        placeholder="https://instagram.com/…"
                      />
                      <InputField
                        label="LinkedIn organización"
                        value={(draft.linkedin_empresa as any) ?? ""}
                        onChange={(v) => setDraft((d) => ({ ...d, linkedin_empresa: v }))}
                        disabled={disabled}
                        placeholder="https://linkedin.com/company/…"
                      />
                      <InputField
                        label="LinkedIn contacto"
                        value={(draft.linkedin_personal as any) ?? ""}
                        onChange={(v) => setDraft((d) => ({ ...d, linkedin_personal: v }))}
                        disabled={disabled}
                        placeholder="https://linkedin.com/in/…"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <InputField
                    label="Web"
                    value={(draft.web as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, web: v }))}
                    disabled={disabled}
                    placeholder="https://…"
                  />
                  <InputField
                    label="Instagram"
                    value={(draft.instagram as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, instagram: v }))}
                    disabled={disabled}
                    placeholder="https://instagram.com/…"
                  />
                  <InputField
                    label="LinkedIn organización"
                    value={(draft.linkedin_empresa as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, linkedin_empresa: v }))}
                    disabled={disabled}
                    placeholder="https://linkedin.com/company/…"
                  />
                  <InputField
                    label="LinkedIn contacto"
                    value={(draft.linkedin_personal as any) ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, linkedin_personal: v }))}
                    disabled={disabled}
                    placeholder="https://linkedin.com/in/…"
                  />
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {normalizeWebUrl(empresa.web) ? (
                <a
                  href={normalizeWebUrl(empresa.web)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir web
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-xl border px-4 py-2 text-sm text-slate-400 cursor-not-allowed opacity-50"
                >
                  Abrir web
                </button>
              )}

              {empresa.instagram ? (
                <a
                  href={empresa.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir Instagram
                </a>
              ) : null}
              {linkedinExternalHref(empresa.linkedin_empresa) ? (
                <a
                  href={linkedinExternalHref(empresa.linkedin_empresa)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir LinkedIn organización
                </a>
              ) : null}
              {linkedinExternalHref(empresa.linkedin_personal) ? (
                <a
                  href={linkedinExternalHref(empresa.linkedin_personal)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir LinkedIn contacto
                </a>
              ) : null}
            </div>

            {/* Origen de importación */}
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Origen
              </div>
              {empresa.entity_import_batches ? (
                <div className="text-sm text-slate-700">
                  <div>
                    Importada el{" "}
                    {new Date(empresa.entity_import_batches.created_at).toLocaleDateString("es-UY", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  {empresa.entity_import_batches.concepto && (
                    <div className="mt-1 text-slate-600">
                      {empresa.entity_import_batches.concepto}
                    </div>
                  )}
                  {empresa.entity_import_batches.filename && (
                    <div className="mt-1 text-xs text-slate-500">
                      Archivo: {empresa.entity_import_batches.filename}
                    </div>
                  )}
                  {empresa.import_row_number && (
                    <div className="mt-1 text-xs text-slate-500">
                      Fila: {empresa.import_row_number}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-700">
                  Creada manualmente
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo rubro */}
      {showNewRubroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Nuevo rubro
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Nombre del rubro
                </label>
                <input
                  type="text"
                  value={newRubroNombre}
                  onChange={(e) => {
                    setNewRubroNombre(e.target.value);
                    setRubroError(null);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      newRubroNombre.trim() &&
                      !creatingRubro
                    ) {
                      createNewRubro();
                    } else if (e.key === "Escape") {
                      setShowNewRubroModal(false);
                      setNewRubroNombre("");
                      setRubroError(null);
                    }
                  }}
                  placeholder="Ej: Construcción"
                  className="w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  disabled={creatingRubro}
                />
                {rubroError && (
                  <div className="mt-2 text-xs text-red-600">{rubroError}</div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRubroModal(false);
                    setNewRubroNombre("");
                    setRubroError(null);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={creatingRubro}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={createNewRubro}
                  disabled={!newRubroNombre.trim() || creatingRubro}
                  className="rounded-xl border bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingRubro ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  disabled,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        className="mt-2 min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
      />
    </div>
  );
}