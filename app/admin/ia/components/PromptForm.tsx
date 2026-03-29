"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryRow, PromptRow } from "./types";
import {
  buildPromptContentFromFields,
  getMissingRequiredPromptSectionsFromRow,
  hasRequiredPromptSectionsFromRow,
  hasRequiredStructuredFields,
  parseStructuredPromptContent,
  type PromptStructuredFields,
} from "@/lib/ai/promptStructure";

type PromptDraft = {
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
};

type PromptSuggestionRow = {
  id: string;
  prompt_id: string;
  suggested_content: string;
  suggestion_type: string;
  reason: string;
  status: "pending" | "applied" | "discarded";
  created_at: string;
  applied_at: string | null;
  discarded_at: string | null;
};

export function PromptForm({
  current,
  categories,
  onSave,
  onSuggestionsChanged,
  saving,
}: {
  current: PromptRow | null;
  categories: CategoryRow[];
  onSave: (payload: PromptDraft) => Promise<void>;
  onSuggestionsChanged?: () => Promise<void> | void;
  saving: boolean;
}) {
  function normalizeFields(source: PromptRow | null): PromptStructuredFields {
    const fromColumns: PromptStructuredFields = {
      role_persona: String(source?.role_persona ?? "").trim(),
      context_environment: String(source?.context_environment ?? "").trim(),
      objective: String(source?.objective ?? "").trim(),
      specific_task: String(source?.specific_task ?? "").trim(),
      constraints: String(source?.constraints ?? "").trim(),
      output_format: String(source?.output_format ?? "").trim(),
      target_audience: String(source?.target_audience ?? "").trim(),
    };
    if (hasRequiredStructuredFields(fromColumns) || fromColumns.target_audience) return fromColumns;
    return parseStructuredPromptContent(String(source?.prompt_content || ""));
  }

  const [form, setForm] = useState<PromptDraft>(() => ({
    id: current?.id,
    name: current?.name ?? "",
    category_id: current?.category_id ?? "",
    description: current?.description ?? "",
    ...normalizeFields(current),
    prompt_content: buildPromptContentFromFields(normalizeFields(current)),
    status: current?.status ?? "draft",
  }));

  const composedPromptPreview = useMemo(
    () =>
      buildPromptContentFromFields({
        role_persona: form.role_persona,
        context_environment: form.context_environment,
        objective: form.objective,
        specific_task: form.specific_task,
        constraints: form.constraints,
        output_format: form.output_format,
        target_audience: form.target_audience,
      }),
    [form]
  );

  const canValidate = useMemo(
    () =>
      form.name.trim() &&
      form.category_id.trim() &&
      hasRequiredStructuredFields({
        role_persona: form.role_persona,
        context_environment: form.context_environment,
        objective: form.objective,
        specific_task: form.specific_task,
        constraints: form.constraints,
        output_format: form.output_format,
      }),
    [form]
  );
  const [suggestions, setSuggestions] = useState<PromptSuggestionRow[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);

  async function handleSavePrompt() {
    const prompt_content = composedPromptPreview;
    const payload: PromptDraft = { ...form, prompt_content, status: "validated" };

    if (!form.name.trim() || !form.category_id.trim()) {
      setStructureError("Nombre y categoría son obligatorios.");
      return;
    }

    if (!hasRequiredPromptSectionsFromRow(payload)) {
      const missing = getMissingRequiredPromptSectionsFromRow(payload);
      setStructureError(
        missing.length > 0
          ? `El prompt no cumple la estructura requerida. Faltan o están incompletos: ${missing.join(", ")}.`
          : "El prompt no cumple con la estructura requerida."
      );
      return;
    }

    setStructureError(null);
    await onSave(payload);
  }

  useEffect(() => {
    setStructureError(null);
  }, [
    form.name,
    form.category_id,
    form.description,
    form.role_persona,
    form.context_environment,
    form.objective,
    form.specific_task,
    form.constraints,
    form.output_format,
    form.target_audience,
    composedPromptPreview,
  ]);

  useEffect(() => {
    setForm({
      id: current?.id,
      name: current?.name ?? "",
      category_id: current?.category_id ?? "",
      description: current?.description ?? "",
      ...normalizeFields(current),
      prompt_content: buildPromptContentFromFields(normalizeFields(current)),
      status: current?.status ?? "draft",
    });
  }, [
    current?.id,
    current?.name,
    current?.category_id,
    current?.description,
    current?.role_persona,
    current?.context_environment,
    current?.objective,
    current?.specific_task,
    current?.constraints,
    current?.output_format,
    current?.target_audience,
    current?.prompt_content,
    current?.status,
  ]);

  useEffect(() => {
    const promptId = current?.id;
    if (!promptId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    async function loadSuggestions() {
      setLoadingSuggestions(true);
      try {
        const r = await fetch(`/api/admin/ia/prompts/${promptId}/suggestions`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || cancelled) return;
        setSuggestions(Array.isArray(j?.data) ? j.data : []);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }
    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

  async function reloadSuggestions() {
    if (!current?.id) return;
    const r = await fetch(`/api/admin/ia/prompts/${current.id}/suggestions`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setSuggestions(Array.isArray(j?.data) ? j.data : []);
  }

  async function applySuggestion(id: string) {
    setSuggestionBusyId(id);
    try {
      const r = await fetch(`/api/admin/ia/suggestions/${id}/apply`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error aplicando mejora");
      await reloadSuggestions();
      await onSuggestionsChanged?.();
    } catch {
      // noop
    } finally {
      setSuggestionBusyId(null);
    }
  }

  async function discardSuggestion(id: string) {
    setSuggestionBusyId(id);
    try {
      const r = await fetch(`/api/admin/ia/suggestions/${id}/discard`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Error descartando mejora");
      await reloadSuggestions();
      await onSuggestionsChanged?.();
    } catch {
      // noop
    } finally {
      setSuggestionBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {current ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Estado:</span>
          {current.prompt_health === "error" ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">error</span>
          ) : current.prompt_health === "mejorable" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              mejorable{(current.pending_suggestions_count ?? 0) > 0 ? ` (${current.pending_suggestions_count})` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">ok</span>
          )}
          {current.prompt_health === "error" ? (
            <span className="text-xs text-rose-700">
              Faltan bloques: {(current.missing_required_blocks ?? []).join(", ") || "estructura incompleta"}
            </span>
          ) : null}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-900">Editor de prompt</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-700">
          Nombre
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Nombre del prompt"
          />
        </label>
        <label className="text-xs text-slate-700">
          Categoría
          <select
            value={form.category_id}
            onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Seleccionar categoría</option>
            {categories.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs text-slate-700">
        Descripción
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          rows={2}
        />
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-700">
          Rol (Persona)
          <textarea
            value={form.role_persona}
            onChange={(e) => setForm((p) => ({ ...p, role_persona: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
        </label>
        <label className="text-xs text-slate-700">
          Contexto / Entorno
          <textarea
            value={form.context_environment}
            onChange={(e) => setForm((p) => ({ ...p, context_environment: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
        </label>
        <label className="text-xs text-slate-700">
          Objetivo
          <textarea
            value={form.objective}
            onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
        </label>
        <label className="text-xs text-slate-700">
          Tarea específica
          <textarea
            value={form.specific_task}
            onChange={(e) => setForm((p) => ({ ...p, specific_task: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
        </label>
        <label className="text-xs text-slate-700">
          Restricciones (Limitaciones)
          <textarea
            value={form.constraints}
            onChange={(e) => setForm((p) => ({ ...p, constraints: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
        </label>
        <label className="text-xs text-slate-700">
          Formato de Salida
          <textarea
            value={form.output_format}
            onChange={(e) => setForm((p) => ({ ...p, output_format: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
        </label>
      </div>

      <label className="mt-3 block text-xs text-slate-700">
        Público objetivo (opcional)
        <input
          value={form.target_audience}
          onChange={(e) => setForm((p) => ({ ...p, target_audience: e.target.value }))}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Ej: Dueños de pymes de servicios"
        />
      </label>

      <div className="mt-3">
        <p className="text-xs font-semibold text-slate-700">Vista previa del prompt final (solo lectura)</p>
        {!canValidate ? (
          <p className="mt-1 text-xs text-amber-700">
            Completa: Rol (Persona), Contexto/Entorno, Objetivo, Tarea específica, Restricciones (Limitaciones) y Formato de Salida.
          </p>
        ) : null}
        <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-xs text-slate-700">
          {composedPromptPreview}
        </pre>
      </div>

      {structureError ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{structureError}</div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => void handleSavePrompt()}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar prompt"}
        </button>
      </div>

      {current?.id ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-sm font-semibold text-slate-900">Sugerencias de mejora</h4>
          {loadingSuggestions ? <p className="mt-2 text-xs text-slate-500">Cargando sugerencias…</p> : null}
          {!loadingSuggestions && suggestions.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Sin sugerencias registradas para este prompt.</p>
          ) : null}
          <div className="mt-3 space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">{s.suggestion_type}</p>
                <p className="mt-1 text-xs text-slate-600">{s.reason}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Contenido actual</p>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border bg-slate-50 p-2 text-[11px] text-slate-700">
                      {composedPromptPreview}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Contenido sugerido</p>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border bg-emerald-50 p-2 text-[11px] text-slate-700">
                      {s.suggested_content}
                    </pre>
                  </div>
                </div>
                {s.status === "pending" ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void applySuggestion(s.id)}
                      disabled={suggestionBusyId === s.id}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Aplicar mejora
                    </button>
                    <button
                      type="button"
                      onClick={() => void discardSuggestion(s.id)}
                      disabled={suggestionBusyId === s.id}
                      className="rounded border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Descartar
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">Estado: {s.status}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
