"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import RubroSelect from "../RubroSelect";

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  estado: string | null;
  aprobada: boolean | null;
  descripcion?: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  instagram?: string | null;
  direccion?: string | null;
  created_at?: string;
  updated_at?: string;
};

type EmpresaApiResponse = {
  data?: Empresa | null;
  error?: string | null;
};

type PatchPayload = Partial<
  Pick<
    Empresa,
    "nombre" | "rubro" | "telefono" | "email" | "web" | "instagram" | "direccion" | "descripcion" | "aprobada" | "estado"
  >
>;

export default function EmpresaDetailPage() {
  const params = useParams();
  const rawId = (params as any)?.id as string | string[] | undefined;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  // modo edición
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatchPayload>({});

  async function fetchEmpresa() {
    if (!id) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/empresas/${id}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as EmpresaApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando empresa");

      setEmpresa(json?.data ?? null);

      // si estoy editando y refresco, NO piso el draft
      if (!editing) {
        setDraft({});
      }
    } catch (e: any) {
      setError(e?.message ?? "Error cargando empresa");
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
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando empresa");

      await fetchEmpresa();
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando empresa");
    } finally {
      setMutating(false);
    }
  }

  useEffect(() => {
    fetchEmpresa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const aprobacionLabel = useMemo(() => {
    if (!empresa) return "—";
    if (empresa.aprobada) return "Aprobada";
    if (empresa.estado?.toLowerCase() === "rechazada") return "Rechazada";
    return "Pendiente";
  }, [empresa]);

  function startEdit() {
    if (!empresa) return;
    setEditing(true);
    setDraft({
      nombre: empresa.nombre ?? "",
      rubro: empresa.rubro ?? "",
      telefono: empresa.telefono ?? "",
      email: empresa.email ?? "",
      web: empresa.web ?? "",
      instagram: empresa.instagram ?? "",
      direccion: empresa.direccion ?? "",
      descripcion: empresa.descripcion ?? "",
    });
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setError(null);
  }

  async function saveEdit() {
    // limpiamos strings vacíos a null para que quede prolijo en DB
    const normalized: PatchPayload = {
      nombre: (draft.nombre ?? "").trim() || null,
      rubro: (draft.rubro ?? "").trim() || null,
      telefono: (draft.telefono ?? "").trim() || null,
      email: (draft.email ?? "").trim() || null,
      web: (draft.web ?? "").trim() || null,
      instagram: (draft.instagram ?? "").trim() || null,
      direccion: (draft.direccion ?? "").trim() || null,
      descripcion: (draft.descripcion ?? "").trim() || null,
    };

    await patchEmpresa(normalized);
    setEditing(false);
  }

  const disabled = loading || mutating;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {loading ? "Cargando…" : empresa?.nombre ?? "Empresa"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Detalle, datos de contacto y estado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchEmpresa}
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
                disabled={disabled || !empresa}
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

            <button
              type="button"
              onClick={() => patchEmpresa({ aprobada: true, estado: "Aprobada" })}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled || editing || empresa?.aprobada === true}
              title={empresa?.aprobada ? "Ya está aprobada" : "Aprobar empresa"}
            >
              {mutating ? "…" : "Aprobar"}
            </button>

            <button
              type="button"
              onClick={() => patchEmpresa({ aprobada: false, estado: "Rechazada" })}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled || editing || empresa?.estado?.toLowerCase() === "rechazada"}
              title={
                empresa?.estado?.toLowerCase() === "rechazada"
                  ? "Ya está rechazada"
                  : "Rechazar empresa"
              }
            >
              {mutating ? "…" : "Rechazar"}
            </button>

            <Link
              href="/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Cargando datos…</div>
        ) : !empresa ? (
          <div className="text-sm text-slate-500">No se encontró la empresa.</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              {!editing ? (
                <>
                  <Field label="Rubro" value={empresa.rubro ?? "—"} />
                  <Field label="Estado" value={empresa.estado ?? "—"} />
                  <Field label="Aprobación" value={aprobacionLabel} />
                  <Field label="Teléfono" value={empresa.telefono ?? "—"} />
                  <Field label="Email" value={empresa.email ?? "—"} />
                  <Field label="Dirección" value={empresa.direccion ?? "—"} />
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
                    <div className="text-xs font-semibold text-slate-600">Rubro</div>
                    <div className="mt-2">
                      <RubroSelect
                        value={(draft.rubro as any) ?? ""}
                        onChange={(v) => setDraft((d) => ({ ...d, rubro: v }))}
                        disabled={disabled}
                      />
                    </div>
                  </div>

                  <Field label="Estado" value={empresa.estado ?? "—"} />
                  <Field label="Aprobación" value={aprobacionLabel} />

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
                </>
              )}
            </div>

            {!editing ? (
              empresa.descripcion ? (
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Descripción</div>
                  <div className="mt-1 text-sm text-slate-800">{empresa.descripcion}</div>
                </div>
              ) : null
            ) : (
              <TextareaField
                label="Descripción"
                value={(draft.descripcion as any) ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, descripcion: v }))}
                disabled={disabled}
              />
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {!editing ? (
                <>
                  <Field label="Web" value={empresa.web ?? "—"} />
                  <Field label="Instagram" value={empresa.instagram ?? "—"} />
                </>
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
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {empresa.web ? (
                <a
                  href={empresa.web}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir web
                </a>
              ) : null}

              {empresa.instagram ? (
                <a
                  href={empresa.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir Instagram
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
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