/**
 * Evaluación asistida (fase 1: heurística local, sin LLM ni APIs).
 * No persiste datos; no reemplaza el criterio del usuario.
 */

export type InitiativeAiPriority = "alta" | "media" | "baja";

export type InitiativeAiRecommendation = "convertir" | "revisar" | "descartar";

export type InitiativeAiAssessment = {
  aiPriority: InitiativeAiPriority;
  aiRecommendation: InitiativeAiRecommendation;
  aiReason: string;
};

/** Campos que ya pueden venir del listado de iniciativas (sin cambiar el backend). */
export type InitiativeAssessmentInput = {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  celular?: string | null;
  contacto_email?: string | null;
  contacto_celular?: string | null;
  web?: string | null;
  instagram?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  rubro?: string | null;
  descripcion?: string | null;
  estado_revision?: string | null;
  converted_lead_id?: string | null;
};

function trim(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function hasNombre(r: InitiativeAssessmentInput): boolean {
  return trim(r.nombre).length >= 2;
}

function hasContacto(r: InitiativeAssessmentInput): boolean {
  return Boolean(
    trim(r.email) ||
      trim(r.telefono) ||
      trim(r.celular) ||
      trim(r.contacto_email) ||
      trim(r.contacto_celular)
  );
}

/** Contexto comercial mínimo: presencia digital, rubro o descripción útil. */
function hasContexto(r: InitiativeAssessmentInput): boolean {
  const desc = trim(r.descripcion);
  return Boolean(
    trim(r.web) ||
      trim(r.linkedin_empresa) ||
      trim(r.linkedin_personal) ||
      trim(r.instagram) ||
      trim(r.rubro) ||
      desc.length >= 40
  );
}

function estadoCerrado(
  r: InitiativeAssessmentInput
): "convertida" | "descartada" | null {
  if (trim(r.converted_lead_id)) return "convertida";
  const k = trim(r.estado_revision).toLowerCase();
  if (k === "descartada" || k === "descartado") return "descartada";
  if (k === "convertida_a_lead" || k === "convertida") return "convertida";
  return null;
}

/**
 * Heurística fase 1:
 * - Alta: nombre, contacto (email o teléfono/celular o contacto), contexto (web, linkedin, rubro, etc.).
 * - Media: nombre y algo de señal (contacto o contexto) pero no el paquete completo.
 * - Baja: datos muy incompletos o sin utilidad aparente para seguimiento.
 *
 * Registros ya convertidos o descartados: mensaje neutro, sin empujar a convertir de nuevo.
 */
export function getInitiativeAiAssessment(record: InitiativeAssessmentInput): InitiativeAiAssessment {
  const cerrado = estadoCerrado(record);

  if (cerrado === "convertida") {
    return {
      aiPriority: "baja",
      aiRecommendation: "revisar",
      aiReason: "Ya figura como convertida; abrí el lead vinculado si necesitás más contexto.",
    };
  }

  if (cerrado === "descartada") {
    return {
      aiPriority: "baja",
      aiRecommendation: "descartar",
      aiReason: "Registro descartado; no suele convenir convertir sin revisar el detalle primero.",
    };
  }

  if (!hasNombre(record)) {
    return {
      aiPriority: "baja",
      aiRecommendation: "descartar",
      aiReason: "Falta un nombre claro de la iniciativa; conviene completar datos antes de avanzar.",
    };
  }

  const contacto = hasContacto(record);
  const contexto = hasContexto(record);

  if (contacto && contexto) {
    return {
      aiPriority: "alta",
      aiRecommendation: "convertir",
      aiReason: "Tiene datos de contacto y contexto suficiente para iniciar gestión comercial.",
    };
  }

  if (contacto && !contexto) {
    return {
      aiPriority: "media",
      aiRecommendation: "revisar",
      aiReason: "Hay forma de contacto, pero falta web, rubro o más detalle; conviene revisar antes de convertir.",
    };
  }

  if (!contacto && contexto) {
    return {
      aiPriority: "media",
      aiRecommendation: "revisar",
      aiReason: "Hay contexto del negocio, pero falta un contacto directo claro; revisá el detalle.",
    };
  }

  // Sin contacto ni contexto (solo nombre o casi)
  return {
    aiPriority: "baja",
    aiRecommendation: "descartar",
    aiReason: "Hay poca información útil para un seguimiento comercial efectivo.",
  };
}

export function labelAiPriority(p: InitiativeAiPriority): string {
  const m: Record<InitiativeAiPriority, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };
  return m[p];
}

export function labelAiRecommendation(r: InitiativeAiRecommendation): string {
  const m: Record<InitiativeAiRecommendation, string> = {
    convertir: "Convertir",
    revisar: "Revisar",
    descartar: "Descartar",
  };
  return m[r];
}

export function badgeClassAiPriority(p: InitiativeAiPriority): string {
  switch (p) {
    case "alta":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "media":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "baja":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

/** Colores distintos del CTA verde «Convertir a Lead» (indigo / cielo / slate). */
export function badgeClassAiRecommendation(r: InitiativeAiRecommendation): string {
  switch (r) {
    case "convertir":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "revisar":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "descartar":
    default:
      return "border-slate-300 bg-white text-slate-600";
  }
}
