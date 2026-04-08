"use client";

import { useEffect, useState } from "react";
import RubroSelect from "@/app/admin/empresas/RubroSelect";

export type IniciativaEditable = {
  id: string;
  nombre: string;
  web: string | null;
  contacto_nombre?: string | null;
  email: string | null;
  telefono: string | null;
  rubro_id: string | null;
  rubro?: string | null;
  descripcion?: string | null;
};

export type IniciativaBasicSavePayload = {
  nombre: string;
  web: string | null;
  contacto_nombre: string | null;
  email: string | null;
  telefono: string | null;
  rubro_id: string | null;
  descripcion: string | null;
};

type Props = {
  iniciativa: IniciativaEditable | null;
  onClose: () => void;
  onSave: (payload: IniciativaBasicSavePayload) => Promise<void>;
  saving?: boolean;
};

export default function EditarIniciativaModal({ iniciativa, onClose, onSave, saving = false }: Props) {
  const [nombre, setNombre] = useState("");
  const [sitioWeb, setSitioWeb] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rubroId, setRubroId] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!iniciativa) return;
    setNombre(iniciativa.nombre ?? "");
    setSitioWeb(iniciativa.web ?? "");
    setContactoNombre(iniciativa.contacto_nombre ?? "");
    setEmail(iniciativa.email ?? "");
    setTelefono(iniciativa.telefono ?? "");
    setRubroId(iniciativa.rubro_id ?? null);
    setNotas(iniciativa.descripcion ?? "");
    setLocalError(null);
  }, [iniciativa]);

  useEffect(() => {
    if (!iniciativa) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [iniciativa, onClose]);

  if (!iniciativa) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const n = nombre.trim();
    if (!n) {
      setLocalError("El nombre es obligatorio.");
      return;
    }
    try {
      await onSave({
        nombre: n,
        web: sitioWeb.trim() || null,
        contacto_nombre: contactoNombre.trim() || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        rubro_id: rubroId,
        descripcion: notas.trim() || null,
      });
    } catch {
      /* error mostrado en la bandeja (setError del padre) */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="editar-iniciativa-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Cerrar"
        onClick={onClose}
        disabled={saving}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="editar-iniciativa-title" className="text-lg font-semibold text-slate-900">
          Editar iniciativa
        </h2>
        <p className="mt-1 text-sm text-slate-500">Cambios en datos básicos; no convierte a lead ni altera el estado de revisión.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            Nombre (iniciativa / empresa)
            <input
              value={nombre}
              onChange={(ev) => setNombre(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              disabled={saving}
              autoComplete="organization"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Sitio web
            <input
              value={sitioWeb}
              onChange={(ev) => setSitioWeb(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              disabled={saving}
              placeholder="https://…"
              autoComplete="url"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Contacto (nombre)
            <input
              value={contactoNombre}
              onChange={(ev) => setContactoNombre(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              disabled={saving}
              autoComplete="name"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Email
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                disabled={saving}
                autoComplete="email"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Teléfono
              <input
                value={telefono}
                onChange={(ev) => setTelefono(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                disabled={saving}
                autoComplete="tel"
              />
            </label>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-600">Rubro</span>
            <div className="mt-1">
              <RubroSelect value={rubroId ?? iniciativa.rubro ?? null} onChange={setRubroId} disabled={saving} />
            </div>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Notas (opcional)
            <textarea
              value={notas}
              onChange={(ev) => setNotas(ev.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              disabled={saving}
              placeholder="Contexto interno…"
            />
          </label>

          {localError ? <p className="text-sm text-red-600">{localError}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
