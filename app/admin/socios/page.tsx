"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

import Link from "next/link";
export default function SociosPage() {
  const socios = [
    { id: "S-001", nombre: "InnovCorp", plan: "Oro", estado: "Activo", alta: "2025-10-12" },
    { id: "S-002", nombre: "Pérez & Asociados", plan: "Plata", estado: "Pendiente", alta: "2025-11-03" },
    { id: "S-003", nombre: "Delta Logistics", plan: "Bronce", estado: "Vencido", alta: "2025-08-21" },
  ];
  useEffect(() => {
    supabase.from("socios").select("*").then(console.log);
  }, []);
  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Socios</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestioná socios, estados y planes.
          </p>
        </div>

        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          + Nuevo socio
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          placeholder="Buscar por nombre…"
        />
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
          <option>Todos los estados</option>
          <option>Activo</option>
          <option>Pendiente</option>
          <option>Vencido</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
          <option>Todos los planes</option>
          <option>Oro</option>
          <option>Plata</option>
          <option>Bronce</option>
        </select>
        <button className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Limpiar
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Alta</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {socios.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.id}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{s.nombre}</td>
                  <td className="px-5 py-3 text-slate-700">{s.plan}</td>
                  <td className="px-5 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        s.estado === "Activo" && "bg-emerald-50 text-emerald-700",
                        s.estado === "Pendiente" && "bg-amber-50 text-amber-700",
                        s.estado === "Vencido" && "bg-rose-50 text-rose-700",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{s.alta}</td>
                  <td className="px-5 py-3 text-right">
  <Link
    href={`/admin/socios/${s.id}`}
    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
  >
    Ver
  </Link>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-sm text-slate-600">
          <span>Mostrando 3 socios</span>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              ←
            </button>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}