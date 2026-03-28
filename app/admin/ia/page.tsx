"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { IATabs } from "./components/IATabs";
import { PromptForm } from "./components/PromptForm";
import { PromptList } from "./components/PromptList";
import { CategoryManager } from "./components/CategoryManager";
import { AnalysisProfilesManager } from "./components/AnalysisProfilesManager";
import { IADashboard } from "./components/IADashboard";
import { type AnalysisProfilePromptRow, type AnalysisProfileRow, type CategoryRow, type IATabKey, type PromptRow } from "./components/types";
import { buildPromptContentFromFields } from "@/lib/ai/promptStructure";
import { hasRequiredPromptSections } from "@/lib/ai/promptStructure";

export default function IAPage() {
  const [tab, setTab] = useState<IATabKey>("prompts_activos");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [profiles, setProfiles] = useState<AnalysisProfileRow[]>([]);
  const [profilePromptLinks, setProfilePromptLinks] = useState<Record<string, AnalysisProfilePromptRow[]>>({});
  const [saving, setSaving] = useState(false);
  const [switchingActiveProfile, setSwitchingActiveProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [viewer, setViewer] = useState<PromptRow | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [pendingSuggestionsByPrompt, setPendingSuggestionsByPrompt] = useState<Record<string, number>>({});
  const [pendingProfileChangeId, setPendingProfileChangeId] = useState<string | null>(null);
  const [confirmProfileModalOpen, setConfirmProfileModalOpen] = useState(false);
  const [profileSelectorCooldown, setProfileSelectorCooldown] = useState(false);
  const [canManageActiveProfile, setCanManageActiveProfile] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, pRes, profilesRes] = await Promise.all([
        fetch("/api/admin/ia/categories", { cache: "no-store" }),
        fetch("/api/admin/ia/prompts", { cache: "no-store" }),
        fetch("/api/admin/ia/profiles", { cache: "no-store" }),
      ]);
      const cJson = await cRes.json().catch(() => ({}));
      const pJson = await pRes.json().catch(() => ({}));
      const profilesJson = await profilesRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cJson?.error ?? "Error cargando categorías");
      if (!pRes.ok) throw new Error(pJson?.error ?? "Error cargando prompts");
      if (!profilesRes.ok) throw new Error(profilesJson?.error ?? "Error cargando perfiles");
      setCategories(Array.isArray(cJson?.data) ? cJson.data : []);
      setPrompts(Array.isArray(pJson?.data) ? pJson.data : []);
      const pfs = Array.isArray(profilesJson?.data) ? profilesJson.data : [];
      setProfiles(pfs);
      const linksEntries = await Promise.all(
        pfs.map(async (p: AnalysisProfileRow) => {
          const r = await fetch(`/api/admin/ia/profiles/${p.id}/prompts`, { cache: "no-store" });
          const j = await r.json().catch(() => ({}));
          return [p.id, Array.isArray(j?.data) ? j.data : []] as const;
        })
      );
      setProfilePromptLinks(Object.fromEntries(linksEntries));
      await loadDashboard();
      await loadSuggestionsSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando IA");
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    setLoadingDashboard(true);
    try {
      const r = await fetch("/api/admin/ia/dashboard", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error cargando dashboard IA");
      setDashboard(j?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando dashboard IA");
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function loadSuggestionsSummary() {
    try {
      const r = await fetch("/api/admin/ia/suggestions/summary", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return;
      setPendingSuggestionsByPrompt(j?.data && typeof j.data === "object" ? j.data : {});
    } catch {
      // noop
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRolePermissions() {
      try {
        const r = await fetch("/api/admin/permissions/me", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || cancelled) return;
        const role = String(j?.user?.role ?? "").trim().toLowerCase();
        setCanManageActiveProfile(role === "admin" || role === "superadmin");
      } catch {
        if (!cancelled) setCanManageActiveProfile(false);
      }
    }
    void loadRolePermissions();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId) ?? prompts[0] ?? null,
    [prompts, selectedPromptId]
  );

  async function savePrompt(payload: {
    id?: string;
    name: string;
    category_id: string;
    description: string;
    role_persona: string;
    context_environment: string;
    objective: string;
    specific_task: string;
    constraints: string;
    output_format: string;
    target_audience: string;
    prompt_content: string;
    status: "draft" | "validated";
  }) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: payload.name,
        type: payload.id
          ? (prompts.find((p) => p.id === payload.id)?.type ?? "custom")
          : "custom",
        category_id: payload.category_id,
        description: payload.description,
        role_persona: payload.role_persona,
        context_environment: payload.context_environment,
        objective: payload.objective,
        specific_task: payload.specific_task,
        constraints: payload.constraints,
        output_format: payload.output_format,
        target_audience: payload.target_audience,
        prompt_content: payload.prompt_content,
        status: payload.status,
      };
      if (payload.id && payload.id !== "__new__") {
        const r = await fetch(`/api/admin/ia/prompts/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error ?? "Error actualizando prompt");
      } else {
        const r = await fetch("/api/admin/ia/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error ?? "Error creando prompt");
        if (j?.data?.id) setSelectedPromptId(String(j.data.id));
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando prompt");
    } finally {
      setSaving(false);
    }
  }

  async function duplicatePrompt(p: PromptRow) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/ia/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${p.name} (copia)`,
          type: p.type,
          category_id: p.category_id,
          description: p.description,
          prompt_content: p.prompt_content,
          status: "draft",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error duplicando prompt");
      await loadAll();
      setTab("configuracion");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error duplicando prompt");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory(payload: { name: string; description: string; is_active: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/ia/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error creando categoría");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creando categoría");
    } finally {
      setSaving(false);
    }
  }

  async function createProfile(payload: Partial<AnalysisProfileRow>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/ia/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error creando perfil");
      await loadAll();
      setTab("perfiles_analisis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creando perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFull(payload: {
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
  }) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/profile/save-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("[IA][save-full] Error response", j);
        throw new Error(j?.error ?? "Error guardando configuración del perfil");
      }
      await loadAll();
      console.log("[IA][save-full] Guardado OK");
    } catch (e) {
      console.error("[IA][save-full] Exception", e);
      setError(e instanceof Error ? e.message : "Error guardando configuración del perfil");
    } finally {
      setSaving(false);
    }
  }

  async function updateCategory(id: string, payload: { name: string; description: string; is_active: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/ia/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error actualizando categoría");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error actualizando categoría");
    } finally {
      setSaving(false);
    }
  }

  const activePrompts = useMemo(() => prompts.filter((p) => p.status === "validated"), [prompts]);
  const pendingSuggestionsCount = useMemo(
    () => Object.values(pendingSuggestionsByPrompt).reduce((acc, n) => acc + (Number(n) || 0), 0),
    [pendingSuggestionsByPrompt]
  );
  const promptsWithStructureErrors = useMemo(
    () => prompts.filter((p) => !hasRequiredPromptSections(String(p.prompt_content || ""))).length,
    [prompts]
  );
  const lastValidationAt = useMemo(() => {
    const dates = prompts
      .map((p) => String(p.updated_at || ""))
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((n) => Number.isFinite(n));
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates)).toISOString();
  }, [prompts]);
  const activeProfileOptions = useMemo(
    () => profiles.map((p) => ({ id: p.id, name: p.name })),
    [profiles]
  );
  const activeProfileId = useMemo(
    () => profiles.find((p) => p.is_active)?.id ?? profiles[0]?.id ?? "",
    [profiles]
  );
  const activeProfileName = useMemo(
    () => profiles.find((p) => p.id === activeProfileId)?.name ?? "",
    [profiles, activeProfileId]
  );

  async function setActiveProfile(profileId: string) {
    if (!profileId || switchingActiveProfile) return;
    setSwitchingActiveProfile(true);
    setError(null);
    setInfo(null);
    try {
      const updates = profiles.map(async (p) => {
        if (p.is_active === (p.id === profileId)) return;
        const r = await fetch(`/api/admin/ia/profiles/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: p.id === profileId }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error ?? `Error activando perfil ${p.name}`);
      });
      await Promise.all(updates);
      await loadAll();
      await loadDashboard();
      setInfo("Perfil activado correctamente");
      setProfileSelectorCooldown(true);
      setTimeout(() => setProfileSelectorCooldown(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error activando perfil");
    } finally {
      setSwitchingActiveProfile(false);
    }
  }

  function requestProfileChange(profileId: string) {
    if (!canManageActiveProfile) return;
    if (!profileId || profileId === activeProfileId) return;
    setPendingProfileChangeId(profileId);
    setConfirmProfileModalOpen(true);
  }

  async function confirmProfileChange() {
    if (!pendingProfileChangeId) {
      setConfirmProfileModalOpen(false);
      return;
    }
    await setActiveProfile(pendingProfileChangeId);
    setConfirmProfileModalOpen(false);
    setPendingProfileChangeId(null);
  }

  const pendingProfileName = useMemo(
    () => profiles.find((p) => p.id === pendingProfileChangeId)?.name ?? "—",
    [profiles, pendingProfileChangeId]
  );

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">IA</h1>
          <p className="mt-1 text-sm text-slate-600">Motor de prompts con separación entre configuración, operación y categorías.</p>
          <div className="mt-4 max-w-md">
            <label className="block text-xs font-semibold text-slate-700">Perfil activo</label>
            <select
              value={activeProfileId}
              onChange={(e) => requestProfileChange(e.target.value)}
              disabled={!canManageActiveProfile || switchingActiveProfile || profileSelectorCooldown || activeProfileOptions.length === 0}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-60"
              title={!canManageActiveProfile ? "Solo administradores pueden cambiar el perfil activo" : undefined}
            >
              {activeProfileOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {!canManageActiveProfile ? (
              <p className="mt-1 text-xs text-slate-500">Solo administradores pueden cambiar el perfil activo</p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Prompts activos</p>
              <p className="text-base font-semibold text-slate-900">{activePrompts.length}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Prompts con mejoras pendientes</p>
                {pendingSuggestionsCount > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Pendiente</span>
                ) : null}
              </div>
              <p className="text-base font-semibold text-slate-900">{pendingSuggestionsCount}</p>
              {pendingSuggestionsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab("prompts_activos")}
                  className="mt-1 text-xs font-semibold text-sky-700 hover:text-sky-800"
                >
                  Ver sugerencias
                </button>
              ) : null}
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Prompts con errores de estructura</p>
              <p className="text-base font-semibold text-slate-900">{promptsWithStructureErrors}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Última validación</p>
              <p className="text-sm font-semibold text-slate-900">
                {lastValidationAt ? new Date(lastValidationAt).toLocaleString("es-UY") : "—"}
              </p>
            </div>
          </div>
        </div>

        <IATabs active={tab} onChange={setTab} />

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {info ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{info}</div> : null}
        {loading ? <div className="text-sm text-slate-500">Cargando…</div> : null}

        {!loading && tab === "configuracion" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Perfil activo</p>
                  <p className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                    {activeProfileName || "Sin perfil activo"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPromptId(null);
                    setPrompts((prev) => [
                      {
                        id: "__new__",
                        name: "",
                        type: "custom",
                        category_id: "",
                        description: "",
                        role_persona: "",
                        context_environment: "",
                        objective: "",
                        specific_task: "",
                        constraints: "",
                        output_format: "",
                        target_audience: "",
                        prompt_content: buildPromptContentFromFields({}),
                        status: "draft",
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        ai_categories: null,
                      },
                      ...prev.filter((p) => p.id !== "__new__"),
                    ]);
                    setSelectedPromptId("__new__");
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  + Nuevo prompt
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                {prompts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPromptId(p.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedPrompt?.id === p.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium">{p.name || "Sin nombre"}</span>
                    <span className={`text-xs ${selectedPrompt?.id === p.id ? "text-white/80" : "text-slate-500"}`}>{p.status}</span>
                  </button>
                ))}
              </div>
            </div>
            <PromptForm
              current={selectedPrompt}
              categories={categories}
              saving={saving}
              onSaveDraft={savePrompt}
              onValidate={savePrompt}
              onSuggestionsChanged={loadAll}
            />
          </div>
        ) : null}

        {!loading && tab === "prompts_activos" ? (
          <PromptList
            prompts={activePrompts}
            profiles={profiles}
            linksByProfile={profilePromptLinks}
            activeProfileName={activeProfileName}
            activeProfileOptions={activeProfileOptions}
            selectedProfileId={activeProfileId}
            onChangeActiveProfile={(id) => void setActiveProfile(id)}
            loadingActiveProfile={switchingActiveProfile}
            onEdit={(p) => {
              setSelectedPromptId(p.id);
              setTab("configuracion");
            }}
            pendingSuggestionCounts={pendingSuggestionsByPrompt}
            onViewSuggestions={(p) => {
              setSelectedPromptId(p.id);
              setTab("configuracion");
            }}
            onView={(p) => setViewer(p)}
            onDuplicate={(p) => void duplicatePrompt(p)}
          />
        ) : null}

        {!loading && tab === "dashboard_ia" ? (
          <IADashboard
            data={dashboard}
            onSelectProfile={(id) => void setActiveProfile(id)}
            switchingProfile={switchingActiveProfile || loadingDashboard}
          />
        ) : null}

        {!loading && tab === "categorias" ? (
          <CategoryManager categories={categories} saving={saving} onCreate={createCategory} onUpdate={updateCategory} />
        ) : null}

        {!loading && tab === "perfiles_analisis" ? (
          <AnalysisProfilesManager
            profiles={profiles}
            prompts={prompts}
            linksByProfile={profilePromptLinks}
            saving={saving}
            onCreateProfile={createProfile}
            onSaveFull={handleSaveFull}
            onActivateProfile={setActiveProfile}
            canManageActiveProfile={canManageActiveProfile}
          />
        ) : null}
      </div>

      {viewer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-xl border bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">{viewer.name}</h3>
            <p className="text-xs text-slate-600">Categoría: {viewer.ai_categories?.name ?? "—"}</p>
            <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-xs text-slate-800">
              {viewer.prompt_content}
            </pre>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => setViewer(null)} className="rounded border px-3 py-2 text-sm hover:bg-slate-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmProfileModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">Confirmar cambio de perfil activo</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Perfil actual:</span> {activeProfileName || "—"}
              </p>
              <p>
                <span className="font-semibold">Nuevo perfil:</span> {pendingProfileName}
              </p>
            </div>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Este cambio afectará los nuevos análisis y reportes generados. Los análisis existentes no se modificarán.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmProfileModalOpen(false);
                  setPendingProfileChangeId(null);
                }}
                className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmProfileChange()}
                className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
