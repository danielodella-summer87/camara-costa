"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_LABELS, fetchLabels, type Labels } from "@/lib/labels";

type Socio = {
  id: string;
  codigo: string | null;
  plan: string | null;
  estado: string | null;
  fecha_alta: string | null;
  proxima_accion: string | null;
  empresa_id: string | null;
  empresas: {
    id: string;
    nombre: string | null;
  } | null;
};

export default function SociosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Socio[]>([]);
  const [labels, setLabels] = useState<Labels>(DEFAULT_LABELS);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/socios", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Error cargando datos");
        setData(json?.data || []);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    fetchLabels().then(setLabels).catch(() => {});
    
    const handleUpdate = () => {
      fetchLabels().then(setLabels).catch(() => {});
    };
    window.addEventListener("portal-config-updated", handleUpdate);
    return () => window.removeEventListener("portal-config-updated", handleUpdate);
  }, []);

  if (error) {
    return (
      <div className="p-10 text-red-600">
        Error cargando {labels.memberPlural.toLowerCase()}: {error}
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{labels.memberPlural}</h1>
          <p className="text-slate-600">Gestión con inteligencia comercial</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Empresa</th>
              <th className="p-3 text-left">Plan</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Alta</th>
              <th className="p-3 text-left">Próxima acción</th>
              <th className="p-3"></th>
            </tr>
          </thead>

          <tbody>
            {(data ?? []).map((row: any) => (
              <tr
                key={row.id}
                className="border-b transition hover:bg-slate-50"
              >
                <td className="p-3 font-mono whitespace-nowrap">{row.codigo ?? row.id}</td>
                <td className="p-3 font-medium">{(row.empresas as any)?.nombre ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{row.plan ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{row.estado ?? "—"}</td>

                <td className="p-3 text-slate-700 whitespace-nowrap">
                  {row.fecha_alta ?? "—"}
                </td>

                <td className="p-3">
                  <span className="text-xs text-slate-600">
                    {row.proxima_accion ?? "—"}
                  </span>
                </td>

                <td className="p-3 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/socios/${row.id}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}

            {loading ? (
              <tr>
                <td className="p-6 text-slate-500" colSpan={7}>
                  Cargando...
                </td>
              </tr>
            ) : (!data || data.length === 0) ? (
              <tr>
                <td className="p-6 text-slate-500" colSpan={7}>
                  No hay {labels.memberPlural.toLowerCase()} para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
