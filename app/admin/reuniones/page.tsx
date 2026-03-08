"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type MeetingType = "discovery" | "proposal" | "closing";

type ChecklistItem = {
  id: string;
  text: string;
  /** Si true, al "Nueva sesión" se pone en false. Default true. */
  resetOnNewSession?: boolean;
  /** Si true, al "Nueva sesión" se mantiene el valor actual. Default false. */
  sticky?: boolean;
};
type ChecklistSection = { title: string; items: ChecklistItem[] };

type MeetingTemplate = {
  key: MeetingType;
  tabTitle: string;
  goal: string;
  roadmap: { title: string; timebox: string; mode: "hablar" | "escuchar" | "silencio"; bullets: string[] }[];
  checklist: ChecklistSection[];
};

const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    key: "discovery",
    tabTitle: "Descubrimiento & Autoridad",
    goal:
      "Romper el hielo, entender el negocio y al decisor, instalar autoridad mostrando que ya entendimos su dolor y ordenar el siguiente paso.",
    roadmap: [
      {
        title: "1) Apertura + marco (acuerdo de agenda)",
        timebox: "2–3 min",
        mode: "hablar",
        bullets: [
          "Definir objetivo de la reunión y duración.",
          "Pedir permiso para hacer preguntas y tomar notas.",
          "Acordar al final: próximos pasos + responsable + fecha.",
        ],
      },
      {
        title: "2) Contexto del negocio (diagnóstico)",
        timebox: "10–15 min",
        mode: "escuchar",
        bullets: [
          "Preguntas abiertas. No vender todavía.",
          "Tomar literal las frases de dolor (para reflejarlas luego).",
          "Si hay silencio: NO rescatar. Esperar 5–8 segundos mínimo.",
        ],
      },
      {
        title: "3) Tomador de decisión + proceso de compra",
        timebox: "5–8 min",
        mode: "escuchar",
        bullets: [
          "Preguntar quién decide, quién influye, quién ejecuta.",
          "Entender presupuesto: cómo se aprueba y en qué plazos.",
          "Si esquiva: preguntar \"¿Cómo se tomó la última decisión similar?\"",
        ],
      },
      {
        title: "4) Autoridad (micro-prueba)",
        timebox: "5–7 min",
        mode: "hablar",
        bullets: [
          "Mostrar 2–3 hallazgos del estudio (FODA como eje).",
          "Regla: breve, concreto, y volver a pregunta.",
          "Cierre de sección: \"¿Esto te hace sentido?\" → silencio 3–5s.",
        ],
      },
      {
        title: "5) Alineación de objetivo + siguiente paso",
        timebox: "5–8 min",
        mode: "hablar",
        bullets: [
          "Confirmar objetivo: qué sería éxito para ellos.",
          "Definir siguiente reunión/entrega (propuesta o revisión).",
          "Cerrá con recap + acción + fecha.",
        ],
      },
    ],
    checklist: [
      {
        title: "Apertura (no saltear)",
        items: [
          { id: "d1", text: "Confirmé duración y objetivo de esta reunión (1 frase)." },
          { id: "d2", text: "Pedí permiso para hacer preguntas y tomar notas." },
          { id: "d3", text: "Acordé que al final definimos próximos pasos con fecha." },
        ],
      },
      {
        title: "Exploración (hablar poco, escuchar mucho)",
        items: [
          { id: "d4", text: "Hice al menos 5 preguntas abiertas (qué/por qué/cómo)." },
          { id: "d5", text: "Registré textual 3 frases de dolor del lead." },
          { id: "d6", text: "Apliqué silencio intencional: esperé 5–8s cuando se frenó." },
          { id: "d7", text: "No defendí ni expliqué de más: devolví con una pregunta." },
        ],
      },
      {
        title: "Decisión y compra (modo escucha)",
        items: [
          { id: "d8", text: "Identifiqué decisor / influenciadores / ejecutores." },
          { id: "d9", text: "Entendí proceso: pasos, tiempos y cómo se aprueba presupuesto." },
          { id: "d10", text: "Si hubo evasivas, pregunté por un caso pasado similar (cómo se decidió)." },
        ],
      },
      {
        title: "Autoridad (micro-impacto, sin vender agresivo)",
        items: [
          { id: "d11", text: "Mostré 2–3 puntos del FODA (dolor + oportunidad), breve." },
          { id: "d12", text: "Validé: \"¿Esto te hace sentido?\" y guardé silencio 3–5s." },
          { id: "d13", text: "Conecté 1 caso de éxito relevante (1 minuto máximo)." },
        ],
      },
      {
        title: "Cierre (claridad total)",
        items: [
          { id: "d14", text: "Recapitulé en 30 segundos (dolor + objetivo + camino)." },
          { id: "d15", text: "Definí próximo paso con fecha y responsable." },
        ],
      },
    ],
  },

  {
    key: "proposal",
    tabTitle: "Revisión de propuesta",
    goal:
      "Validar entendimiento, escuchar objeciones reales, ajustar sin regalar valor y preparar el cierre con claridad.",
    roadmap: [
      {
        title: "1) Re-encuadre (agenda + objetivo)",
        timebox: "2–3 min",
        mode: "hablar",
        bullets: [
          "Objetivo: validar propuesta, despejar dudas, decidir próximos pasos.",
          "Regla: hoy NO se rediseña todo; hoy se confirma encaje y decisión.",
        ],
      },
      {
        title: "2) Validación (que hablen ellos primero)",
        timebox: "8–12 min",
        mode: "escuchar",
        bullets: [
          "Pregunta clave: \"¿Qué fue lo que más te gustó y qué te preocupó?\"",
          "Silencio 5–8s después de preguntar. No rescatar.",
          "Buscar objeción REAL (dinero/tiempo/confianza/prioridad).",
        ],
      },
      {
        title: "3) Objeciones (una por vez)",
        timebox: "10–15 min",
        mode: "escuchar",
        bullets: [
          "Repetir objeción con sus palabras (reflejo).",
          "Confirmar: \"¿Eso es lo principal?\" → silencio.",
          "Responder corto y volver a preguntar.",
        ],
      },
      {
        title: "4) Alineación final (alcance + expectativas)",
        timebox: "5–8 min",
        mode: "hablar",
        bullets: [
          "Confirmar entregables y éxito medible.",
          "Si hay cambios: acordar \"cambio\" vs \"extra\" (no regalar).",
        ],
      },
      {
        title: "5) Próximo paso (cierre o reunión de cierre)",
        timebox: "3–5 min",
        mode: "hablar",
        bullets: [
          "Si está listo: pedir decisión con calma.",
          "Si no: agendar cierre con fecha y criterio claro (qué falta).",
        ],
      },
    ],
    checklist: [
      {
        title: "Validación (primero escucho)",
        items: [
          { id: "p1", text: "Abrí con objetivo y confirmé duración." },
          { id: "p2", text: "Pregunté: \"¿Qué te gustó más y qué te preocupó?\" y guardé silencio." },
          { id: "p3", text: "Identifiqué objeción real (no síntoma)." },
        ],
      },
      {
        title: "Objeciones (manejo fino)",
        items: [
          { id: "p4", text: "Reflejé la objeción con sus palabras y pedí confirmación." },
          { id: "p5", text: "Ataqué UNA objeción por vez (no mezclé temas)." },
          { id: "p6", text: "Respondí corto + volví a preguntar (no monologué)." },
          { id: "p7", text: "Usé silencio después de mi respuesta (3–5s) para que procesen." },
        ],
      },
      {
        title: "Alcance / valor",
        items: [
          { id: "p8", text: "Confirmé entregables y criterios de éxito (medibles)." },
          { id: "p9", text: "Si pidieron cambios, definí si es ajuste o extra (sin regalar)." },
        ],
      },
      {
        title: "Cierre del paso",
        items: [
          { id: "p10", text: "Definí próximo paso: decisión hoy o reunión de cierre con fecha." },
          { id: "p11", text: "Dejé por escrito qué falta para decidir (si aplica)." },
        ],
      },
    ],
  },

  {
    key: "closing",
    tabTitle: "Cierre",
    goal:
      "Pedir decisión con claridad, manejar última objeción y acordar inicio: alcance, fechas, responsables y cobro.",
    roadmap: [
      {
        title: "1) Recap corto (autoridad + foco)",
        timebox: "2–3 min",
        mode: "hablar",
        bullets: [
          "Recap: dolor → objetivo → solución → resultado esperado.",
          "Confirmar: \"¿Estamos alineados?\" → silencio.",
        ],
      },
      {
        title: "2) Decisión (pregunta directa, sin ansiedad)",
        timebox: "3–5 min",
        mode: "silencio",
        bullets: [
          "Pregunta: \"¿Avanzamos?\" o \"¿Querés que lo pongamos en marcha hoy?\"",
          "Silencio 8–12s. NO justificar ni hablar de más.",
        ],
      },
      {
        title: "3) Últimas objeciones (si aparecen)",
        timebox: "8–12 min",
        mode: "escuchar",
        bullets: [
          "Una objeción por vez. Reflejar → confirmar → responder corto.",
          "Si es precio: volver a valor/impacto y costo de no hacer nada.",
        ],
      },
      {
        title: "4) Aterrizaje operativo",
        timebox: "5–8 min",
        mode: "hablar",
        bullets: [
          "Fechas, responsables, materiales que deben entregar.",
          "Próxima reunión / kickoff.",
        ],
      },
      {
        title: "5) Cierre administrativo",
        timebox: "2–4 min",
        mode: "hablar",
        bullets: [
          "Confirmar forma de pago / factura / anticipo (si aplica).",
          "Enviar resumen escrito el mismo día.",
        ],
      },
    ],
    checklist: [
      {
        title: "Cierre (momento crítico)",
        items: [
          { id: "c1", text: "Hice recap en 30–60s y pedí confirmación (silencio 3–5s)." },
          { id: "c2", text: "Hice la pregunta de decisión directa." },
          { id: "c3", text: "Apliqué silencio 8–12s sin rescatar." },
        ],
      },
      {
        title: "Objeción final (si aparece)",
        items: [
          { id: "c4", text: "Reflejé la objeción y confirmé que es la principal." },
          { id: "c5", text: "Respondí corto, volví a preguntar y guardé silencio." },
        ],
      },
      {
        title: "Operativo + siguiente paso",
        items: [
          { id: "c6", text: "Acordé kickoff/primer hito con fecha y responsables." },
          { id: "c7", text: "Listé materiales que el cliente debe entregar." },
          { id: "c8", text: "Cerré cobro/anticipo y dejé resumen escrito pendiente." },
        ],
      },
    ],
  },
];

/** Estructura mínima por tipo de reunión para checklist (id del tab, label, items con id/label/sticky/resetOnNewSession). */
type MeetingTypeItem = {
  id: string;
  label: string;
  sticky?: boolean;
  /** default true si no está */
  resetOnNewSession?: boolean;
};
type MeetingTypeDef = { id: string; label: string; items: MeetingTypeItem[] };

const TYPE_ID_TO_KEY: Record<string, MeetingType> = {
  descubrimiento: "discovery",
  propuesta: "proposal",
  cierre: "closing",
};

function flattenChecklistItems(tpl: MeetingTemplate): MeetingTypeItem[] {
  const items: MeetingTypeItem[] = [];
  for (const sec of tpl.checklist) {
    for (const it of sec.items) {
      items.push({
        id: it.id,
        label: it.text,
        sticky: it.sticky,
        resetOnNewSession: it.resetOnNewSession !== false,
      });
    }
  }
  return items;
}

const MEETING_TYPES: MeetingTypeDef[] = [
  {
    id: "descubrimiento",
    label: "Descubrimiento & Autoridad",
    items: flattenChecklistItems(MEETING_TEMPLATES.find((t) => t.key === "discovery")!),
  },
  {
    id: "propuesta",
    label: "Revisión de propuesta",
    items: flattenChecklistItems(MEETING_TEMPLATES.find((t) => t.key === "proposal")!),
  },
  {
    id: "cierre",
    label: "Cierre",
    items: flattenChecklistItems(MEETING_TEMPLATES.find((t) => t.key === "closing")!),
  },
];

type TabKey = "descubrimiento" | "propuesta" | "cierre";

type ApiResp<T> = { data: T; error?: string | null };

type TabStorage = {
  checks: Record<string, boolean>;
  bitacora: { id: string; fecha: string; texto: string }[];
};

type EtapaRuta = { etapa: string; tiempo: string; regla: string };

const STORAGE_PREFIX = "reuniones";

function storageKey(leadId: string, tipo: TabKey): string {
  return `${STORAGE_PREFIX}:${leadId}:${tipo}`;
}

function loadTabStorage(leadId: string, tipo: TabKey): TabStorage {
  if (typeof window === "undefined") return { checks: {}, bitacora: [] };
  try {
    const raw = window.localStorage.getItem(storageKey(leadId, tipo));
    if (!raw) return { checks: {}, bitacora: [] };
    const parsed = JSON.parse(raw) as TabStorage;
    return {
      checks: parsed?.checks && typeof parsed.checks === "object" ? parsed.checks : {},
      bitacora: Array.isArray(parsed?.bitacora) ? parsed.bitacora : [],
    };
  } catch {
    return { checks: {}, bitacora: [] };
  }
}

function saveTabStorage(leadId: string, tipo: TabKey, data: TabStorage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(leadId, tipo), JSON.stringify(data));
  } catch (e) {
    console.error("Error guardando reuniones en localStorage:", e);
  }
}

type MeetingState = {
  checked: Record<string, boolean>;
  log: { at: string; text: string }[];
};

function meetingStorageKey(leadId: string, meeting: MeetingType): string {
  return `${STORAGE_PREFIX}:${leadId}:${meeting}`;
}

function loadMeetingState(leadId: string, meeting: MeetingType): MeetingState {
  if (typeof window === "undefined") return { checked: {}, log: [] };
  try {
    const raw = window.localStorage.getItem(meetingStorageKey(leadId, meeting));
    if (!raw) return { checked: {}, log: [] };
    const parsed = JSON.parse(raw) as {
      checked?: Record<string, boolean>;
      log?: Array<{ at?: string; text?: string; fecha?: string; texto?: string }>;
    };
    const checks = parsed?.checked && typeof parsed.checked === "object" ? parsed.checked : {};
    const logRaw = Array.isArray(parsed?.log) ? parsed.log : [];
    const log: { at: string; text: string }[] = logRaw.map((e) => ({
      at: e?.at ?? e?.fecha ?? new Date().toISOString(),
      text: e?.text ?? e?.texto ?? "",
    }));
    return { checked: checks, log };
  } catch {
    return { checked: {}, log: [] };
  }
}

function saveMeetingState(leadId: string, meeting: MeetingType, state: MeetingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(meetingStorageKey(leadId, meeting), JSON.stringify(state));
  } catch (e) {
    console.error("Error guardando meeting state en localStorage:", e);
  }
}

// ——— Checklist por tab (localStorage) ———
const CHECKLIST_STORAGE_PREFIX = "reuniones:checklist";

function getChecklistKey(leadId: string, meetingType: string): string {
  return `${CHECKLIST_STORAGE_PREFIX}:${leadId}:${meetingType}`;
}

type ChecklistItemId = { id: string };

function loadChecklistState(
  key: string,
  templateItems: ChecklistItemId[]
): Record<string, boolean> {
  if (typeof window === "undefined") return initCheckStateFromTemplate(templateItems);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return initCheckStateFromTemplate(templateItems);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return initCheckStateFromTemplate(templateItems);
    const result: Record<string, boolean> = {};
    for (const it of templateItems) {
      result[it.id] = parsed[it.id] === true;
    }
    return result;
  } catch {
    return initCheckStateFromTemplate(templateItems);
  }
}

function initCheckStateFromTemplate(templateItems: ChecklistItemId[]): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const it of templateItems) state[it.id] = false;
  return state;
}

function saveChecklistState(key: string, state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error("Error guardando checklist en localStorage:", e);
  }
}

// ——— Draft único por lead + tipo (localStorage): checkState + cierre + log ———
const DRAFT_STORAGE_PREFIX = "reuniones:draft";

function getDraftKey(leadId: string, activeTypeId: string): string {
  return `${DRAFT_STORAGE_PREFIX}:${leadId}:${activeTypeId}`;
}

type DraftState = {
  checkState: Record<string, boolean>;
  emotional_state: string;
  conviction: string;
  next_objective: string;
  log: { at: string; text: string }[];
};

function loadDraft(
  leadId: string,
  activeTypeId: string,
  templateItems: ChecklistItemId[]
): DraftState {
  if (typeof window === "undefined") {
    const checkState: Record<string, boolean> = {};
    for (const it of templateItems) checkState[it.id] = false;
    return { checkState, emotional_state: "", conviction: "", next_objective: "", log: [] };
  }
  try {
    const raw = window.localStorage.getItem(getDraftKey(leadId, activeTypeId));
    if (!raw) {
      const checkState: Record<string, boolean> = {};
      for (const it of templateItems) checkState[it.id] = false;
      return { checkState, emotional_state: "", conviction: "", next_objective: "", log: [] };
    }
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    const checkState: Record<string, boolean> = {};
    for (const it of templateItems) {
      checkState[it.id] = parsed?.checkState?.[it.id] === true;
    }
    const logRaw = Array.isArray(parsed?.log) ? parsed.log : [];
    const log = logRaw.map((e) => ({
      at: typeof e?.at === "string" ? e.at : new Date().toISOString(),
      text: typeof e?.text === "string" ? e.text : "",
    }));
    return {
      checkState,
      emotional_state: typeof parsed?.emotional_state === "string" ? parsed.emotional_state : "",
      conviction: typeof parsed?.conviction === "string" ? parsed.conviction : "",
      next_objective: typeof parsed?.next_objective === "string" ? parsed.next_objective : "",
      log,
    };
  } catch {
    const checkState: Record<string, boolean> = {};
    for (const it of templateItems) checkState[it.id] = false;
    return { checkState, emotional_state: "", conviction: "", next_objective: "", log: [] };
  }
}

function saveDraft(leadId: string, activeTypeId: string, draft: DraftState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getDraftKey(leadId, activeTypeId), JSON.stringify(draft));
  } catch (e) {
    console.error("Error guardando draft en localStorage:", e);
  }
}

// ——— Preferencias UI (acordeón Mapa de ruta / Checklist) por lead + tipo ———
const UI_PREFS_PREFIX = "reuniones:ui";

function getUiPrefsKey(leadId: string, activeTypeId: string): string {
  return `${UI_PREFS_PREFIX}:${leadId}:${activeTypeId}`;
}

type UiPrefs = { openRuta: boolean; openChecklist: boolean };

function loadUiPrefs(key: string): UiPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    if (parsed && typeof parsed.openRuta === "boolean" && typeof parsed.openChecklist === "boolean") {
      return { openRuta: parsed.openRuta, openChecklist: parsed.openChecklist };
    }
    return null;
  } catch {
    return null;
  }
}

function saveUiPrefs(key: string, prefs: UiPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(prefs));
  } catch (e) {
    console.error("Error guardando UI prefs en localStorage:", e);
  }
}

// ——— activeItemId (modo foco checklist) por lead + tipo ———
const FOCUS_STORAGE_PREFIX = "reuniones:focus";

function getFocusKey(leadId: string, meetingType: string): string {
  return `${FOCUS_STORAGE_PREFIX}:${leadId}:${meetingType}`;
}

function loadActiveItemId(leadId: string, meetingType: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getFocusKey(leadId, meetingType));
    if (!raw) return null;
    const s = String(raw).trim();
    return s.length ? s : null;
  } catch {
    return null;
  }
}

function saveActiveItemId(leadId: string, meetingType: string, id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(getFocusKey(leadId, meetingType), id);
    else window.localStorage.removeItem(getFocusKey(leadId, meetingType));
  } catch (e) {
    console.error("Error guardando activeItemId en localStorage:", e);
  }
}

// ——— Micro-notas rápidas por lead + tipo ———
type QuickNoteItem = { id: string; atISO: string; text: string };
const NOTES_STORAGE_PREFIX = "reuniones:notes";

function getNotesKey(leadId: string, meetingType: string): string {
  return `${NOTES_STORAGE_PREFIX}:${leadId}:${meetingType}`;
}

function loadQuickNotes(leadId: string, meetingType: string): QuickNoteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getNotesKey(leadId, meetingType));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e: unknown) => e && typeof e === "object" && "id" in e && "atISO" in e && "text" in e)
      .map((e: { id: string; atISO: string; text: string }) => ({
        id: String(e.id),
        atISO: String(e.atISO),
        text: String(e.text),
      }));
  } catch {
    return [];
  }
}

function saveQuickNotes(leadId: string, meetingType: string, notes: QuickNoteItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getNotesKey(leadId, meetingType), JSON.stringify(notes));
  } catch (e) {
    console.error("Error guardando notas en localStorage:", e);
  }
}

const MAPA_DESCUBRIMIENTO: EtapaRuta[] = [
  { etapa: "Apertura y rapport", tiempo: "2 min", regla: "Hablar (presentación breve)" },
  { etapa: "Objetivo de la reunión", tiempo: "1 min", regla: "Hablar" },
  { etapa: "Preguntas abiertas", tiempo: "10 min", regla: "Escuchar 80% / Hablar 20%" },
  { etapa: "Silencio cómodo", tiempo: "—", regla: "Silencio (dejar que reflexione)" },
  { etapa: "Cierre y próximos pasos", tiempo: "2 min", regla: "Hablar (resumir y acordar)" },
];

const MAPA_PROPUESTA: EtapaRuta[] = [
  { etapa: "Contexto de la propuesta", tiempo: "2 min", regla: "Hablar" },
  { etapa: "Presentación de la propuesta", tiempo: "5 min", regla: "Hablar" },
  { etapa: "Preguntas y objeciones", tiempo: "8 min", regla: "Escuchar 70% / Hablar 30%" },
  { etapa: "Silencio para revisar", tiempo: "—", regla: "Silencio" },
  { etapa: "Acuerdos y siguientes pasos", tiempo: "3 min", regla: "Hablar" },
];

const MAPA_CIERRE: EtapaRuta[] = [
  { etapa: "Repaso de lo acordado", tiempo: "2 min", regla: "Hablar" },
  { etapa: "Confirmación de cierre", tiempo: "3 min", regla: "Escuchar / Hablar" },
  { etapa: "Firma o compromiso", tiempo: "2 min", regla: "Hablar" },
  { etapa: "Despedida y seguimiento", tiempo: "1 min", regla: "Hablar" },
];

const CHECKLIST_DESCUBRIMIENTO: { id: string; label: string }[] = [
  { id: "d1", label: "Preparar preguntas abiertas sobre dolor/objetivo" },
  { id: "d2", label: "Confirmar que el lead tiene autoridad o es influyente" },
  { id: "d3", label: "Escuchar más de lo que hablo (80/20)" },
  { id: "d4", label: "Anotar frases clave y dolores mencionados" },
  { id: "d5", label: "Cerrar con próximo paso concreto" },
];

const CHECKLIST_PROPUESTA: { id: string; label: string }[] = [
  { id: "p1", label: "Enviar propuesta con anticipación" },
  { id: "p2", label: "Repasar puntos clave antes de la reunión" },
  { id: "p3", label: "Preparar respuestas a objeciones habituales" },
  { id: "p4", label: "Dejar tiempo para que lea y pregunte" },
  { id: "p5", label: "Acordar fecha de decisión o siguiente contacto" },
];

const CHECKLIST_CIERRE: { id: string; label: string }[] = [
  { id: "c1", label: "Confirmar que todos los decisores están de acuerdo" },
  { id: "c2", label: "Repasar condiciones y plazos" },
  { id: "c3", label: "Obtener firma o compromiso explícito" },
  { id: "c4", label: "Definir siguiente paso post-cierre" },
  { id: "c5", label: "Agradecer y cerrar en positivo" },
];

type LeadLite = {
  id: string;
  nombre?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  pipeline?: string | null;
  objetivo?: string | null;
  comercial_id?: string | null;
};

type LeadFull = LeadLite & {
  notas?: string | null;
  website?: string | null;
};

type ComercialLite = {
  id: string;
  nombre: string | null;
  email?: string | null;
};

/** Propuesta del lead (más reciente por created_at desc). */
type Proposal = {
  id: string;
  lead_id: string;
  created_at: string;
  title: string | null;
  file_name: string;
  signed_url: string | null;
  [key: string]: unknown;
};

type LeadDoc = {
  id: string;
  filename: string;
  signed_url: string | null;
  created_at: string | null;
};

type ClosingForm = {
  emotional_state: string;
  conviction: string;
  next_objective: string;
};

const EMOTIONAL_CHIPS = [
  { value: "positivo", label: "Positivo" },
  { value: "neutro", label: "Neutro" },
  { value: "negativo", label: "Negativo" },
] as const;

export default function ReunionesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = (searchParams.get("leadId") ?? "").trim();

  const [activeTab, setActiveTab] = useState<TabKey>("descubrimiento");

  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [lead, setLead] = useState<LeadFull | null>(null);

  const [comercialesMap, setComercialesMap] = useState<Map<string, string>>(new Map());

  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingLead, setLoadingLead] = useState(false);
  const [loadingComerciales, setLoadingComerciales] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tabChecks, setTabChecks] = useState<Record<string, boolean>>({});
  const [tabBitacora, setTabBitacora] = useState<{ id: string; fecha: string; texto: string }[]>([]);
  const [nuevaEntradaBitacora, setNuevaEntradaBitacora] = useState("");

  const [activeTypeId, setActiveTypeId] = useState<string>("descubrimiento");
  const [checkStateByType, setCheckStateByType] = useState<Record<string, Record<string, boolean>>>({});
  const [checklistSavedAt, setChecklistSavedAt] = useState<number | null>(null);
  const [meetingState, setMeetingState] = useState<MeetingState>({ checked: {}, log: [] });
  const [newLog, setNewLog] = useState("");

  const [proposal, setProposal] = useState<Proposal | null>(null);

  const [leadDocs, setLeadDocs] = useState<LeadDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [closingFormByType, setClosingFormByType] = useState<Record<string, ClosingForm>>({});

  const [openRuta, setOpenRuta] = useState(true);
  const [openChecklist, setOpenChecklist] = useState(true);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [quickNote, setQuickNote] = useState("");
  const [notes, setNotes] = useState<QuickNoteItem[]>([]);
  const [openNotePanel, setOpenNotePanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const mapPanelRef = useRef<HTMLDivElement>(null);
  const checklistPanelRef = useRef<HTMLDivElement>(null);

  const draftPayloadRef = useRef<DraftState | null>(null);
  const draftLeadIdRef = useRef<string>("");
  const draftTypeIdRef = useRef<string>("");
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DRAFT_DEBOUNCE_MS = 600;

  const activeMeeting = TYPE_ID_TO_KEY[activeTypeId] ?? "discovery";

  // Cargar draft (checkState + cierre + log) al cambiar leadId o activeTypeId
  useEffect(() => {
    if (!leadId) return;
    const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
    const templateItems = typeDef?.items ?? [];
    const draft = loadDraft(leadId, activeTypeId, templateItems);
    setCheckStateByType((prev) => ({ ...prev, [activeTypeId]: draft.checkState }));
    setClosingFormByType((prev) => ({
      ...prev,
      [activeTypeId]: {
        emotional_state: draft.emotional_state,
        conviction: draft.conviction,
        next_objective: draft.next_objective,
      },
    }));
    setMeetingState((prev) => ({ ...prev, log: draft.log }));
  }, [leadId, activeTypeId]);

  // Guardar draft con debounce; flush al desmontar
  useEffect(() => {
    if (!leadId) return;
    const payload: DraftState = {
      checkState: checkStateByType[activeTypeId] ?? {},
      emotional_state: closingFormByType[activeTypeId]?.emotional_state ?? "",
      conviction: closingFormByType[activeTypeId]?.conviction ?? "",
      next_objective: closingFormByType[activeTypeId]?.next_objective ?? "",
      log: meetingState.log ?? [],
    };
    draftPayloadRef.current = payload;
    draftLeadIdRef.current = leadId;
    draftTypeIdRef.current = activeTypeId;

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      saveDraft(leadId, activeTypeId, payload);
      draftSaveTimerRef.current = null;
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      const ld = draftLeadIdRef.current;
      const ty = draftTypeIdRef.current;
      const pl = draftPayloadRef.current;
      if (ld && ty && pl) saveDraft(ld, ty, pl);
    };
  }, [leadId, activeTypeId, checkStateByType[activeTypeId], closingFormByType[activeTypeId], meetingState.log]);

  // Ocultar "Guardado automático ✅" después de 2,5 s
  useEffect(() => {
    if (checklistSavedAt == null) return;
    const t = setTimeout(() => setChecklistSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [checklistSavedAt]);

  // Cargar preferencias UI (acordeón) al cambiar leadId o activeTypeId: localStorage o default mobile/desktop
  useEffect(() => {
    if (!leadId) return;
    const key = getUiPrefsKey(leadId, activeTypeId);
    const stored = loadUiPrefs(key);
    if (stored) {
      setOpenRuta(stored.openRuta);
      setOpenChecklist(stored.openChecklist);
    } else {
      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
      setOpenRuta(!isMobile);
      setOpenChecklist(!isMobile);
    }
  }, [leadId, activeTypeId]);

  // Guardar preferencias UI cuando cambian openRuta u openChecklist
  useEffect(() => {
    if (!leadId) return;
    saveUiPrefs(getUiPrefsKey(leadId, activeTypeId), { openRuta, openChecklist });
  }, [leadId, activeTypeId, openRuta, openChecklist]);

  // Detección mobile (max-width: 768px)
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)") : null;
    if (!mq) return;
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Cargar activeItemId y notas al cambiar leadId o activeTypeId
  useEffect(() => {
    if (!leadId) {
      setActiveItemId(null);
      setNotes([]);
      return;
    }
    const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
    const items = typeDef?.items ?? [];
    const storedId = loadActiveItemId(leadId, activeTypeId);
    const validId = storedId && items.some((it) => it.id === storedId) ? storedId : null;
    setActiveItemId(validId);
    setNotes(loadQuickNotes(leadId, activeTypeId));
  }, [leadId, activeTypeId]);

  // Guardar activeItemId cuando cambia (para modo foco)
  useEffect(() => {
    if (!leadId || activeItemId == null) return;
    saveActiveItemId(leadId, activeTypeId, activeItemId);
  }, [leadId, activeTypeId, activeItemId]);

  // Propuestas del lead: traer al montar/cambiar leadId; quedarse con la más reciente (list[0], API ordena por created_at desc)
  useEffect(() => {
    if (!leadId) return;

    fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/proposals`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { data?: Proposal[] | null }) => {
        const list = Array.isArray(json?.data) ? json.data : [];
        setProposal(list[0] ?? null);
      })
      .catch(() => setProposal(null));
  }, [leadId]);

  // Docs del lead: traer al montar/cambiar leadId
  useEffect(() => {
    let alive = true;

    async function loadDocs() {
      try {
        setDocsError(null);

        if (!leadId) {
          setLeadDocs([]);
          return;
        }

        setLoadingDocs(true);
        const res = await fetch(`/api/admin/leads/${leadId}/docs`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error ?? "Error cargando documentos");

        const arr = Array.isArray(json?.data) ? json.data : [];
        if (!alive) return;
        setLeadDocs(
          arr.map((d: { id?: unknown; filename?: unknown; signed_url?: unknown; created_at?: unknown }) => ({
            id: String(d.id),
            filename: String(d.filename ?? "Documento"),
            signed_url: String(d.signed_url ?? ""),
            created_at: d.created_at ? String(d.created_at) : null,
          }))
        );
      } catch (e: unknown) {
        if (!alive) return;
        setLeadDocs([]);
        setDocsError(e instanceof Error ? e.message : "Error cargando documentos");
      } finally {
        if (!alive) return;
        setLoadingDocs(false);
      }
    }

    loadDocs();
    return () => {
      alive = false;
    };
  }, [leadId]);

  function setClosingField(field: keyof ClosingForm, value: string) {
    setClosingFormByType((prev) => ({
      ...prev,
      [activeTypeId]: {
        ...(prev[activeTypeId] ?? { emotional_state: "", conviction: "", next_objective: "" }),
        [field]: value,
      },
    }));
  }

  // Cargar checks + bitácora desde localStorage cuando cambia leadId o activeTab
  useEffect(() => {
    if (!leadId) {
      setTabChecks({});
      setTabBitacora([]);
      return;
    }
    const stored = loadTabStorage(leadId, activeTab);
    setTabChecks(stored.checks);
    setTabBitacora(stored.bitacora);
  }, [leadId, activeTab]);

  // Guardar en localStorage cuando cambian checks o bitácora (solo si hay leadId). activeTab no en deps para no sobrescribir al cambiar de tab.
  useEffect(() => {
    if (!leadId) return;
    saveTabStorage(leadId, activeTab, { checks: tabChecks, bitacora: tabBitacora });
  }, [leadId, tabChecks, tabBitacora]);

  // 0) cargar comerciales (map id -> nombre)
  useEffect(() => {
    let alive = true;

    async function loadComerciales() {
      try {
        setLoadingComerciales(true);

        const res = await fetch("/api/admin/comerciales?limit=200", { cache: "no-store" });
        const json = (await res.json()) as ApiResp<any>;

        if (!alive) return;

        if (!res.ok) {
          // No cortamos la página si falla, solo dejamos el comercial en "—"
          console.error("Error cargando comerciales:", json?.error);
          setComercialesMap(new Map());
          return;
        }

        const rows = Array.isArray(json?.data) ? json.data : [];
        const map = new Map<string, string>();

        for (const r of rows as any[]) {
          const id = r?.id ? String(r.id) : "";
          if (!id) continue;
          const nombre = (r?.nombre ?? r?.name ?? "").toString().trim();
          if (nombre) map.set(id, nombre);
        }

        setComercialesMap(map);
      } catch (e) {
        console.error("Error cargando comerciales:", e);
        setComercialesMap(new Map());
      } finally {
        if (!alive) return;
        setLoadingComerciales(false);
      }
    }

    loadComerciales();
    return () => {
      alive = false;
    };
  }, []);

  // 1) cargar lista de leads (para selector)
  useEffect(() => {
    let alive = true;

    async function loadLeads() {
      try {
        setLoadingLeads(true);
        setError(null);

        const res = await fetch("/api/admin/leads?limit=200", { cache: "no-store" });
        const json = (await res.json()) as ApiResp<any>;

        if (!alive) return;

        if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");

        const rows = Array.isArray(json?.data) ? json.data : [];
        const lite: LeadLite[] = rows
          .filter((r: any) => r?.id)
          .map((r: any) => ({
            id: String(r.id),
            nombre: r?.nombre ?? null,
            contacto: r?.contacto ?? null,
            email: r?.email ?? null,
            telefono: r?.telefono ?? null,
            pipeline: r?.pipeline ?? null,
            objetivo: r?.objetivo ?? null,
            comercial_id: r?.comercial_id ?? null,
          }));

        setLeads(lite);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando leads");
        setLeads([]);
      } finally {
        if (!alive) return;
        setLoadingLeads(false);
      }
    }

    loadLeads();
    return () => {
      alive = false;
    };
  }, []);

  // 2) cargar detalle del lead seleccionado (leadId viene de la URL)
  useEffect(() => {
    let alive = true;

    async function loadLead() {
      if (!leadId) {
        setLead(null);
        return;
      }

      try {
        setLoadingLead(true);
        setError(null);

        const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}`, { cache: "no-store" });
        const json = (await res.json()) as ApiResp<any>;

        if (!alive) return;

        if (!res.ok) throw new Error(json?.error ?? "Error cargando lead");

        const raw = json?.data ?? null;
        const row = Array.isArray(raw) ? raw?.[0] ?? null : raw;

        if (!row?.id) {
          setLead(null);
          return;
        }

        const full: LeadFull = {
          id: String(row.id),
          nombre: row?.nombre ?? null,
          contacto: row?.contacto ?? null,
          email: row?.email ?? null,
          telefono: row?.telefono ?? null,
          pipeline: row?.pipeline ?? null,
          objetivo: row?.objetivo ?? null,
          notas: row?.notas ?? null,
          website: row?.website ?? null,
          comercial_id: row?.comercial_id ?? null,
        };

        setLead(full);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando lead");
        setLead(null);
      } finally {
        if (!alive) return;
        setLoadingLead(false);
      }
    }

    loadLead();
    return () => {
      alive = false;
    };
  }, [leadId]);

  const ctx = useMemo(() => {
    const comercialId = lead?.comercial_id ? String(lead.comercial_id) : null;
    const comercialNombre = comercialId ? comercialesMap.get(comercialId) ?? null : null;

    return {
      leadNombre: lead?.nombre?.trim() || "—",
      entidad: "—",
      pipeline: lead?.pipeline?.trim() || "—",
      comercial: comercialNombre || (loadingComerciales ? "Cargando…" : "—"),
      ultimaReunion: "—",

      iaResumen: "—",
      dolor: "—",
      objetivo: lead?.objetivo?.trim() || "—",
      servicios: "—",
      casosExito: "—",
      riesgos: "—",
      frases: "—",
      descripcion: lead?.notas?.trim() || "—",
      website: lead?.website?.trim() || "—",
    };
  }, [lead, comercialesMap, loadingComerciales]);

  function setLeadAndUrl(id: string) {
    const next = (id ?? "").trim();
    const url = next ? `/admin/reuniones?leadId=${encodeURIComponent(next)}` : "/admin/reuniones";
    router.push(url);
    router.refresh();
  }

  const tpl = MEETING_TEMPLATES.find((t) => t.key === activeMeeting)!;

  /** Estado de checks del tab activo (por itemId → boolean). */
  const checkState = checkStateByType[activeTypeId] ?? {};

  /** Toggle de un ítem del checklist; actualiza state (el debounce guarda en localStorage). */
  function toggleItem(id: string) {
    const current = checkStateByType[activeTypeId] ?? {};
    const nextState = { ...current, [id]: !current[id] };
    setCheckStateByType((prev) => ({ ...prev, [activeTypeId]: nextState }));
    setChecklistSavedAt(Date.now());
  }

  /** Reiniciar checklist: pone en false los items no sticky; sticky mantienen valor. El debounce guarda. */
  function reiniciarChecklist() {
    const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
    if (!typeDef) return;
    const current = checkStateByType[activeTypeId] ?? {};
    const nextState: Record<string, boolean> = {};
    for (const it of typeDef.items) {
      if (it.sticky === true) nextState[it.id] = current[it.id] ?? false;
      else if (it.resetOnNewSession === false) nextState[it.id] = current[it.id] ?? false;
      else nextState[it.id] = false;
    }
    setCheckStateByType((prev) => ({ ...prev, [activeTypeId]: nextState }));
    setChecklistSavedAt(Date.now());
  }

  /** Marca true solo los items no sticky (sticky mantienen valor actual). */
  function markAllNonSticky() {
    const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
    if (!typeDef) return;
    const current = checkStateByType[activeTypeId] ?? {};
    const nextState: Record<string, boolean> = {};
    for (const it of typeDef.items) {
      nextState[it.id] = it.sticky === true ? (current[it.id] ?? false) : true;
    }
    setCheckStateByType((prev) => ({ ...prev, [activeTypeId]: nextState }));
    setChecklistSavedAt(Date.now());
  }

  /** Pone en false solo los items no sticky (sticky mantienen valor actual). */
  function clearAllNonSticky() {
    const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
    if (!typeDef) return;
    const current = checkStateByType[activeTypeId] ?? {};
    const nextState: Record<string, boolean> = {};
    for (const it of typeDef.items) {
      nextState[it.id] = it.sticky === true ? (current[it.id] ?? false) : false;
    }
    setCheckStateByType((prev) => ({ ...prev, [activeTypeId]: nextState }));
    setChecklistSavedAt(Date.now());
  }

  function toggleCheck(id: string) {
    setMeetingState((prev) => ({
      ...prev,
      checked: { ...prev.checked, [id]: !prev.checked[id] },
    }));
  }

  function addLog() {
    const text = newLog.trim();
    if (!text) return;
    const at = new Date().toISOString();
    setMeetingState((prev) => ({ ...prev, log: [{ at, text }, ...prev.log] }));
    setNewLog("");
  }

  function toggleCheckTab(checkId: string) {
    setTabChecks((prev) => ({ ...prev, [checkId]: !prev[checkId] }));
  }

  function addBitacoraEntry() {
    const texto = nuevaEntradaBitacora?.trim();
    if (!texto) return;
    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fecha = new Date().toISOString();
    setTabBitacora((prev) => [{ id, fecha, texto }, ...prev]);
    setNuevaEntradaBitacora("");
  }

  const mapaByTab: Record<TabKey, EtapaRuta[]> = {
    descubrimiento: MAPA_DESCUBRIMIENTO,
    propuesta: MAPA_PROPUESTA,
    cierre: MAPA_CIERRE,
  };

  const checklistByTab: Record<TabKey, { id: string; label: string }[]> = {
    descubrimiento: CHECKLIST_DESCUBRIMIENTO,
    propuesta: CHECKLIST_PROPUESTA,
    cierre: CHECKLIST_CIERRE,
  };

  const tabBtnByTypeId = (typeId: string) => {
    const typeDef = MEETING_TYPES.find((t) => t.id === typeId);
    const label = typeDef?.label ?? typeId;
    const isOn = activeTypeId === typeId;
    return (
      <button
        type="button"
        key={typeId}
        onClick={() => setActiveTypeId(typeId)}
        className={[
          "px-4 py-2 text-sm font-semibold transition",
          isOn ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  const tabBtn = (key: TabKey, label: string) => {
    const isOn = activeTab === key;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(key)}
        className={[
          "px-4 py-2 text-sm font-semibold transition",
          isOn ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  const typeLabel = MEETING_TYPES.find((t) => t.id === activeTypeId)?.label ?? activeTypeId;

  return (
    <div className="px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">Reuniones</h1>
            {leadId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Reunión activa · {typeLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Guía operativa por tipo de reunión + bitácora + preparación.
          </p>
        </div>
      </div>

      {/* Selector lead */}
      <div className="mt-5 rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-slate-900">Lead</div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <select
              value={leadId}
              onChange={(e) => setLeadAndUrl(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm min-w-[320px]"
              disabled={loadingLeads}
            >
              <option value="">{loadingLeads ? "Cargando leads…" : "Seleccionar lead…"}</option>
              {leads.map((l) => {
                const label =
                  (l?.nombre?.trim() || l?.contacto?.trim() || l?.email?.trim() || "Sin nombre") +
                  ` · ${l.id.slice(0, 8)}`;
                return (
                  <option key={l.id} value={l.id}>
                    {label}
                  </option>
                );
              })}
            </select>

            {leadId ? (
              <button
                type="button"
                onClick={() => router.push(`/admin/leads/${encodeURIComponent(leadId)}`)}
                className="rounded-xl border bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Ver lead
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {/* BLOQUE SUPERIOR (antes de tabs) */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contexto del Lead */}
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Contexto</div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Lead" value={ctx.leadNombre} />
            <Row label="Iniciativa" value={ctx.entidad} />
            <Row label="Pipeline / Etapa" value={ctx.pipeline} />
            <Row label="Comercial" value={ctx.comercial} />
            <Row label="Última reunión" value={ctx.ultimaReunion} />
            <Row label="Website" value={ctx.website} />
          </div>
          {loadingLead ? <div className="mt-3 text-xs text-slate-500">Cargando detalle…</div> : null}
        </div>

        {/* Resumen IA (placeholder) */}
        <div className="rounded-2xl border bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Resumen inteligente (IA)</div>
            <span className="text-xs text-slate-400">placeholder</span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Card label="Objetivo (Lead)" value={ctx.objetivo} />
            <Card label="Descripción / Notas (Lead)" value={ctx.descripcion} />
            <Card label="Resumen" value={ctx.iaResumen} />
            <Card label="Dolor principal" value={ctx.dolor} />
            <Card label="Servicios a empujar" value={ctx.servicios} />
            <Card label="Casos de éxito" value={ctx.casosExito} />
            <Card label="Riesgos" value={ctx.riesgos} />
            <Card label="Frases clave" value={ctx.frases} />
          </div>
        </div>
      </div>

      {/* Material clave: propuesta comercial (solo lectura) — arriba de todo, antes de tabs */}
      <div className="mt-6 rounded-2xl border bg-white p-4">
        <div className="text-sm font-semibold text-slate-900 mb-1">
          Material clave para la reunión
        </div>
        {proposal ? (
          <div className="flex items-center gap-2 text-sm">
            <span>📄</span>
            <span className="font-medium">
              {proposal.title ?? "Propuesta comercial"}
            </span>
            {proposal.signed_url ? (
              <a
                href={proposal.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-blue-600 hover:underline text-sm"
              >
                Abrir PDF
              </a>
            ) : (
              <span className="ml-auto text-slate-400 text-sm">PDF no disponible</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Documentación / Propuestas (leadDocs) — sin vacío falso */}
      <div className="mt-6 rounded-2xl border bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Documentación</div>

        {!leadId ? (
          <div className="mt-2 text-sm text-slate-500">Seleccioná un lead.</div>
        ) : loadingDocs ? (
          <div className="mt-2 text-sm text-slate-500">Cargando documentos…</div>
        ) : docsError ? (
          <div className="mt-2 text-sm text-red-600">{docsError}</div>
        ) : leadDocs.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">Este lead no tiene documentos.</div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {leadDocs.map((d) => (
              <a
                key={d.id}
                href={d.signed_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                title={d.filename}
              >
                📄 <span className="truncate max-w-[240px]">{d.filename}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* TABS: solo títulos; cambian activeTypeId; label = MEETING_TYPES[].label */}
      <div className="mt-6 inline-flex overflow-hidden rounded-xl border bg-white">
        {MEETING_TYPES.map((t) => tabBtnByTypeId(t.id))}
      </div>

      {/* CONTENIDO por tab: objetivo + mapa + checklist + bitácora */}
      <div className="mt-4 space-y-6">
        {!leadId ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
            Seleccioná un lead para comenzar.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-600">Objetivo de esta reunión</div>
              <div className="mt-2 text-sm text-slate-800">{tpl.goal}</div>
            </div>

            <div ref={mapPanelRef} className="rounded-2xl border bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenRuta((v) => !v)}
                className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-50 transition"
                aria-expanded={openRuta}
              >
                <span className="text-sm font-semibold text-slate-900">
                  Mapa de ruta
                  <span className="ml-2 font-normal text-slate-500">
                    Etapas: {tpl.roadmap.length}
                  </span>
                </span>
                <span className="text-slate-500 text-lg leading-none" aria-hidden>
                  {openRuta ? "▾" : "▸"}
                </span>
              </button>
              {openRuta && (
                <div className="px-4 pb-4 pt-0 space-y-3">
                  {tpl.roadmap.map((r) => (
                    <div key={r.title} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900 text-sm">{r.title}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full border px-2 py-0.5 text-slate-700">{r.timebox}</span>
                          <span className="rounded-full border px-2 py-0.5 text-slate-700">
                            {r.mode === "hablar" ? "Hablar" : r.mode === "escuchar" ? "Escuchar" : "Silencio"}
                          </span>
                        </div>
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
                        {r.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div ref={checklistPanelRef} className="rounded-2xl border bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenChecklist((v) => !v)}
                className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-50 transition"
                aria-expanded={openChecklist}
              >
                <span className="text-sm font-semibold text-slate-900">
                  Checklist
                  <span className="ml-2 font-normal text-slate-500">
                    {(() => {
                      const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
                      const total = typeDef?.items.length ?? 0;
                      const done = total ? Object.keys(checkState).filter((id) => checkState[id]).length : 0;
                      return `${done}/${total}`;
                    })()}
                  </span>
                </span>
                <span className="text-slate-500 text-lg leading-none" aria-hidden>
                  {openChecklist ? "▾" : "▸"}
                </span>
              </button>
              {openChecklist && (
                <div className="px-4 pb-4 pt-0">
              {/* Mobile: modo foco (1 ítem). Desktop: lista completa + utilidades */}
              {isMobile ? (
                <>
                  {(() => {
                    const typeDef = MEETING_TYPES.find((t) => t.id === activeTypeId);
                    const items = typeDef?.items ?? [];
                    const firstPending = items.find((it) => !checkState[it.id]);
                    const allDone = items.length > 0 && items.every((it) => checkState[it.id]);
                    const currentFocusId =
                      activeItemId && items.some((it) => it.id === activeItemId)
                        ? activeItemId
                        : firstPending?.id ?? (allDone ? items[items.length - 1].id : items[0]?.id ?? null);
                    const currentIndex = currentFocusId ? items.findIndex((it) => it.id === currentFocusId) : 0;
                    const currentItem = currentFocusId ? items.find((it) => it.id === currentFocusId) : items[0];
                    const stepNum = currentIndex >= 0 ? currentIndex + 1 : 1;
                    const totalSteps = items.length;
                    const isDone = currentItem ? !!checkState[currentItem.id] : false;
                    const goNext = () => {
                      if (!currentFocusId) return;
                      const idx = items.findIndex((it) => it.id === currentFocusId);
                      if (idx < items.length - 1) setActiveItemId(items[idx + 1].id);
                      else setActiveItemId(items[items.length - 1].id);
                    };
                    const goPrev = () => {
                      if (!currentFocusId) return;
                      const idx = items.findIndex((it) => it.id === currentFocusId);
                      if (idx > 0) setActiveItemId(items[idx - 1].id);
                    };
                    const markDone = () => {
                      if (currentFocusId) {
                        toggleItem(currentFocusId);
                        if (stepNum < totalSteps) setActiveItemId(items[stepNum].id);
                      }
                    };
                    return (
                      <div className="space-y-4">
                        <p className="text-xs font-medium text-slate-500">
                          PASO {stepNum} de {totalSteps}
                        </p>
                        {currentItem ? (
                          <div
                            className={`rounded-xl border-2 p-4 ${
                              isDone
                                ? "border-emerald-500 bg-emerald-50/50"
                                : "border-blue-500 bg-blue-50/50"
                            }`}
                          >
                            <p className="text-sm font-medium text-slate-900">{currentItem.label}</p>
                            <p className="mt-2 text-xs text-slate-600">
                              Escuchá y confirmá antes de avanzar.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={markDone}
                                className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                              >
                                ✔ Hecho
                              </button>
                              <button
                                type="button"
                                onClick={goNext}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                ⏭ Siguiente
                              </button>
                              <button
                                type="button"
                                onClick={goPrev}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                ◀ Anterior
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No hay ítems en este checklist.</p>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
              {/* Arriba del checklist: Reiniciar + utilidades (marcar/limpiar no sticky) */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={reiniciarChecklist}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Reiniciar checklist
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={markAllNonSticky}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Marcar todo (no sticky)
                </button>
                <button
                  type="button"
                  onClick={clearAllNonSticky}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Limpiar todo (no sticky)
                </button>
              </div>

              <div className="mt-3 space-y-4">
                    {tpl.checklist.map((sec) => (
                      <div key={sec.title} className="rounded-xl border p-3">
                        <div className="text-xs font-semibold text-slate-600">{sec.title}</div>
                        <div className="mt-2 space-y-2">
                          {sec.items.map((it) => {
                            const checked = !!checkState[it.id];
                            return (
                              <label key={it.id} className="flex items-start gap-2 text-sm text-slate-800">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={() => toggleItem(it.id)}
                                />
                                <span className={checked ? "line-through text-slate-400" : ""}>{it.text}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {checklistSavedAt != null && (
                    <div className="mt-3 text-xs text-emerald-600" aria-live="polite">
                      Guardado automático ✅
                    </div>
                  )}
                </>
              )}
                </div>
              )}
            </div>

            {/* Notas rápidas (últimas 3) */}
            {leadId && (
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Notas rápidas</div>
                {notes.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Aún no hay notas. Usá el botón Nota abajo para agregar.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {notes.slice(0, 3).map((n) => (
                      <li key={n.id} className="rounded-xl border p-3 text-sm">
                        <span className="text-xs text-slate-500">
                          {new Date(n.atISO).toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        <p className="mt-1 text-slate-800 whitespace-pre-wrap">{n.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Cierre de reunión: emocional + convicción + objetivo + Guardar cierre */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Cierre de reunión</div>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Estado emocional</div>
                  <div className="flex flex-wrap gap-2">
                    {EMOTIONAL_CHIPS.map((chip) => {
                      const form = closingFormByType[activeTypeId] ?? { emotional_state: "", conviction: "", next_objective: "" };
                      const isOn = form.emotional_state === chip.value;
                      return (
                        <button
                          key={chip.value}
                          type="button"
                          onClick={() => setClosingField("emotional_state", chip.value)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            isOn ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Convicción (1–5)</label>
                  <select
                    value={(closingFormByType[activeTypeId] ?? { conviction: "" }).conviction}
                    onChange={(e) => setClosingField("conviction", e.target.value)}
                    className="mt-1 block w-full max-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Próximo objetivo</label>
                  <input
                    type="text"
                    value={(closingFormByType[activeTypeId] ?? { next_objective: "" }).next_objective}
                    onChange={(e) => setClosingField("next_objective", e.target.value)}
                    placeholder="Una línea: qué sigue"
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                <p className="text-xs text-slate-500">Se guarda automáticamente en este dispositivo.</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Bitácora</div>

              <div className="mt-3 space-y-2">
                <textarea
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  placeholder="Notas de esta reunión (lo que dijo, objeciones, frases textuales, próximos pasos)..."
                  className="w-full rounded-xl border px-3 py-2 text-sm min-h-[90px]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addLog}
                    disabled={!newLog.trim()}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Agregar a bitácora
                  </button>
                </div>

                {meetingState.log.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin registros todavía.</div>
                ) : (
                  <div className="space-y-2">
                    {meetingState.log.map((l, idx) => (
                      <div key={idx} className="rounded-xl border p-3">
                        <div className="text-xs text-slate-500">{new Date(l.at).toLocaleString("es-UY")}</div>
                        <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{l.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer mobile: Ruta / Checklist / Nota */}
      {isMobile && leadId ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur safe-area-pb">
          <button
            type="button"
            onClick={() => {
              setOpenRuta(true);
              mapPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="text-lg">🗺</span>
            Ruta
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenChecklist(true);
              checklistPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="text-lg">✅</span>
            Checklist
          </button>
          <button
            type="button"
            onClick={() => setOpenNotePanel(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="text-lg">📝</span>
            Nota
          </button>
        </div>
      ) : null}

      {/* Panel nota rápida (mobile, desde abajo) */}
      {openNotePanel && leadId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpenNotePanel(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="relative w-full max-w-md rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-lg md:rounded-2xl md:border">
            <div className="text-sm font-semibold text-slate-900 mb-3">Nota rápida</div>
            <textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Escribí tu nota..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[100px] text-slate-800 placeholder:text-slate-400"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenNotePanel(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = quickNote.trim();
                  if (!text) return;
                  const note: QuickNoteItem = {
                    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    atISO: new Date().toISOString(),
                    text,
                  };
                  const next = [note, ...notes];
                  setNotes(next);
                  saveQuickNotes(leadId, activeTypeId, next);
                  setQuickNote("");
                  setOpenNotePanel(false);
                }}
                disabled={!quickNote.trim()}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Guardar nota
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 truncate">{value || "—"}</div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}
