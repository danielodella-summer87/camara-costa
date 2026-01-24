"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RubroSelect from "../RubroSelect";

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
    | "tipo"
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

  // Modal nuevo rubro
  const [showNewRubroModal, setShowNewRubroModal] = useState(false);
  const [newRubroNombre, setNewRubroNombre] = useState("");
  const [creatingRubro, setCreatingRubro] = useState(false);
  const [rubroError, setRubroError] = useState<string | null>(null);
  const [rubroRefreshTrigger, setRubroRefreshTrigger] = useState(0);
  const [newRubroId, setNewRubroId] = useState<string | null>(null);

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
      tipo: draft.tipo ?? "empresa",
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
    // ✅ USAR EL ID NORMALIZADO (no params crudo)
    const empresaId = id;

    if (!empresaId) {
      setError("empresaId faltante o inválido en la URL");
      return;
    }

    try {
      setError(null);

      const res = await fetch(
        `/api/admin/empresas/${empresaId}/convert-to-lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        setError(JSON.stringify(json));
        return;
      }

      const leadId = json?.data?.lead_id;
      if (!leadId) {
        setError("No se recibió lead_id");
        return;
      }

      window.location.href = `/admin/leads/${leadId}`;
    } catch (e: any) {
      setError(e.message || "Error");
    }
  }

  const disabled = loading || mutating;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {loading ? "Cargando…" : empresa?.nombre ?? "Entidad"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Detalle y datos de contacto.
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
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={disabled || !empresa}
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={convertToLead}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={disabled || !empresa}
                >
                  Convertir en lead
                </button>
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Cargando datos…</div>
        ) : !empresa ? (
          <div className="text-sm text-slate-500">No se encontró la entidad.</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              {!editing ? (
                <>
                  <Field
                    label="Tipo de entidad"
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
                    label="Rubro"
                    value={(empresa.rubros as any)?.nombre ?? empresa.rubro ?? "—"}
                  />
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
                    <div className="text-xs font-semibold text-slate-600 mb-2">
                      Tipo de entidad
                    </div>
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
                </>
              )}
            </div>

            {!editing ? (
              empresa.descripcion ? (
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">
                    Descripción
                  </div>
                  <div className="mt-1 text-sm text-slate-800">
                    {empresa.descripcion}
                  </div>
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