import type { PromptRow } from "./types";
import { categoryPastelSurfaceClass, getCategoryPastelClasses } from "./categoryPastel";

export function PromptCard({ prompt, onEdit }: { prompt: PromptRow; onEdit: () => void }) {
  const pastel = getCategoryPastelClasses(prompt.ai_categories?.name);
  const surface = categoryPastelSurfaceClass(prompt.ai_categories?.name);
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${surface}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${pastel.text}`}>{prompt.name || "Sin nombre"}</p>
        <p className="text-xs text-slate-600">{prompt.status}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Editar
      </button>
    </div>
  );
}
