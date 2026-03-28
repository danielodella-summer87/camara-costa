"use client";

import { PROMPT_TYPE_OPTIONS, type PromptTypeKey } from "./types";

export function ConfigTabs({
  activeType,
  statusByType,
  onChange,
}: {
  activeType: PromptTypeKey;
  statusByType: Record<string, "draft" | "validated">;
  onChange: (next: PromptTypeKey) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        {PROMPT_TYPE_OPTIONS.map((t) => {
          const st = statusByType[t.key] ?? "draft";
          const validated = st === "validated";
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                activeType === t.key
                  ? validated
                    ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                    : "border-slate-300 bg-slate-200 text-slate-800"
                  : validated
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
