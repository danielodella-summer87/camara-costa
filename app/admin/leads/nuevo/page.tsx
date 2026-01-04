"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

type LeadCreatePayload = {
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
};

type Lead = LeadCreatePayload & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  estado?: string | null;
};

type LeadApiResponse = {
  data?: Lead | null;
  error?: string | null;
};

function norm(v: string): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

export default function NuevoLeadPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [origen, setOrigen] = useState("");
  const [pipeline, setPipeline] = useState("Nuevo");
  const [notas, setNotas] = useState("");

  const canSave = useMemo(() => {
    return nombre.trim().length > 0 && !saving;
  }, [nombre, saving]);

  async function createLead() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const payload: LeadCreatePayload = {
      nombre: nombre.trim(),
      contacto: norm(contacto),
      telefono: norm(telefono),
      email: norm(email),
      origen: norm(origen),
      pipeline: norm(pipeline),
      notas: norm(notas),
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as LeadApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error creando lead");

      const created = json?.data;
      if (!created?.id) throw new Error("No se recibió el id del lead creado");

      router.push(`/admin/leads/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error creando lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Nuevo lead</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Creamos el lead en Supabase. Incluye <span className="font-semibold">contacto</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={createLead}
              disabled={!canSave}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>

            <Link
              href="/admin/leads"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Input label="Nombre *" value={nombre} onChange={setNombre} disabled={saving} />
          <Input label="Contacto" value={contacto} onChange={setContacto} disabled={saving} />

          <Input label="Teléfono" value={telefono} onChange={setTelefono} disabled={saving} />
          <Input label="Email" value={email} onChange={setEmail} disabled={saving} />

          <Input label="Origen" value={origen} onChange={setOrigen} disabled={saving} />

          <div className="rounded-xl border p-4">
            <div className="text-xs font-semibold text-slate-600">Pipeline</div>
            <select
              value={pipeline}
              onChange={(e) => setPipeline(e.target.value)}
              disabled={saving}
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
        </div>

        <div className="mt-4">
          <Textarea label="Notas" value={notas} onChange={setNotas} disabled={saving} />
        </div>
      </div>
    </PageContainer>
  );
}

function Input({
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
    <div className="rounded-xl border p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
      />
    </div>
  );
}

function Textarea({
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