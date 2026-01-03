"use client";

import { useEffect, useState } from "react";

type Rubro = {
  id: string;
  nombre: string;
  created_at?: string;
};

type RubrosApiResponse = {
  data?: Rubro[];
  error?: string | null;
};

export default function RubroSelect({
  value,
  onChange,
  disabled,
  placeholder = "Seleccionar rubro…",
  className = "",
}: {
  value: string | null | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rubros, setRubros] = useState<Rubro[]>([]);

  async function fetchRubros() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/rubros", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as RubrosApiResponse;

      if (!res.ok) throw new Error(json?.error ?? "Error cargando rubros");

      setRubros(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando rubros");
      setRubros([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRubros();
  }, []);

  const isDisabled = disabled || loading;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className="w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
        >
          <option value="">{loading ? "Cargando…" : placeholder}</option>
          {rubros.map((r) => (
            <option key={r.id} value={r.nombre}>
              {r.nombre}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={fetchRubros}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          disabled={isDisabled}
          title="Refrescar rubros"
        >
          ↻
        </button>
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}