export const REQUIRED_PROMPT_SECTIONS = [
  "Rol (Persona)",
  "Contexto/Entorno",
  "Objetivo",
  "Tarea específica",
  "Restricciones (Limitaciones)",
  "Formato de Salida",
] as const;

type PromptTemplateInput = {
  role?: string;
  context?: string;
  objective?: string;
  task?: string;
  constraints?: string;
  output_format?: string;
  target_audience?: string;
};

export type PromptStructuredFields = {
  role_persona: string;
  context_environment: string;
  objective: string;
  specific_task: string;
  constraints: string;
  output_format: string;
  target_audience: string;
};

function line(value: string | undefined): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v || "[Completar]";
}

export function buildStructuredPromptTemplate(input?: PromptTemplateInput): string {
  const role = line(input?.role);
  const context = line(input?.context);
  const objective = line(input?.objective);
  const task = line(input?.task);
  const constraints = line(input?.constraints);
  const output = line(input?.output_format);
  const targetAudience = line(input?.target_audience);

  const blocks = [
    "Rol (Persona):",
    role,
    "",
    "Contexto/Entorno:",
    context,
    "",
    "Objetivo:",
    objective,
    "",
    "Tarea específica:",
    task,
    "",
    "Restricciones (Limitaciones):",
    constraints,
    "",
    "Formato de Salida:",
    output,
  ];
  if (String(input?.target_audience ?? "").trim()) {
    blocks.push("", "Público objetivo:", targetAudience);
  }
  return blocks.join("\n");
}

export function hasRequiredPromptSections(prompt: string): boolean {
  const text = String(prompt || "").toLowerCase();
  return REQUIRED_PROMPT_SECTIONS.every((section) => text.includes(section.toLowerCase()));
}

export function getMissingRequiredPromptSections(prompt: string): string[] {
  const text = String(prompt || "").toLowerCase();
  return REQUIRED_PROMPT_SECTIONS.filter((section) => !text.includes(section.toLowerCase()));
}

const SECTION_MAP: Array<{ label: string; key: keyof PromptStructuredFields }> = [
  { label: "Rol (Persona)", key: "role_persona" },
  { label: "Contexto/Entorno", key: "context_environment" },
  { label: "Objetivo", key: "objective" },
  { label: "Tarea específica", key: "specific_task" },
  { label: "Restricciones (Limitaciones)", key: "constraints" },
  { label: "Formato de Salida", key: "output_format" },
  { label: "Público objetivo", key: "target_audience" },
];

function escapeRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(text: string, label: string): string {
  const next = SECTION_MAP.filter((s) => s.label !== label)
    .map((s) => escapeRegex(s.label))
    .join("|");
  const re = new RegExp(`${escapeRegex(label)}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${next})\\s*:|$)`, "i");
  const m = text.match(re);
  return String(m?.[1] ?? "").trim();
}

export function parseStructuredPromptContent(prompt: string): PromptStructuredFields {
  const text = String(prompt || "");
  const parsed: PromptStructuredFields = {
    role_persona: "",
    context_environment: "",
    objective: "",
    specific_task: "",
    constraints: "",
    output_format: "",
    target_audience: "",
  };
  for (const section of SECTION_MAP) {
    parsed[section.key] = extractSection(text, section.label);
  }
  if (!parsed.specific_task && text.trim()) parsed.specific_task = text.trim();
  return parsed;
}

export function buildPromptContentFromFields(fields: Partial<PromptStructuredFields>): string {
  const blocks = [
    "Rol (Persona):",
    line(fields.role_persona),
    "",
    "Contexto/Entorno:",
    line(fields.context_environment),
    "",
    "Objetivo:",
    line(fields.objective),
    "",
    "Tarea específica:",
    line(fields.specific_task),
    "",
    "Restricciones (Limitaciones):",
    line(fields.constraints),
    "",
    "Formato de Salida:",
    line(fields.output_format),
  ];
  const audience = String(fields.target_audience ?? "").trim();
  if (audience) {
    blocks.push("", "Público objetivo:", audience);
  }
  return blocks.join("\n");
}

export function hasRequiredStructuredFields(fields: Partial<PromptStructuredFields>): boolean {
  return Boolean(
    String(fields.role_persona ?? "").trim() &&
      String(fields.context_environment ?? "").trim() &&
      String(fields.objective ?? "").trim() &&
      String(fields.specific_task ?? "").trim() &&
      String(fields.constraints ?? "").trim() &&
      String(fields.output_format ?? "").trim()
  );
}

/** Fila de ai_prompts: columnas estructuradas + prompt_content opcional (solo caché / legado). */
export type PromptRowLike = {
  prompt_content?: string | null;
  role_persona?: string | null;
  context_environment?: string | null;
  objective?: string | null;
  specific_task?: string | null;
  constraints?: string | null;
  output_format?: string | null;
  target_audience?: string | null;
};

const CORE_STRUCTURED_KEYS: (keyof PromptStructuredFields)[] = [
  "role_persona",
  "context_environment",
  "objective",
  "specific_task",
  "constraints",
  "output_format",
];

const CORE_KEY_TO_SECTION_LABEL: Record<
  Exclude<keyof PromptStructuredFields, "target_audience">,
  (typeof REQUIRED_PROMPT_SECTIONS)[number]
> = {
  role_persona: "Rol (Persona)",
  context_environment: "Contexto/Entorno",
  objective: "Objetivo",
  specific_task: "Tarea específica",
  constraints: "Restricciones (Limitaciones)",
  output_format: "Formato de Salida",
};

function trimField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Origen de verdad: columnas estructuradas; prompt_content solo rellena huecos (caché / migración).
 */
export function resolveStructuredFieldsFromRow(row: PromptRowLike): PromptStructuredFields {
  const fromCols: PromptStructuredFields = {
    role_persona: trimField(row.role_persona),
    context_environment: trimField(row.context_environment),
    objective: trimField(row.objective),
    specific_task: trimField(row.specific_task),
    constraints: trimField(row.constraints),
    output_format: trimField(row.output_format),
    target_audience: trimField(row.target_audience),
  };
  const fromCache = parseStructuredPromptContent(String(row.prompt_content ?? ""));
  return {
    role_persona: fromCols.role_persona || fromCache.role_persona,
    context_environment: fromCols.context_environment || fromCache.context_environment,
    objective: fromCols.objective || fromCache.objective,
    specific_task: fromCols.specific_task || fromCache.specific_task,
    constraints: fromCols.constraints || fromCache.constraints,
    output_format: fromCols.output_format || fromCache.output_format,
    target_audience: fromCols.target_audience || fromCache.target_audience,
  };
}

/** Texto canónico derivado (no leer prompt_content crudo para validar). */
export function canonicalPromptFromRow(row: PromptRowLike): string {
  return buildPromptContentFromFields(resolveStructuredFieldsFromRow(row));
}

/**
 * Valida estructura sobre buildPromptContentFromFields(resolve(row)), no sobre prompt_content guardado.
 */
export function hasRequiredPromptSectionsFromRow(row: PromptRowLike): boolean {
  const f = resolveStructuredFieldsFromRow(row);
  if (!hasRequiredStructuredFields(f)) return false;
  return hasRequiredPromptSections(buildPromptContentFromFields(f));
}

export function getMissingRequiredPromptSectionsFromRow(row: PromptRowLike): string[] {
  const f = resolveStructuredFieldsFromRow(row);
  if (!hasRequiredStructuredFields(f)) {
    return CORE_STRUCTURED_KEYS.filter((k) => !String(f[k] ?? "").trim()).map(
      (k) => CORE_KEY_TO_SECTION_LABEL[k as Exclude<keyof PromptStructuredFields, "target_audience">]
    );
  }
  return getMissingRequiredPromptSections(buildPromptContentFromFields(f));
}

