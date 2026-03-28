"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import RubroSelect from "../RubroSelect";
import {
  INITIATIVE_KIND_STANDARD,
  INITIATIVE_KIND_STARTUP,
  MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH,
} from "@/lib/crm/initiativeKind";

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

  const [initiativeKind, setInitiativeKind] = useState<typeof INITIATIVE_KIND_STANDARD | typeof INITIATIVE_KIND_STARTUP>(
    INITIATIVE_KIND_STANDARD
  );
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"empresa" | "profesional" | "institucion">("empresa");
  const [rubroId, setRubroId] = useState<string>("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [web, setWeb] = useState("");
  const [instagram, setInstagram] = useState("");
  const [direccion, setDireccion] = useState("");
  const [linkedinEmpresa, setLinkedinEmpresa] = useState("");
  const [linkedinPersonal, setLinkedinPersonal] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [digitalOpen, setDigitalOpen] = useState(false);

  const isStartup = initiativeKind === INITIATIVE_KIND_STARTUP;
  const projectLen = projectDescription.trim().length;

  const canSave = useMemo(() => {
    if (!cleanStr(nombre) || !rubroId || saving) return false;
    if (isStartup && projectLen < MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH) return false;
    return true;
  }, [nombre, rubroId, saving, isStartup, projectLen]);

  async function onSave() {
    setError(null);

    const payload = {
      nombre: cleanStr(nombre),
      initiative_kind: initiativeKind,
      project_description: isStartup ? projectDescription.trim() || null : null,
      tipo: tipo,
      rubro_id: rubroId,
      contacto_nombre: cleanStr(contactoNombre),
      telefono: cleanStr(telefono),
      email: cleanStr(email),
      web: cleanStr(web),
      instagram: cleanStr(instagram),
      direccion: cleanStr(direccion),
      linkedin_empresa: cleanStr(linkedinEmpresa),
      linkedin_personal: cleanStr(linkedinPersonal),
      descripcion: !isStartup && descripcion.trim().length ? descripcion.trim() : null,
    };

    if (!payload.nombre) return setError("Falta nombre");
    if (!payload.rubro_id) return setError("Falta rubro");
    if (isStartup && (!payload.project_description || payload.project_description.length < MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH)) {
      return setError(`En startup, «Describa su proyecto» es obligatorio (mín. ${MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH} caracteres).`);
    }

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
            <h1 className="text-2xl font-semibold text-slate-900">Nueva iniciativa</h1>
            <p className="mt-1 text-sm text-slate-600">
              Alta de ingreso preliminar (estado de revisión inicial). Luego podés validar y convertir a lead comercial.
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
          <div className="rounded-2xl border p-4 md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Tipo de iniciativa *</label>
            <select
              value={initiativeKind}
              onChange={(e) =>
                setInitiativeKind(
                  e.target.value === INITIATIVE_KIND_STARTUP ? INITIATIVE_KIND_STARTUP : INITIATIVE_KIND_STANDARD
                )
              }
              className="mt-2 w-full max-w-md rounded-xl border px-3 py-2 text-sm"
            >
              <option value={INITIATIVE_KIND_STANDARD}>Estándar (negocio con presencia digital esperada)</option>
              <option value={INITIATIVE_KIND_STARTUP}>Startup / proyecto temprano (sin web ni redes obligatorias)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              En startup la fuente principal es la descripción del proyecto; la IA no penalizará la falta de sitio o redes.
            </p>
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Nombre del proyecto / iniciativa *</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Ej: Óptica Casino"
            />
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Clasificación</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "empresa" | "profesional" | "institucion")}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="empresa">Empresa</option>
              <option value="profesional">Profesional</option>
              <option value="institucion">Institución</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Comercio, profesional o institución (dato de rubro interno).</p>
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Rubro *</label>
            <div className="mt-2">
              <RubroSelect value={rubroId || null} onChange={(nextId) => setRubroId(nextId ?? "")} />
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <label className="text-xs font-medium text-slate-600">Contacto</label>
            <input
              value={contactoNombre}
              onChange={(e) => setContactoNombre(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Nombre y apellido"
            />
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

          {isStartup ? (
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4 md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Describa su proyecto *</label>
              <p className="mt-1 text-xs text-slate-600">
                Contá qué problema resuelven, etapa (idea, MVP, tracción), mercado objetivo y lo que ya validaron. Mínimo{" "}
                {MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH} caracteres.
              </p>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="mt-2 min-h-[200px] w-full resize-y rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm"
                placeholder="Ej: Plataforma B2B para… Estamos en validación con 5 pilotos…"
              />
              <p className="mt-1 text-xs text-slate-500">
                {projectLen} / {MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH} caracteres mínimos
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border p-4 md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Descripción (opcional)</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="mt-2 min-h-[120px] w-full resize-y rounded-xl border px-3 py-2 text-sm"
                placeholder="Notas generales sobre la iniciativa…"
              />
            </div>
          )}

          <div className="rounded-2xl border p-4 md:col-span-2">
            <button
              type="button"
              onClick={() => setDigitalOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-800"
            >
              <span>Presencia digital (opcional)</span>
              <span className="text-slate-400">{digitalOpen ? "▲" : "▼"}</span>
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Web, Instagram y dirección. {isStartup ? "En startup suelen estar vacíos al inicio." : ""}
            </p>
            {digitalOpen ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Web</label>
                  <input
                    value={web}
                    onChange={(e) => setWeb(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Instagram</label>
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="https://instagram.com/…"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Dirección</label>
                  <input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="Calle 1234"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">LinkedIn empresa</label>
                  <input
                    value={linkedinEmpresa}
                    onChange={(e) => setLinkedinEmpresa(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="https://linkedin.com/company/…"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">LinkedIn personal</label>
                  <input
                    value={linkedinPersonal}
                    onChange={(e) => setLinkedinPersonal(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="https://linkedin.com/in/…"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
