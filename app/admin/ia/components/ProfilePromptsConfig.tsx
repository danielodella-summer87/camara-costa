"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { PromptForm } from "./PromptForm";
import { PromptCard } from "./PromptCard";
import type { AnalysisProfilePromptRow, CategoryRow, PromptRow } from "./types";
import { categoryPastelSurfaceClass, getCategoryPastelClasses } from "./categoryPastel";

type ProfilePromptPair = { link: AnalysisProfilePromptRow; prompt: PromptRow };
type PromptSavePayload = Parameters<ComponentProps<typeof PromptForm>["onSave"]>[0];

function buildPairs(links: AnalysisProfilePromptRow[], prompts: PromptRow[]): ProfilePromptPair[] {
  const sorted = [...links].sort((a, b) => a.execution_order - b.execution_order);
  const list: ProfilePromptPair[] = [];
  for (const link of sorted) {
    const prompt = prompts.find((p) => p.id === link.prompt_id);
    if (prompt) list.push({ link, prompt });
  }
  return list;
}

function SortableProfilePromptBlock({
  pair,
  displayOrder,
  editing,
  categories,
  saving,
  onEdit,
  onSavePrompt,
  onSuggestionsChanged,
}: {
  pair: ProfilePromptPair;
  displayOrder: number;
  editing: boolean;
  categories: CategoryRow[];
  saving: boolean;
  onEdit: (id: string) => void;
  onSavePrompt: (payload: PromptSavePayload) => Promise<void>;
  onSuggestionsChanged: () => Promise<void> | void;
}) {
  const { link, prompt } = pair;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: editing,
  });
  const pastel = getCategoryPastelClasses(prompt.ai_categories?.name);
  const surface = categoryPastelSurfaceClass(prompt.ai_categories?.name);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border ${surface} ${
        isDragging ? "z-10 opacity-90 shadow-md ring-2 ring-indigo-300 ring-offset-1" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {!editing ? (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-1 text-slate-500 hover:bg-black/5 active:cursor-grabbing"
            aria-label="Arrastrar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 shrink-0" />
          </button>
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${pastel.text}`}>
            <span className="tabular-nums opacity-80">{displayOrder}.</span> {prompt.name || "Sin nombre"}
          </p>
          <p className="text-xs text-slate-600">{prompt.status}</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => onEdit(prompt.id)}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Editar
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="border-t border-black/10 bg-white px-2 pb-2">
          <PromptForm
            current={prompt}
            categories={categories}
            saving={saving}
            onSave={onSavePrompt}
            onSuggestionsChanged={onSuggestionsChanged}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ProfilePromptsConfig({
  profileId,
  profileName,
  links,
  prompts,
  categories,
  saving,
  activePromptId,
  onEdit,
  onSavePrompt,
  onSuggestionsChanged,
  onOrderSaved,
  onOrderError,
}: {
  profileId: string;
  profileName: string;
  links: AnalysisProfilePromptRow[];
  prompts: PromptRow[];
  categories: CategoryRow[];
  saving: boolean;
  activePromptId: string | null;
  onEdit: (id: string) => void;
  onSavePrompt: (payload: PromptSavePayload) => Promise<void>;
  onSuggestionsChanged: () => Promise<void> | void;
  onOrderSaved: () => Promise<void>;
  onOrderError: (message: string) => void;
}) {
  const [pairs, setPairs] = useState<ProfilePromptPair[]>(() => buildPairs(links, prompts));
  const [reordering, setReordering] = useState(false);

  const linksSignature = useMemo(
    () =>
      [...links]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((l) => `${l.id}:${l.execution_order}:${l.prompt_id}`)
        .join("|"),
    [links]
  );

  useEffect(() => {
    if (reordering) return;
    setPairs(buildPairs(links, prompts));
  }, [profileId, linksSignature, prompts, reordering]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const linkedPromptIds = useMemo(() => new Set(links.map((l) => l.prompt_id)), [links]);

  const restPromptsSorted = useMemo(() => {
    const copy = prompts.filter((p) => p.id === "__new__" || !linkedPromptIds.has(p.id));
    const nuevos = copy.filter((p) => p.id === "__new__");
    const rest = copy
      .filter((p) => p.id !== "__new__")
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
    return [...nuevos, ...rest];
  }, [prompts, linkedPromptIds]);

  const sortableIds = useMemo(() => pairs.map((p) => p.link.id), [pairs]);

  const saveNewOrder = useCallback(
    async (list: ProfilePromptPair[]) => {
      if (!profileId) return;
      const items = list.map((row, index) => ({
        id: row.link.id,
        execution_order: (index + 1) * 10,
      }));
      const r = await fetch("/api/admin/ia/profile-prompts/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, items }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Error guardando orden");
    },
    [profileId]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = pairs.findIndex((p) => p.link.id === active.id);
      const newIndex = pairs.findIndex((p) => p.link.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const previous = pairs;
      const newList = arrayMove(pairs, oldIndex, newIndex);
      const updated = newList.map((item, index) => ({
        ...item,
        link: { ...item.link, execution_order: (index + 1) * 10 },
      }));
      setPairs(updated);

      setReordering(true);
      try {
        await saveNewOrder(updated);
        await onOrderSaved();
      } catch (e) {
        setPairs(previous);
        onOrderError(e instanceof Error ? e.message : "Error guardando orden");
      } finally {
        setReordering(false);
      }
    },
    [pairs, saveNewOrder, onOrderSaved, onOrderError]
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-slate-700">Orden en perfil activo ({profileName || "—"})</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Arrastrá con el ícono ⋮⋮ para cambiar <code className="rounded bg-slate-100 px-1">execution_order</code>. Se guarda
          automáticamente.
        </p>
        {reordering ? <p className="mt-1 text-xs text-indigo-600">Guardando orden…</p> : null}
        {!profileId ? (
          <p className="mt-2 text-sm text-slate-600">No hay perfil seleccionado.</p>
        ) : pairs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Ningún prompt enlazado a este perfil. Asocialos desde «Prompts activos» o «Perfiles de análisis».
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="mt-2 grid gap-2">
                {pairs.map((pair, index) => (
                  <SortableProfilePromptBlock
                    key={pair.link.id}
                    pair={pair}
                    displayOrder={index + 1}
                    editing={activePromptId === pair.prompt.id}
                    categories={categories}
                    saving={saving}
                    onEdit={onEdit}
                    onSavePrompt={onSavePrompt}
                    onSuggestionsChanged={onSuggestionsChanged}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700">Resto del catálogo</p>
        <p className="mt-0.5 text-xs text-slate-500">Prompts no incluidos en el perfil activo (o borrador nuevo).</p>
        <div className="mt-2 grid gap-2">
          {restPromptsSorted.map((p) =>
            activePromptId === p.id ? (
              <PromptForm
                key={p.id}
                current={p}
                categories={categories}
                saving={saving}
                onSave={onSavePrompt}
                onSuggestionsChanged={onSuggestionsChanged}
              />
            ) : (
              <PromptCard key={p.id} prompt={p} onEdit={() => onEdit(p.id)} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
