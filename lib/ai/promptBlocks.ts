import { IA_MODULE_LABELS, IA_MODULE_ORDER } from "@/lib/ai/moduleCatalog";
import { buildStructuredPromptTemplate } from "@/lib/ai/promptStructure";

export type PromptCategoryColor =
  | "blue"
  | "yellow"
  | "green"
  | "violet"
  | "pink"
  | "orange"
  | "slate";

export type PromptBlockStatus = "draft" | "generated" | "approved";

export type PromptBuilder = {
  role: string;
  context: string;
  task: string;
  constraints: string;
  output_format: string;
  objective: string;
};

export type PromptBlock = {
  key: string;
  label: string;
  category: string;
  category_color: PromptCategoryColor;
  /** Campo legacy/manual. Se mantiene por compatibilidad. */
  prompt: string;
  builder: PromptBuilder;
  generated_prompt: string;
  approved_prompt: string;
  status: PromptBlockStatus;
  enabled: boolean;
  order: number;
  module_id?: string;
};

export type IAPromptsConfig = {
  basePrompt: string;
  prompts: PromptBlock[];
  modulos: Record<string, string>;
};

const DEFAULT_CATEGORY = "General";
const DEFAULT_COLOR: PromptCategoryColor = "slate";
const DEFAULT_BUILDER: PromptBuilder = {
  role: "",
  context: "",
  task: "",
  constraints: "",
  output_format: "",
  objective: "",
};

function safeColor(v: unknown): PromptCategoryColor {
  return v === "blue" || v === "yellow" || v === "green" || v === "violet" || v === "pink" || v === "orange" || v === "slate"
    ? v
    : DEFAULT_COLOR;
}

export function makeDefaultPromptBlocks(): PromptBlock[] {
  return IA_MODULE_ORDER.map((moduleId, idx) => ({
    key: `prompt_${String(idx + 1).padStart(2, "0")}`,
    label: IA_MODULE_LABELS[moduleId] ?? moduleId,
    category: DEFAULT_CATEGORY,
    category_color: DEFAULT_COLOR,
    prompt: buildStructuredPromptTemplate(),
    builder: { ...DEFAULT_BUILDER },
    generated_prompt: "",
    approved_prompt: "",
    status: "draft",
    enabled: true,
    order: idx + 1,
    module_id: moduleId,
  }));
}

export function resolveOfficialPrompt(block: PromptBlock): string {
  if ((block.approved_prompt || "").trim()) return block.approved_prompt.trim();
  if ((block.generated_prompt || "").trim()) return block.generated_prompt.trim();
  return (block.prompt || "").trim();
}

export function modulosFromPromptBlocks(prompts: PromptBlock[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of prompts) {
    if (!p.enabled) continue;
    const moduleId = (p.module_id || "").trim();
    if (!moduleId) continue;
    const prompt = resolveOfficialPrompt(p);
    if (!prompt) continue;
    out[moduleId] = prompt;
  }
  return out;
}

export function normalizeIAPromptsConfig(raw: unknown): IAPromptsConfig {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const basePrompt = typeof obj.basePrompt === "string" ? obj.basePrompt : "";
  const legacyModulos =
    obj.modulos && typeof obj.modulos === "object" && !Array.isArray(obj.modulos)
      ? (obj.modulos as Record<string, string>)
      : {};

  const promptsRaw = Array.isArray(obj.prompts) ? obj.prompts : null;
  let prompts: PromptBlock[] = [];
  if (promptsRaw) {
    prompts = promptsRaw
      .map((x, idx) => {
        if (!x || typeof x !== "object") return null;
        const r = x as Record<string, unknown>;
        const key = typeof r.key === "string" && r.key.trim() ? r.key.trim() : `prompt_${String(idx + 1).padStart(2, "0")}`;
        const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : `Prompt ${idx + 1}`;
        const category = typeof r.category === "string" && r.category.trim() ? r.category.trim() : DEFAULT_CATEGORY;
        const prompt = typeof r.prompt === "string" ? r.prompt : "";
        const generated_prompt = typeof r.generated_prompt === "string" ? r.generated_prompt : "";
        const approved_prompt = typeof r.approved_prompt === "string" ? r.approved_prompt : "";
        const status: PromptBlockStatus =
          r.status === "approved" || r.status === "generated" || r.status === "draft"
            ? r.status
            : approved_prompt.trim()
              ? "approved"
              : generated_prompt.trim()
                ? "generated"
                : "draft";
        const enabled = r.enabled !== false;
        const order = typeof r.order === "number" && Number.isFinite(r.order) ? r.order : idx + 1;
        const module_id = typeof r.module_id === "string" ? r.module_id.trim() : "";
        const builderRaw = r.builder && typeof r.builder === "object" ? (r.builder as Record<string, unknown>) : {};
        const builder: PromptBuilder = {
          role: typeof builderRaw.role === "string" ? builderRaw.role : "",
          context: typeof builderRaw.context === "string" ? builderRaw.context : "",
          task: typeof builderRaw.task === "string" ? builderRaw.task : "",
          constraints: typeof builderRaw.constraints === "string" ? builderRaw.constraints : "",
          output_format: typeof builderRaw.output_format === "string" ? builderRaw.output_format : "",
          objective: typeof builderRaw.objective === "string" ? builderRaw.objective : "",
        };
        return {
          key,
          label,
          category,
          category_color: safeColor(r.category_color),
          prompt,
          builder,
          generated_prompt,
          approved_prompt,
          status,
          enabled,
          order,
          ...(module_id ? { module_id } : {}),
        } as PromptBlock;
      })
      .filter(Boolean) as PromptBlock[];
    prompts.sort((a, b) => a.order - b.order);
  } else {
    const defs = makeDefaultPromptBlocks();
    prompts = defs.map((d) => ({
      ...d,
      prompt:
        typeof legacyModulos[d.module_id ?? ""] === "string" && legacyModulos[d.module_id ?? ""].trim()
          ? legacyModulos[d.module_id ?? ""]
          : buildStructuredPromptTemplate(),
      generated_prompt: "",
      approved_prompt: "",
      status: "draft",
    }));
  }

  const modulos = {
    ...legacyModulos,
    ...modulosFromPromptBlocks(prompts),
  };
  return { basePrompt, prompts, modulos };
}

export function categoryBadgeClass(color: PromptCategoryColor): string {
  switch (color) {
    case "blue":
      return "bg-sky-100 text-sky-800";
    case "yellow":
      return "bg-amber-100 text-amber-900";
    case "green":
      return "bg-emerald-100 text-emerald-900";
    case "violet":
      return "bg-violet-100 text-violet-900";
    case "pink":
      return "bg-rose-100 text-rose-900";
    case "orange":
      return "bg-orange-100 text-orange-900";
    default:
      return "bg-slate-100 text-slate-800";
  }
}
