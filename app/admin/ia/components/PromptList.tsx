"use client";

import { useMemo, useState } from "react";
import type { PromptRow } from "./types";
import type { AnalysisProfilePromptRow, AnalysisProfileRow } from "./types";
import { categoryPastelSurfaceClass, getCategoryPastelClasses } from "./categoryPastel";

type PromptListView = "all" | "category" | "profile";
type PromptHealthFilter = "all" | "ok" | "mejorable" | "error";

function fmtDate(v: string) {
  return new Date(v).toLocaleString("es-UY");
}

export function PromptList({
  prompts,
  profiles,
  linksByProfile,
  activeProfileName,
  activeProfileOptions,
  selectedProfileId,
  onChangeActiveProfile,
  loadingActiveProfile,
  onEdit,
  pendingSuggestionCounts,
  onViewSuggestions,
  onView,
  onDuplicate,
}: {
  prompts: PromptRow[];
  profiles: AnalysisProfileRow[];
  linksByProfile: Record<string, AnalysisProfilePromptRow[]>;
  activeProfileName: string;
  activeProfileOptions: Array<{ id: string; name: string }>;
  selectedProfileId: string;
  onChangeActiveProfile: (id: string) => void;
  loadingActiveProfile: boolean;
  onEdit: (p: PromptRow) => void;
  pendingSuggestionCounts: Record<string, number>;
  onViewSuggestions: (p: PromptRow) => void;
  onView: (p: PromptRow) => void;
  onDuplicate: (p: PromptRow) => void;
}) {
  const [view, setView] = useState<PromptListView>("category");
  const [healthFilter, setHealthFilter] = useState<PromptHealthFilter>("all");

  const orderByPromptId = useMemo(() => {
    const out = new Map<string, number>();
    Object.values(linksByProfile).forEach((rows) => {
      rows.forEach((row) => {
        if (!row.enabled_by_default) return;
        const prev = out.get(row.prompt_id);
        const next = Number(row.execution_order);
        if (!Number.isFinite(next)) return;
        if (prev == null || next < prev) out.set(row.prompt_id, next);
      });
    });
    return out;
  }, [linksByProfile]);

  const sortedPrompts = useMemo(() => {
    const filtered = healthFilter === "all" ? prompts : prompts.filter((p) => (p.prompt_health ?? "ok") === healthFilter);
    return [...filtered].sort((a, b) => {
      const aOrder = orderByPromptId.get(a.id);
      const bOrder = orderByPromptId.get(b.id);
      const aHas = typeof aOrder === "number";
      const bHas = typeof bOrder === "number";
      if (aHas && bHas && aOrder !== bOrder) return aOrder - bOrder;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [prompts, orderByPromptId, healthFilter]);

  const byCategory = useMemo(() => {
    const map = new Map<string, PromptRow[]>();
    sortedPrompts.forEach((p) => {
      const key = p.ai_categories?.name?.trim() || "Sin categoría";
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(p);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [sortedPrompts]);

  const byProfile = useMemo(() => {
    const rows = profiles.map((profile) => {
      const links = (linksByProfile[profile.id] ?? []).filter((l) => l.enabled_by_default);
      const linkByPrompt = new Map<string, number>();
      links.forEach((l) => linkByPrompt.set(l.prompt_id, l.execution_order));
      const items = sortedPrompts
        .filter((p) => linkByPrompt.has(p.id))
        .sort((a, b) => {
          const aOrder = linkByPrompt.get(a.id) ?? 9999;
          const bOrder = linkByPrompt.get(b.id) ?? 9999;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      return { profile, items };
    });
    return rows.filter((r) => r.items.length > 0);
  }, [profiles, linksByProfile, sortedPrompts]);

  function healthBadge(p: PromptRow) {
    const health = p.prompt_health ?? "ok";
    if (health === "error") return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">error</span>;
    if (health === "mejorable")
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
          mejorable{(p.pending_suggestions_count ?? 0) > 0 ? ` (${p.pending_suggestions_count})` : ""}
        </span>
      );
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">ok</span>;
  }

  const PromptCard = ({ p }: { p: PromptRow }) => {
    const pastel = getCategoryPastelClasses(p.ai_categories?.name);
    const surface = categoryPastelSurfaceClass(p.ai_categories?.name);
    return (
    <div key={p.id} className={`rounded-lg border p-3 ${surface}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${pastel.text}`}>{p.name}</p>
        {healthBadge(p)}
      </div>
      {(pendingSuggestionCounts[p.id] ?? 0) > 0 ? (
        <p className="mt-1 text-xs font-semibold text-amber-700">
          Sugerencias pendientes: {pendingSuggestionCounts[p.id]}
        </p>
      ) : null}
      {(p.prompt_health ?? "ok") === "error" ? (
        <p className="mt-1 text-xs font-semibold text-rose-700">
          Error de estructura: {(p.missing_required_blocks ?? []).join(", ") || "faltan bloques obligatorios"}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-slate-600">Categoría: {p.ai_categories?.name ?? "Sin categoría"}</p>
      <p className="text-xs text-slate-600">Tipo: {p.type}</p>
      <p className="text-xs text-slate-500">Última actualización: {fmtDate(p.updated_at)}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(p)}
          className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Editar
        </button>
        <button type="button" onClick={() => onView(p)} className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-100">
          Ver
        </button>
        <button type="button" onClick={() => onDuplicate(p)} className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-100">
          Duplicar
        </button>
        <button type="button" onClick={() => onViewSuggestions(p)} className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-100">
          Ver sugerencias
        </button>
        <button type="button" disabled className="rounded border border-slate-200 bg-white/80 px-2 py-1 text-xs text-slate-400">
          Desactivar
        </button>
      </div>
    </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Prompts validados activos</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
              Perfil activo: {activeProfileName || "—"}
            </span>
            {activeProfileOptions.length > 0 ? (
              <select
                value={selectedProfileId}
                onChange={(e) => onChangeActiveProfile(e.target.value)}
                disabled={loadingActiveProfile}
                className="rounded-lg border px-2 py-1 text-xs disabled:opacity-60"
                title="Cambiar perfil activo"
              >
                {activeProfileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        <label className="text-xs text-slate-700">
          Vista
          <select
            value={view}
            onChange={(e) => setView(e.target.value as PromptListView)}
            className="ml-2 rounded-lg border px-2 py-1 text-xs"
          >
            <option value="all">Todos</option>
            <option value="category">Agrupar por categoría</option>
            <option value="profile">Agrupar por perfil</option>
          </select>
        </label>
        <label className="text-xs text-slate-700">
          Estado
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value as PromptHealthFilter)}
            className="ml-2 rounded-lg border px-2 py-1 text-xs"
          >
            <option value="all">Todos</option>
            <option value="ok">OK</option>
            <option value="mejorable">Mejorables</option>
            <option value="error">Errores</option>
          </select>
        </label>
      </div>

      {prompts.length === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-slate-500">No hay prompts validados.</p>
        </div>
      ) : null}

      {prompts.length > 0 && view === "all" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sortedPrompts.map((p) => (
            <PromptCard key={p.id} p={p} />
          ))}
        </div>
      ) : null}

      {prompts.length > 0 && view === "category" ? (
        <div className="mt-3 space-y-3">
          {byCategory.map(([category, items]) => {
            const headerPastel = getCategoryPastelClasses(category === "Sin categoría" ? null : category);
            const headerSurface = categoryPastelSurfaceClass(category === "Sin categoría" ? null : category);
            return (
              <details key={category} open className={`rounded-lg border ${headerSurface}`}>
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden ${headerPastel.text}`}
                >
                  <span>{category}</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-black/5">
                    {items.length}
                  </span>
                </summary>
                <div className="border-t border-black/10 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((p) => (
                      <PromptCard key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : null}

      {prompts.length > 0 && view === "profile" ? (
        <div className="mt-3 space-y-4">
          {byProfile.length === 0 ? (
            <p className="text-sm text-slate-500">No hay prompts asociados a perfiles activos.</p>
          ) : (
            byProfile.map(({ profile, items }) => (
              <section key={profile.id} className="space-y-2 pt-2">
                <h4 className="mb-2 mt-1 text-base font-bold text-slate-800">{profile.name}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((p) => (
                    <PromptCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
