"use client";

import { useMemo, useState } from "react";
import type { AnalysisProfilePromptRow, AnalysisProfileRow, PromptRow } from "./types";
import { categoryPastelSurfaceClass, getCategoryPastelClasses } from "./categoryPastel";

export function AnalysisProfilesManager({
  profiles,
  prompts,
  linksByProfile,
  onCreateProfile,
  onSaveFull,
  onActivateProfile,
  canManageActiveProfile,
  saving,
}: {
  profiles: AnalysisProfileRow[];
  prompts: PromptRow[];
  linksByProfile: Record<string, AnalysisProfilePromptRow[]>;
  onCreateProfile: (payload: Partial<AnalysisProfileRow>) => Promise<void>;
  onSaveFull: (payload: {
    profile: {
      id?: string;
      name: string;
      target_client_type: string | null;
      target_industries: string[];
      description: string;
      base_instructions: string;
      is_active: boolean;
    };
    prompts: Array<{ prompt_id: string; enabled_by_default: boolean; execution_order: number }>;
  }) => Promise<void>;
  onActivateProfile: (profileId: string) => Promise<void>;
  canManageActiveProfile: boolean;
  saving: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const selected = useMemo(() => profiles.find((p) => p.id === selectedId) ?? null, [profiles, selectedId]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetIndustries, setTargetIndustries] = useState("");
  const [baseInstructions, setBaseInstructions] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [localLinks, setLocalLinks] = useState<Record<string, { enabled: boolean; order: number }>>({});

  function hydrate(profile: AnalysisProfileRow | null) {
    if (!profile) return;
    setName(profile.name || "");
    setDescription(profile.description || "");
    setTargetType(profile.target_client_type || "");
    setTargetIndustries((profile.target_industries ?? []).join(", "));
    setBaseInstructions(profile.base_instructions || "");
    setIsActive(profile.is_active);
    const links = linksByProfile[profile.id] ?? [];
    const next: Record<string, { enabled: boolean; order: number }> = {};
    links.forEach((l) => {
      next[l.prompt_id] = { enabled: l.enabled_by_default, order: l.execution_order };
    });
    setLocalLinks(next);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Perfiles de análisis</h3>
          <button
            type="button"
            onClick={async () => {
              await onCreateProfile({ name: "Nuevo perfil", description: "", target_client_type: "", target_industries: [], base_instructions: "", is_active: true });
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            + Nuevo perfil
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border px-3 py-2 text-sm ${selected?.id === p.id ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    hydrate(p);
                  }}
                  className="text-left"
                >
                  {p.name}
                </button>
                {p.is_active ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Activo</span>
                ) : !canManageActiveProfile ? (
                  <span className="text-xs font-medium text-slate-500">Solo administradores pueden cambiar el perfil activo</span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await onActivateProfile(p.id);
                      setSelectedId(p.id);
                    }}
                    disabled={saving}
                    className="rounded border bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Activar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">Configuración del perfil</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-700">
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-slate-700">
              Tipo cliente objetivo
              <input value={targetType} onChange={(e) => setTargetType(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="mt-3 block text-xs text-slate-700">
            Industrias objetivo (coma separada)
            <input value={targetIndustries} onChange={(e) => setTargetIndustries(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="mt-3 block text-xs text-slate-700">
            Descripción
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} />
          </label>
          <label className="mt-3 block text-xs text-slate-700">
            Instrucciones base
            <textarea value={baseInstructions} onChange={(e) => setBaseInstructions(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono" rows={4} />
          </label>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Perfil activo
          </label>

          <h5 className="mt-4 text-sm font-semibold text-slate-900">Prompts asociados</h5>
          <div className="mt-2 grid gap-2">
            {prompts.map((p) => {
              const s = localLinks[p.id] ?? { enabled: false, order: 100 };
              const pastel = getCategoryPastelClasses(p.ai_categories?.name);
              const surface = categoryPastelSurfaceClass(p.ai_categories?.name);
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 items-center gap-2 rounded-lg border px-3 py-2 ${surface}`}
                >
                  <div className={`col-span-7 text-sm font-medium ${pastel.text}`}>{p.name}</div>
                  <label className="col-span-3 inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) =>
                        setLocalLinks((prev) => ({
                          ...prev,
                          [p.id]: { ...s, enabled: e.target.checked },
                        }))
                      }
                    />
                    enabled_by_default
                  </label>
                  <input
                    type="number"
                    value={s.order}
                    onChange={(e) =>
                      setLocalLinks((prev) => ({
                        ...prev,
                        [p.id]: { ...s, order: Number(e.target.value) || 100 },
                      }))
                    }
                    className="col-span-2 rounded border px-2 py-1 text-xs"
                    title="execution_order"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={async () => {
                const promptRows = prompts.map((p) => {
                  const current = localLinks[p.id] ?? { enabled: false, order: 100 };
                  return {
                    prompt_id: p.id,
                    enabled_by_default: Boolean(current.enabled),
                    execution_order: Number(current.order) || 100,
                  };
                });
                await onSaveFull({
                  profile: {
                    id: selected.id || undefined,
                    name,
                    target_client_type: targetType || null,
                    target_industries: targetIndustries
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                    description,
                    base_instructions: baseInstructions,
                    is_active: isActive,
                  },
                  prompts: promptRows,
                });
              }}
              disabled={saving}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar configuración del perfil"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
