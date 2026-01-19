"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import RubroSelect from "../RubroSelect";

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null; // nombre (display)
  rubro_id: string | null; // UUID real
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

// lo que mandamos al PATCH (usa rubro_id, no rubro nombre)
type PatchPayload = Partial<
  Pick<
    Empresa,
    | "nombre"
    | "rubro_id"
    | "telefono"
    | "email"
    | "web"
    | "instagram"
    | "direccion"
    | "descripcion"
    | "aprobada"
    | "estado"
  >
>;

function normalizeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

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
      if (!res.ok) throw new Error(json?.error ?? "Error cargando empresa");

      const next = (json?.data ?? null) as Empresa | null;

      setEmpresa(
        next
          ? {
              ...next,
              rubro_id: (next as any).rubro_id ?? null,
            }
          : null
      );

      // si NO estoy editando, limpio draft
      if (!editing) setDraft({});
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

      await fetchEmpresa(id);
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando empresa");
    } finally {
      setMutating(false);
    }
  }

  // ✅ CLAVE: cuando cambia el ID (navegás a otra empresa), reseteamos edición y draft
  useEffect(() => {
    setEditing(false);
    setDraft({});
    setError(null);
    fetchEmpresa(id);
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
      rubro_id: empresa.rubro_id ?? null, // ✅ IMPORTANTE
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
    const normalized: PatchPayload = {
      nombre: normalizeStr(draft.nombre) ?? undefined,
      rubro_id: draft.rubro_id ?? null,
      telefono: normalizeStr(draft.telefono),
      email: normalizeStr(draft.email),
      web: normalizeStr(draft.web),
      instagram: normalizeStr(draft.instagram),
      direccion: normalizeStr(draft.direccion),
      descripcion: normalizeStr(draft.descripcion),
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
              onClick={() => fetchEmpresa(id)}
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
                        // ✅ CLAVE: si draft aún no tiene rubro_id, usamos el actual de empresa
                        value={(draft.rubro_id ?? empresa.rubro_id) ?? null}
                        onChange={(nextId) => setDraft((d) => ({ ...d, rubro_id: nextId }))}
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