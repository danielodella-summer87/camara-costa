"use client";

import { useEffect, useMemo, useState } from "react";

type Rubro = { id: string; nombre: string; activo?: boolean };
type RubrosApiResponse = { data?: Rubro[]; error?: string | null };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function RubroSelect({
  value,
  onChange,
  disabled,
  placeholder = "Seleccionar rubro…",
  refreshTrigger,
}: {
  value: string | null; // ideal: UUID. si viene nombre, lo resolvemos.
  onChange: (nextId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  refreshTrigger?: number; // Cuando cambia, refresca la lista
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Rubro[]>([]);
  const [error, setError] = useState<string | null>(null);

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

      // Filtrar solo rubros activos
      const allRubros = Array.isArray(json?.data) ? json.data : [];
      setRows(allRubros.filter((r) => (r as any).activo !== false));
    } catch (e: any) {
      setError(e?.message ?? "Error cargando rubros");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRubros();
  }, []);

  // Refrescar cuando cambia refreshTrigger
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchRubros();
    }
  }, [refreshTrigger]);

  // Normalizamos:
  // - si nos pasan UUID, lo usamos tal cual (aunque rows aún no cargó)
  // - si nos pasan nombre, lo resolvemos a UUID cuando rows esté disponible
  const normalizedValue = useMemo(() => {
    const v = (value ?? "").trim();
    if (!v) return "";

    if (UUID_RE.test(v)) return v;

    const byName = rows.find((r) => r.nombre === v);
    if (byName) return byName.id;

    // si todavía no cargaron rubros o no lo encontramos, no forzamos a ""
    return "";
  }, [value, rows]);

  return (
    <div className="space-y-2">
      <select
        value={normalizedValue}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        disabled={disabled || loading}
        className="w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
      >
        <option value="">{loading ? "Cargando rubros…" : placeholder}</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </select>

      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}