/**
 * Colores pastel por nombre de categoría (UI /admin/ia).
 * Coincidencia por nombre exacto o sin distinguir mayúsculas.
 */

export type CategoryPastelTheme = {
  bg: string;
  border: string;
  text: string;
};

const FALLBACK: CategoryPastelTheme = {
  bg: "bg-gray-50",
  border: "border-gray-200",
  /** Título legible sobre gray-50 (evita gris demasiado claro). */
  text: "text-gray-800",
};

/** Paleta pastel + nombres frecuentes en datos (p. ej. Planes). Textos -700 salvo amarillo (más contraste). */
const CATEGORY_COLORS: Record<string, CategoryPastelTheme> = {
  Investigación: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  Diagnóstico: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
  },
  Oportunidades: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
  },
  Canales: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
  },
  Estrategia: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-700",
  },
  Ejecución: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
  Cierre: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  Planes: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-800",
  },
};

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const NORMALIZED_MAP = new Map<string, CategoryPastelTheme>();
for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
  NORMALIZED_MAP.set(norm(k), v);
}

/**
 * Tema pastel para una categoría. Sin categoría o desconocida → gris suave.
 */
export function getCategoryPastelClasses(categoryName: string | null | undefined): CategoryPastelTheme {
  const raw = (categoryName ?? "").trim();
  if (!raw || raw === "Sin categoría") return FALLBACK;
  const direct = CATEGORY_COLORS[raw];
  if (direct) return direct;
  const byNorm = NORMALIZED_MAP.get(norm(raw));
  if (byNorm) return byNorm;
  return FALLBACK;
}

/** `border` + `bg` para tarjetas / bloques. */
export function categoryPastelSurfaceClass(categoryName: string | null | undefined): string {
  const t = getCategoryPastelClasses(categoryName);
  return `${t.border} ${t.bg}`;
}
