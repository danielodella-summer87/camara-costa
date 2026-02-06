"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

export default function MesaDeAyudaCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"bug" | "improvement" | "suggestion">("improvement");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const t = title.trim();
    const d = description.trim();

    if (!t) return setError("Falta título");
    if (!d) return setError("Falta descripción");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          title: t,
          description: d,
          type,
          priority,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error creando ticket");

      router.push("/admin/mesa-de-ayuda");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/mesa-de-ayuda" className="text-sm text-slate-600 hover:text-slate-900">
            ← Mesa de ayuda
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Nuevo ticket</h1>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-6 space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumen del ticket"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle del problema, mejora o sugerencia"
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-[120px]"
              disabled={loading}
              required
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
              <select
                className="rounded-xl border px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as "bug" | "improvement" | "suggestion")}
                disabled={loading}
              >
                <option value="bug">Error</option>
                <option value="improvement">Mejora</option>
                <option value="suggestion">Sugerencia</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Prioridad</label>
              <select
                className="rounded-xl border px-3 py-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "critical")}
                disabled={loading}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !title.trim() || !description.trim()}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {loading ? "Creando…" : "Crear ticket"}
            </button>

            <Link href="/admin/mesa-de-ayuda" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
