"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { RoleTabs } from "@/components/reports/RoleTabs"; // opcional si querés mantener estética; si no, lo sacás.

type GroupKey = "membership_goals" | "icp_targets" | "company_size";

type Item = {
  id: string;
  group_key: GroupKey;
  label: string;
  sort: number;
  is_active: boolean;
};

const GROUPS: { key: GroupKey; title: string; hint: string }[] = [
  { key: "membership_goals", title: "Objetivo en la Cámara", hint: "Checkbox multi-select" },
  { key: "icp_targets", title: "A quién le vende (ICP)", hint: "Checkbox multi-select" },
  { key: "company_size", title: "Tamaño de empresa", hint: "Una sola opción (lo mostramos como checkbox single)" },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-600">
      {children}
    </span>
  );
}

export default function ConfigLeadsPicklistsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Record<GroupKey, Item[]>>({
    membership_goals: [],
    icp_targets: [],
    company_size: [],
  });

  const [group, setGroup] = useState<GroupKey>("membership_goals");
  const [newLabel, setNewLabel] = useState("");
  const [newSort, setNewSort] = useState("100");

  async function fetchAll() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/config/leads/options", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error cargando opciones");
      setData(json.data);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const items = useMemo(() => data[group] ?? [], [data, group]);

  async function createItem() {
    const label = newLabel.trim();
    if (!label) return;

    const sort = Number(newSort);
    try {
      const res = await fetch("/api/admin/config/leads/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_key: group, label, sort: Number.isFinite(sort) ? sort : 100, is_active: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error creando ítem");

      setNewLabel("");
      setNewSort("100");
      await fetchAll();
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    }
  }

  async function patchItem(id: string, patch: Partial<Pick<Item, "label" | "sort" | "is_active">>) {
    try {
      const res = await fetch(`/api/admin/config/leads/options/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando ítem");
      await fetchAll();
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    }
  }

  async function delItem(id: string) {
    const ok = window.confirm("¿Eliminar este ítem? (no se puede deshacer)");
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/config/leads/options/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando ítem");
      await fetchAll();
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    }
  }

  const pastelByGroup: Record<GroupKey, string> = {
    membership_goals: "bg-sky-50 border-sky-100",
    icp_targets: "bg-pink-50 border-pink-100",
    company_size: "bg-violet-50 border-violet-100",
  };

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className={`rounded-2xl border p-6 ${pastelByGroup[group]}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">Configuración · Leads</h1>
              <p className="mt-1 text-sm text-slate-700">
                Editá las opciones que usa el Lead (para IA + segmentación). Sin tocar código.
              </p>

              <div className="mt-4 inline-flex overflow-hidden rounded-xl border bg-white">
                <Link href="/admin" className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700">
                  Volver a Dashboard
                </Link>
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">Configuración</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchAll}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Refrescar
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Grupos</div>
              <div className="mt-3 space-y-2">
                {GROUPS.map((g) => {
                  const active = g.key === group;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGroup(g.key)}
                      className={[
                        "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                        active ? "bg-slate-50 font-semibold" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{g.title}</span>
                        <Badge>{g.hint}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {data[g.key]?.length ?? 0} ítems
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {GROUPS.find((x) => x.key === group)?.title}
                  </div>
                  <div className="text-xs text-slate-500">Orden = sort asc. Podés desactivar sin borrar.</div>
                </div>
                <Badge>{loading ? "cargando…" : "ok"}</Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div className="grow">
                  <div className="text-xs text-slate-500">Nuevo ítem</div>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="Ej: Partners / Distribuidores"
                  />
                </div>
                <div className="w-28">
                  <div className="text-xs text-slate-500">Sort</div>
                  <input
                    value={newSort}
                    onChange={(e) => setNewSort(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="100"
                  />
                </div>
                <button
                  type="button"
                  onClick={createItem}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Agregar
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  <div className="col-span-6">Label</div>
                  <div className="col-span-2">Sort</div>
                  <div className="col-span-2">Activo</div>
                  <div className="col-span-2 text-right">Acciones</div>
                </div>

                <div className="divide-y">
                  {items.map((it) => (
                    <div key={it.id} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                      <div className="col-span-6 min-w-0">
                        <input
                          defaultValue={it.label}
                          className="w-full rounded-lg border px-2 py-1 text-sm"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== it.label) patchItem(it.id, { label: v });
                          }}
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          defaultValue={String(it.sort ?? 100)}
                          className="w-full rounded-lg border px-2 py-1 text-sm"
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n) && n !== it.sort) patchItem(it.id, { sort: n });
                          }}
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="checkbox"
                          checked={!!it.is_active}
                          onChange={(e) => patchItem(it.id, { is_active: e.target.checked })}
                        />
                      </div>

                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => delItem(it.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}

                  {!loading && items.length === 0 && (
                    <div className="px-3 py-6 text-sm text-slate-600">No hay ítems en este grupo.</div>
                  )}
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Tip: para “Tamaño”, mantené un solo valor seleccionado en el Lead (aunque acá sean ítems normales).
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}