"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import RubroSelect from "../RubroSelect";

type ApiResp<T> = { data: T | null; error: string | null };

type Empresa = {
  id: string;
  nombre: string;
  rubro?: string | null;
  rubro_id?: string | null;
  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  instagram?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
};

function cleanStr(v: string) {
  const s = v.trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

export default function NuevaEmpresaPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [rubroId, setRubroId] = useState<string>(""); // rubro_id
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [web, setWeb] = useState("");
  const [instagram, setInstagram] = useState("");
  const [direccion, setDireccion] = useState("");
  const [descripcion, setDescripcion] = useState(""); // con espacios OK

  const canSave = useMemo(() => {
    return cleanStr(nombre) && rubroId && !saving;
  }, [nombre, rubroId, saving]);

  async function onSave() {
    setError(null);

    const payload = {
      nombre: cleanStr(nombre),
      rubro_id: rubroId,
      telefono: cleanStr(telefono),
      email: cleanStr(email),
      web: cleanStr(web),
      instagram: cleanStr(instagram),
      direccion: cleanStr(direccion),
      // descripción: NO colapsamos a 1 palabra, pero sí trim de extremos
      descripcion: descripcion.trim().length ? descripcion.trim() : null,
    };

    if (!payload.nombre) return setError("Falta nombre");
    if (!payload.rubro_id) return setError("Falta rubro");

    setSaving(true);
    try {
      const res = await fetch("/api/admin/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ApiResp<Empresa>;

      if (!res.ok) throw new Error(json?.error ?? "Error guardando");

      const id = json?.data?.id;
      if (id) router.push(`/admin/empresas/${id}`);
      else router.push("/admin/empresas");
    } catch (e: any) {
      setError(e?.message ?? "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Nueva empresa</h1>
            <p className="mt-1 text-sm text-slate-600">
              Cargá una empresa al directorio (queda en Pendiente por defecto).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={!canSave}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <Link
              href="/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Nombre *</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Ej: Óptica Casino"
            />
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Rubro *</label>
            <div className="mt-2">
            <RubroSelect value={rubroId || null} onChange={(nextId) => setRubroId(nextId ?? "")} />
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Teléfono</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="+598 99 123 456"
            />
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="contacto@empresa.com"
            />
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Web</label>
            <input
              value={web}
              onChange={(e) => setWeb(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="https://empresa.com"
            />
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Instagram</label>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="https://instagram.com/empresa"
            />
          </div>

          <div className="rounded-2xl border p-4 md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Dirección</label>
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Calle 1234"
            />
          </div>

          <div className="rounded-2xl border p-4 md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-2 min-h-[120px] w-full resize-y rounded-xl border px-3 py-2 text-sm"
              placeholder="Descripción con espacios, tal cual…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}