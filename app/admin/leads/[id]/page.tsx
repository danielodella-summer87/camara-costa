"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

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
};

type LeadApiResponse = {
  data?: Lead | null;
  error?: string | null;
};

type PatchPayload = Partial<
  Pick<Lead, "nombre" | "contacto" | "telefono" | "email" | "origen" | "pipeline" | "notas">
>;

function norm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
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

    const ok = window.confirm("¿Eliminar este lead? Esta acción no se puede deshacer.");
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

      // ✅ volvemos al listado y refrescamos
      router.push("/admin/leads");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando lead");
    } finally {
      setDeleting(false);
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
    };

    await patchLead(normalized);
    setEditing(false);
  }

  const pipelineValue = useMemo(() => {
    if (editing) return (draft.pipeline as any) ?? "Nuevo";
    return lead?.pipeline ?? "—";
  }, [editing, draft.pipeline, lead?.pipeline]);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {loading ? "Cargando…" : lead?.nombre ?? "Lead"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">Detalle, edición y eliminación.</p>
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
                    onClick={saveEdit}
                    className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={disabled}
                  >
                    {mutating ? "Guardando…" : "Guardar"}
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

              <button
                type="button"
                onClick={deleteLead}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                disabled={disabled || editing || !lead}
                title={editing ? "Guardá o cancelá la edición antes de eliminar" : "Eliminar lead"}
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>

              <Link
                href="/admin/leads"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Volver
              </Link>
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
        </div>

        <div className="rounded-2xl border bg-white p-6">
          {loading ? (
            <div className="text-sm text-slate-500">Cargando datos…</div>
          ) : !lead ? (
            <div className="text-sm text-slate-500">No se encontró el lead.</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {!editing ? (
                  <>
                    <Field label="Contacto" value={lead.contacto ?? "—"} />
                    <Field label="Pipeline" value={lead.pipeline ?? "—"} />
                    <Field label="Teléfono" value={lead.telefono ?? "—"} />
                    <Field label="Email" value={lead.email ?? "—"} />
                    <Field label="Origen" value={lead.origen ?? "—"} />
                    <Field label="Estado" value={lead.estado ?? "—"} />
                  </>
                ) : (
                  <>
                    <InputField
                      label="Nombre *"
                      value={(draft.nombre as any) ?? ""}
                      onChange={(v) => setDraft((d) => ({ ...d, nombre: v }))}
                      disabled={disabled}
                    />
                    <InputField
                      label="Contacto"
                      value={(draft.contacto as any) ?? ""}
                      onChange={(v) => setDraft((d) => ({ ...d, contacto: v }))}
                      disabled={disabled}
                    />
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
                      label="Origen"
                      value={(draft.origen as any) ?? ""}
                      onChange={(v) => setDraft((d) => ({ ...d, origen: v }))}
                      disabled={disabled}
                    />

                    <div className="rounded-xl border p-4">
                      <div className="text-xs font-semibold text-slate-600">Pipeline</div>
                      <select
                        value={(draft.pipeline as any) ?? "Nuevo"}
                        onChange={(e) => setDraft((d) => ({ ...d, pipeline: e.target.value }))}
                        disabled={disabled}
                        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                      >
                        <option>Nuevo</option>
                        <option>Contactado</option>
                        <option>En seguimiento</option>
                        <option>Calificado</option>
                        <option>No interesado</option>
                        <option>Cerrado</option>
                      </select>
                      <div className="mt-2 text-xs text-slate-500">
                        (En A es texto. En B lo conectamos a opciones configurables.)
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!editing ? (
                lead.notas ? (
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-600">Notas</div>
                    <div className="mt-1 text-sm text-slate-800">{lead.notas}</div>
                  </div>
                ) : null
              ) : (
                <TextareaField
                  label="Notas"
                  value={(draft.notas as any) ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, notas: v }))}
                  disabled={disabled}
                />
              )}

              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Creado" value={lead.created_at ?? "—"} />
                <Field label="Actualizado" value={lead.updated_at ?? "—"} />
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Pipeline actual: <span className="font-semibold">{pipelineValue}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-sm text-slate-900 break-words">{value}</div>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
      />
    </div>
  );
}