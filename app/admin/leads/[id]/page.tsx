"use client";

/*
  SMOKE TESTS (checklist):
  - [ ] Editar Facebook en Datos de iniciativa → Guardar → Refresh → Facebook persiste.
  - [ ] Editar 3 campos distintos de iniciativa → Guardar → Refresh → persisten.
  - [ ] Informe IA con "¿Ya es cliente de la Agencia?" = Sí/cliente → NO critica destructivamente; sugiere optimizaciones.
  - [ ] Informe IA con "¿Ya es cliente de la Agencia?" = No/vacío → puede marcar oportunidades/gaps.
  - [ ] Informe IA menciona redes cargadas (FB/IG/LinkedIn/Web) y usa contactos si existen.
*/

import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { ProposalServiceEditor } from "@/components/leads/ProposalServiceEditor";
import {
  draftFromProposalRow,
  ProposalServiceLineCard,
  type ProposalRowDraft,
} from "@/components/leads/ProposalServiceLineCard";
import { ProposalServicesTotalsSummary } from "@/components/leads/ProposalServicesTotalsSummary";
import { SuggestedServiceCard } from "@/components/leads/SuggestedServiceCard";
import { LeadDocsModal } from "@/components/leads/LeadDocsModal";
import { ProposalClientActions } from "@/components/leads/ProposalClientActions";
import { Tooltip } from "@/components/ui/Tooltip";
import { PageContainer } from "@/components/layout/PageContainer";
import Acciones from "@/components/acciones/Acciones";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { List, LayoutGrid, FileText, Search, Share2, Megaphone, Target, Compass, Star, Wrench, Lightbulb } from "lucide-react";
import { useSetBreadcrumbSegment } from "@/app/admin/context/BreadcrumbContext";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LABELS, fetchLabels, type Labels } from "@/lib/labels";
import { usePermissions } from "@/lib/rbac/usePermissions";
import { useModuleReadiness } from "@/lib/modules/useModuleReadiness";
import { ModuleReadinessPanel } from "@/components/modules/ModuleReadinessPanel";
import { getCommercialNextAction } from "@/lib/crm/getCommercialNextAction";
import { isCommercialStrategyApproved } from "@/lib/crm/commercialStrategyFlow";
import { isStepActual, isStepDone, type CommercialStep } from "@/lib/leads/computeCommercialStep";
import {
  getPresentationPrimaryUrl,
  isLikelyEmbedBlocked,
  PRESENTATION_POPUP_FEATURES,
  PRESENTATION_POPUP_NAME,
  isPdfUrl,
  isSameOriginPdfUrl,
  isTransientGammaExportPdfUrl,
} from "@/lib/leads/presentationUtils";
import { isOfficialPresentationDocumentUrl } from "@/lib/leads/commercialGammaDocuments";
import { persistGammaCompletedStatus } from "@/lib/leads/mirrorGammaPdfClient";
import { unitLabelEs, type AgencyLineSnapshot } from "@/lib/agencyServices/catalog";

type Empresa = {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  celular?: string | null;
  rut?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  web?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  contacto_nombre?: string | null;
  contacto_celular?: string | null;
  contacto_email?: string | null;
  etiquetas?: string | null;
  rubro_id?: string | null;
  rubros?: {
    id: string;
    nombre: string | null;
  } | null;
};

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
  estado?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // ✅ nuevos campos (DB: website text, objetivos/audiencia text, tamano text, oferta text)
  website?: string | null;
  objetivos?: string | null; // texto libre (antes era array)
  audiencia?: string | null; // texto libre (antes era array)
  tamano?: string | null; // single
  oferta?: string | null; // texto
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  linkedin_director?: string | null;
  meet_url?: string | null;
  ai_custom_prompt?: string | null; // Personalización IA

  rating?: number | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
  empresa_id?: string | null;
  empresas?: Empresa | null;
  comercial_id?: string | null;
  comercial?: { id: string; nombre: string } | null;
  score?: number | null;
  score_categoria?: string | null;
  proposal_draft_json?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_reviewed?: boolean | null;
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  strategy_approved_at?: string | null;
  commercial_strategy_json?: unknown;
};

type LeadApiResponse = {
  data?: Lead | null;
  error?: string | null;
};

type PatchPayload = Partial<
  Pick<
    Lead,
    | "nombre"
    | "contacto"
    | "telefono"
    | "email"
    | "origen"
    | "pipeline"
    | "notas"
    | "website"
    | "objetivos"
    | "audiencia"
    | "tamano"
    | "oferta"
    | "linkedin_empresa"
    | "linkedin_personal"
    | "meet_url"
    | "empresa_id"
    | "comercial_id"
    | "score"
    | "score_categoria"
  >
>;


type ApiResp<T> = {
  data?: T | null;
  error?: string | null;
};

// Fallback hardcodeado (si el fetch falla)
const OBJETIVOS_OPTS_FALLBACK = [
  "Networking y alianzas",
  "Nuevas oportunidades comerciales",
  "Visibilidad y posicionamiento",
  "Acceso a eventos y rondas",
  "Beneficios y partners",
  "Aprendizaje / capacitación",
];

const AUDIENCIA_OPTS_FALLBACK = [
  "B2B",
  "B2C",
  "Gobierno",
  "Educación",
  "Industria",
  "Servicios",
  "Retail/eCommerce",
];

const TAMANO_OPTS_FALLBACK = ["1–5", "6–20", "21–50", "51–200", "200+"];

type PicklistItem = {
  id: string;
  label: string;
  sort: number;
  is_active: boolean;
};

type LeadOptionsResponse = {
  data?: {
    membership_goals?: PicklistItem[];
    icp_targets?: PicklistItem[];
    company_size?: PicklistItem[];
  } | null;
  error?: string | null;
};

type EasyService = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  descripcion_corta: string | null;
  alcance_base: string | null;
  billing_type: string | null;
  precio_base: number | null;
  moneda: string | null;
  orden: number | null;
  unit?: string | null;
  default_quantity?: number | null;
  internal_notes?: string | null;
  is_active?: boolean;
  source?: "agency" | null;
};

type LeadServiceProposal = {
  id: string;
  lead_id: string;
  service_id: string | null;
  agency_service_id?: string | null;
  mes: number;
  precio: number | null;
  moneda: string | null;
  alcance_editado: string | null;
  observaciones: string | null;
  origen: string | null;
  orden: number | null;
  codigo?: string | null;
  nombre?: string | null;
  billing_type?: string | null;
  agency_snapshot?: AgencyLineSnapshot | null;
};

/** Tres líneas fijas para el vendedor: diagnóstico → por qué importa → resultado esperado. */
type SuggestedServiceExplanation = {
  diagnostico: string;
  implicancia: string;
  impacto: string;
};

type SuggestedService = {
  /** Resumen en una línea (observaciones, logs); la UI usa `explanation`. */
  reason: string;
  explanation: SuggestedServiceExplanation;
  priority: "alta" | "media" | "baja";
  service: EasyService;
};

type ServiceSalesCopy = {
  why: string;
  outcome: string;
  howToSell: string;
};

/** Columnas mensuales para la tabla de propuesta (nombres reales de meses). */
type ProposalMonthColumn = { key: string; label: string };

/** Fila de la grilla de propuesta por servicio (valores por mes para la tabla). */
type ProposalGridRow = {
  proposalId: string;
  serviceId: string;
  codigo: string | null;
  nombre: string | null;
  billingType: string | null;
  valuesByMonth: Record<string, number | "">;
  agencySnapshot?: AgencyLineSnapshot | null;
};

const MONTH_NAMES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getProposalMonthColumns(count: number, baseDate?: Date): ProposalMonthColumn[] {
  const base = baseDate ?? new Date();
  const startMonth = base.getMonth();
  const out: ProposalMonthColumn[] = [];
  for (let i = 0; i < count; i++) {
    const monthIndex = (startMonth + i) % 12;
    out.push({ key: `m${i + 1}`, label: MONTH_NAMES_ES[monthIndex] });
  }
  return out;
}

function getColumnTotal(rows: ProposalGridRow[], monthKey: string): number {
  return rows.reduce((sum, r) => {
    const v = r.valuesByMonth[monthKey];
    if (v === "" || v == null) return sum;
    const n = Number(v);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function norm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normArr(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const cleaned = v.map((x) => String(x).trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

// Convierte array a string (backward compatibility para objetivos/audiencia)
function arrayToString(v: unknown): string | null {
  if (Array.isArray(v)) {
    const cleaned = v.map((x) => String(x).trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(", ") : null;
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function bytes(n?: number | null) {
  if (!n || !Number.isFinite(n)) return null;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">
              {title}
            </div>
            <div className="text-xs text-slate-500">
              Historial de PDFs enviados.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function PillMulti({
  label,
  editing,
  value,
  options,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: string[] | null | undefined;
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const current = Array.isArray(value) ? value : [];

  const toggle = (opt: string) => {
    const has = current.includes(opt);
    const next = has ? current.filter((x) => x !== opt) : [...current, opt];
    onChange(next);
  };

  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>

      {editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = current.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
                aria-pressed={active}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {current.length ? (
            current.map((opt) => (
              <span
                key={opt}
                className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {opt}
              </span>
            ))
          ) : (
            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
              —
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tabs por rol (Opción A)
const LEAD_TABS = [
  { id: "datos", label: "Datos" },
  { id: "comercial", label: "Comercial" },
  { id: "tecnico", label: "Técnico" },
  { id: "consultor", label: "Consultor" },
  { id: "contactos", label: "Contactos" },
  { id: "acciones", label: "Acciones" },
] as const;

type LeadTabId = (typeof LEAD_TABS)[number]["id"];

/** Solo áreas de trabajo por etapa/rol; Contactos y Acciones van en la barra superior. */
const WORK_AREA_TAB_IDS: LeadTabId[] = ["datos", "comercial", "tecnico", "consultor"];

/** Configuración por paso: CTA y texto explícitos según si el contenido existe o no. */
const NEXT_STEP_CONFIG: Record<
  string,
  {
    label: string;
    tab: LeadTabId;
    section: string;
    /** Cuando el contenido de esta etapa NO existe: qué hacer. */
    generar: { description: string; cta: string; checklist: string[] };
    /** Cuando el contenido YA existe: revisar/abrir. */
    revisar?: { description: string; cta: string; checklist: string[] };
  }
> = {
  lead: {
    label: "Completar datos del lead",
    tab: "datos",
    section: "lead-data-base",
    generar: {
      description: "Completá los datos mínimos del lead (contacto, web, objetivos, audiencia) para poder avanzar con el análisis comercial.",
      cta: "Ir a completar datos",
      checklist: ["Verificar nombre, contacto y teléfono", "Completar web, objetivos y audiencia", "Confirmar vínculo con iniciativa si corresponde"],
    },
  },
  datos: {
    label: "Completar datos",
    tab: "datos",
    section: "lead-data-base",
    generar: {
      description: "Falta completar o validar información mínima del lead. Revisá datos clave (contacto, web, objetivos, audiencia) antes de continuar.",
      cta: "Revisar datos del lead",
      checklist: ["Verificar nombre, contacto y teléfono", "Completar web, objetivos y audiencia", "Confirmar vínculo con iniciativa si corresponde"],
    },
  },
  investigacion: {
    label: "Investigación / Análisis interno",
    tab: "comercial",
    section: "ia-report-block",
    generar: {
      description: "Aún no hay investigación digital ni análisis interno generado. Generá el análisis comercial con IA para construir la base necesaria antes del diagnóstico.",
      cta: "Generar análisis comercial",
      checklist: ["Ejecutar análisis IA del lead", "Revisar presencia digital y contexto", "Validar la base antes de generar el diagnóstico"],
    },
    revisar: {
      description: "Ya existe una base de investigación digital generada. Revisá el análisis interno del lead para validar la información antes de avanzar al diagnóstico comercial.",
      cta: "Revisar investigación",
      checklist: ["Abrir el informe en el tab Comercial", "Validar oportunidades y contexto", "Confirmar que la base está lista para el diagnóstico"],
    },
  },
  diagnostico: {
    label: "Diagnóstico comercial",
    tab: "comercial",
    section: "ia-report-block",
    generar: {
      description: "Generá el diagnóstico estratégico del lead (FODA, oportunidades, visión) desde el informe IA. Es el documento consultivo del Paso 2 del proceso comercial.",
      cta: "Generar diagnóstico",
      checklist: ["Generar módulos clave del informe IA", "Revisar oportunidades y riesgos detectados", "Validar que el diagnóstico sea coherente con el lead"],
    },
    revisar: {
      description: "El diagnóstico comercial ya fue generado. Revisalo y validalo antes de continuar con la visión estratégica.",
      cta: "Revisar diagnóstico",
      checklist: ["Abrir el documento de diagnóstico", "Validar oportunidades y riesgos", "Confirmar antes de pasar a estrategia"],
    },
  },
  acciones: {
    label: "Acciones definidas",
    tab: "comercial",
    section: "ia-report-block",
    generar: {
      description: "Revisá y consolidá las acciones recomendadas (72 horas y plan 30–90 días) en el informe. Definí prioridades antes de pasar a servicios.",
      cta: "Definir acciones",
      checklist: ["Revisar acciones de 72 horas", "Revisar plan de 30–90 días", "Confirmar prioridades antes de pasar a servicios"],
    },
    revisar: {
      description: "Las acciones ya están en el informe. Revisalas y confirmá prioridades antes de cargar servicios.",
      cta: "Revisar acciones",
      checklist: ["Abrir informe en tab Comercial", "Validar acciones 72h y plan 30–90 días", "Confirmar antes de servicios"],
    },
  },
  servicios: {
    label: "Estructura de servicios",
    tab: "consultor",
    section: "services-proposal",
    generar: {
      description: "Aún no hay estructura de servicios definida. Cargá y configurá los servicios EASY en la tabla económica (tab Consultor) para esta propuesta.",
      cta: "Ir a estructura de servicios",
      checklist: ["Revisar sugerencias de servicios EASY", "Agregar o quitar servicios relevantes", "Ajustar propuesta mensual por columnas"],
    },
    revisar: {
      description: "Ya hay servicios cargados en la propuesta. Revisá la estructura económica y confirmala antes de generar la propuesta comercial.",
      cta: "Revisar estructura económica",
      checklist: ["Abrir tab Consultor → Estructura de servicios", "Validar precios y alcance por mes", "Confirmar estructura antes de propuesta"],
    },
  },
  propuesta: {
    label: "Propuesta comercial",
    tab: "consultor",
    section: "proposal-export",
    generar: {
      description: "Estructurá la propuesta comercial (narrativa, fases, meses) y generá el material final. La estructura económica ya debe estar definida en el paso anterior.",
      cta: "Preparar propuesta comercial",
      checklist: ["Ordenar la propuesta por fases o meses", "Validar narrativa comercial y argumentos", "Generar presentación o PDF para el cliente"],
    },
    revisar: {
      description: "La propuesta ya tiene estructura. Revisala y generá el material final (Gamma o PDF) para presentar al cliente.",
      cta: "Revisar propuesta comercial",
      checklist: ["Abrir tab Consultor", "Revisar estructura y narrativa", "Generar presentación final"],
    },
  },
  presentacion: {
    label: "Presentación para el cliente",
    tab: "consultor",
    section: "proposal-export",
    generar: {
      description: "Generá o abrí la presentación final para compartir con el cliente. Confirmá que diagnóstico, estrategia y propuesta estén listos.",
      cta: "Generar presentación comercial",
      checklist: ["Revisar la estructura económica confirmada", "Generar la presentación final en Gamma o PDF", "Dejar el material listo para compartir"],
    },
    revisar: {
      description: "La presentación ya está lista. Abrila para compartir con el cliente o regenerala si hace falta.",
      cta: "Abrir presentación para el cliente",
      checklist: ["Abrir la vista de presentación", "Compartir enlace o PDF con el cliente"],
    },
  },
};

/** Devuelve la configuración de texto y CTA para el bloque "Siguiente paso recomendado" según si el contenido del paso existe. */
function getNextStepDisplay(
  stepId: string,
  flowSignals: Record<string, boolean>
): { label: string; description: string; cta: string; checklist: string[]; tab: LeadTabId; section: string } {
  const config = NEXT_STEP_CONFIG[stepId];
  if (!config) {
    return {
      label: stepId,
      description: `Completar paso: ${stepId}.`,
      cta: `Ir a ${stepId}`,
      checklist: [],
      tab: "datos",
      section: "lead-data-base",
    };
  }
  const contentExists = flowSignals[stepId] === true;
  const variant = contentExists && config.revisar ? config.revisar : config.generar;
  return {
    label: config.label,
    description: variant.description,
    cta: variant.cta,
    checklist: variant.checklist ?? config.generar.checklist,
    tab: config.tab,
    section: config.section,
  };
}

import { getLeadFlowSteps, getCurrentFlowStep, getLeadFlowSignals, LEAD_FLOW_STEP_IDS, type LeadFlowStep } from "@/lib/leads/leadFlow";
import { buildProposalExportPayload } from "@/lib/leads/proposalExportPayload";
import { getLeadHealth } from "@/lib/crm/leadHealth";
import { isLeadClosed, normalizePipelineForPolicy } from "@/lib/leads/leadStatusPolicy";

function getVisibleLeadTabs(role: string | null): ReadonlyArray<(typeof LEAD_TABS)[number]> {
  const r = role?.trim().toLowerCase() ?? null;
  if (!r) return LEAD_TABS.filter((t) => t.id === "datos" || t.id === "contactos");
  if (r === "admin") return [...LEAD_TABS];
  if (r === "consultor") return [...LEAD_TABS];
  if (r === "comercial") return LEAD_TABS.filter((t) => ["datos", "comercial", "contactos", "acciones"].includes(t.id));
  if (r === "tecnico") return LEAD_TABS.filter((t) => ["datos", "tecnico", "contactos", "acciones"].includes(t.id));
  if (r === "operador") return LEAD_TABS.filter((t) => ["datos", "comercial", "tecnico", "contactos", "acciones"].includes(t.id));
  if (r === "viewer") return LEAD_TABS.filter((t) => t.id === "datos" || t.id === "contactos");
  return LEAD_TABS.filter((t) => t.id === "datos" || t.id === "contactos");
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = (params as any)?.id as string | string[] | undefined;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [lead, setLead] = useState<Lead | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatchPayload>({});
  const [entityForm, setEntityForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
    website: "",
    instagram: "",
    facebook: "",
    rubro: "",
    celular: "",
    rut: "",
    ciudad: "",
    pais: "",
    contacto_celular: "",
    contacto_email: "",
    etiquetas: "",
  });
  const [empresaIdInput, setEmpresaIdInput] = useState("");
  const [comerciales, setComerciales] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loadingComerciales, setLoadingComerciales] = useState(false);

  // ✅ Documentación
  const [docsOpen, setDocsOpen] = useState(false);

  // ✅ Meet Asistido
  const [startingMeet, setStartingMeet] = useState(false);
  const [meetWindowOpened, setMeetWindowOpened] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const meetWinRef = useRef<Window | null>(null);

  // ✅ Contactos del lead
  const [contacts, setContacts] = useState<Array<{
    id: string;
    nombre: string;
    cargo: string;
    telefono: string | null;
    email: string | null;
    is_primary: boolean;
    notas: string | null;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<{ id: string; nombre: string; cargo: string; telefono: string | null; email: string | null; is_primary: boolean; notas: string | null } | null>(null);
  
  // ✅ Labels personalizados
  const [labels, setLabels] = useState<Labels>(DEFAULT_LABELS);

  // ✅ Propuesta Comercial Inteligente (tab Consultor)
  const [servicesCatalog, setServicesCatalog] = useState<EasyService[]>([]);
  const [leadServices, setLeadServices] = useState<LeadServiceProposal[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesSaving, setServicesSaving] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedMes, setSelectedMes] = useState(1);
  const [selectedUnitPrice, setSelectedUnitPrice] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("");
  const [selectedAlcance, setSelectedAlcance] = useState("");
  const [selectedObservaciones, setSelectedObservaciones] = useState("");
  /** Borradores por línea de propuesta (vista comercial + detalle técnico al expandir). */
  const [proposalRowDrafts, setProposalRowDrafts] = useState<Record<string, ProposalRowDraft>>({});
  const [proposalTechOpen, setProposalTechOpen] = useState<Record<string, boolean>>({});
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  /** Número de columnas mensuales en la tabla de propuesta (mín 1). */
  const [proposalMonthCount, setProposalMonthCount] = useState(6);
  /** Overrides por celda: proposalId -> monthKey -> value. Si no hay override, se usa row.mes/row.precio para la columna que coincida. */
  const [proposalGridOverrides, setProposalGridOverrides] = useState<Record<string, Record<string, number | "">>>({});
  const proposalDraftSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proposalRestoredFromLeadRef = useRef(false);
  const proposalSkipNextSaveRef = useRef(false);
  const [proposalConfirming, setProposalConfirming] = useState(false);
  const [proposalSentSaving, setProposalSentSaving] = useState(false);

  const [estadoComercialOpen, setEstadoComercialOpen] = useState(false);
  const [datosLeadOpen, setDatosLeadOpen] = useState(false);
  const [investigacionOpen, setInvestigacionOpen] = useState(false);
  const [linkedinInitBusy, setLinkedinInitBusy] = useState(false);
  const linkedInModule = useModuleReadiness("leads_linkedin_personal");

  // ✅ Permisos RBAC
  const { hasPermission, role, loading: permissionsLoading } = usePermissions();

  async function handleLinkedinModuleInit() {
    setLinkedinInitBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/modules/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "leads_linkedin_personal", seed: false }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        needsSqlInDashboard?: boolean;
        sql?: string;
        message?: string;
      };
      if (j.needsSqlInDashboard && typeof j.sql === "string") {
        try {
          await navigator.clipboard.writeText(j.sql);
          flash("SQL copiado. Pegalo en el SQL Editor de Supabase y recargá la página.");
        } catch {
          setError("No se pudo copiar el SQL al portapapeles.");
        }
        return;
      }
      if (!j.ok && j.message) {
        setError(j.message);
        return;
      }
      if (j.message) flash(j.message);
      await linkedInModule.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al inicializar");
    } finally {
      setLinkedinInitBusy(false);
    }
  }

  // ✅ Tabs (por rol)
  const [activeTab, setActiveTab] = useState<LeadTabId>("datos");
  const visibleTabs = useMemo(() => getVisibleLeadTabs(role), [role]);
  const visibleTabIds = useMemo(() => visibleTabs.map((t) => t.id), [visibleTabs]);
  /** Tabs que se muestran en la barra inferior (solo áreas de trabajo); Contactos y Acciones están en la cabecera. */
  const workAreaTabs = useMemo(
    () => visibleTabs.filter((t) => WORK_AREA_TAB_IDS.includes(t.id)),
    [visibleTabs]
  );
  useEffect(() => {
    if (!visibleTabIds.includes(activeTab)) setActiveTab("datos");
  }, [visibleTabIds, activeTab]);

  // Sincronizar tab/section desde URL (?tab=consultor&section=services-proposal)
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as LeadTabId | null;
  const sectionFromUrl = searchParams.get("section");
  useEffect(() => {
    if (tabFromUrl && visibleTabIds.includes(tabFromUrl)) setActiveTab(tabFromUrl);
  }, [tabFromUrl, visibleTabIds]);
  useEffect(() => {
    if (!sectionFromUrl || !activeTab) return;
    const t = setTimeout(() => {
      const el = document.getElementById(sectionFromUrl);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        if (sectionFromUrl === "ia-report-block") {
          const details = el instanceof HTMLDetailsElement ? el : el.querySelector("details");
          if (details instanceof HTMLDetailsElement) details.setAttribute("open", "open");
        }
      }
    }, 200);
    return () => clearTimeout(t);
  }, [sectionFromUrl, activeTab]);

  // Perfiles de IA permitidos por rol (solo frontend; backend no tocado)
  const allowedProfiles = useMemo((): Array<"comercial" | "tecnico"> => {
    const r = role?.trim().toLowerCase() ?? null;
    if (r === "admin" || r === "consultor" || r === "operador") return ["comercial", "tecnico"];
    if (r === "comercial") return ["comercial"];
    if (r === "tecnico") return ["tecnico"];
    return [];
  }, [role]);

  /** Señales de presentación lista (Gamma/PDF). Se puede conectar luego desde AiLeadReport con callback. */
  const [presentationSignals, setPresentationSignals] = useState<{
    gammaUrl?: string | null;
    pdfUrl?: string | null;
  }>({});

  /** Generación de documentos comerciales (Diagnóstico, Visión, Propuesta). */
  const [commercialDocLoading, setCommercialDocLoading] = useState<"diagnostic" | "strategy" | "proposal" | null>(null);
  const [commercialDocError, setCommercialDocError] = useState<string | null>(null);
  /** URLs de documentos generados (diagnostic, strategy, proposal, presentation). presentation es opcional; si no existe se usa proposal como documento final. */
  const [commercialDocUrls, setCommercialDocUrls] = useState<{ diagnostic: string | null; strategy: string | null; proposal: string | null; presentation: string | null }>({
    diagnostic: null,
    strategy: null,
    proposal: null,
    presentation: null,
  });
  /** Historial de versiones por tipo (lead_documents); la UI sigue usando solo URLs vigentes. */
  const [documentVersionSummaries, setDocumentVersionSummaries] = useState<
    { type: string; version_number: number; is_current: boolean; created_at: string; status: string | null }[]
  >([]);
  /** Feedback "Copiado" en botones Copiar (informe / visión). */
  const [copiedWhich, setCopiedWhich] = useState<"informe" | "informe-paso46" | "vision" | null>(null);
  /** Mostrar/ocultar contenido del informe comercial en la pestaña Consultor (por defecto visible, se puede colapsar). */
  const [showCommercialReport, setShowCommercialReport] = useState(true);
  /** Mostrar/ocultar contenido de visión estratégica en la pestaña Consultor (por defecto visible, se puede colapsar). */
  const [showStrategicVision, setShowStrategicVision] = useState(true);

  /** Secciones del informe comercial (TAB:xxx) para render con iconos. */
  const commercialReportSections = useMemo(() => {
    const raw = (lead as { ai_report?: string | null })?.ai_report;
    if (typeof raw !== "string" || !raw.trim()) return { intro: "", sections: [] as { id: string; label: string; Icon: React.ComponentType<{ className?: string }>; content: string }[] };
    const TAB_MAP: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
      INVESTIGACION_DIGITAL: { label: "Investigación digital", Icon: Search },
      REDES_SOCIALES: { label: "Redes sociales", Icon: Share2 },
      PAUTA_PUBLICITARIA: { label: "Pauta publicitaria", Icon: Megaphone },
      POSICIONAMIENTO: { label: "Posicionamiento", Icon: Target },
      NORTH_STAR_METRIC: { label: "North Star Metric", Icon: Compass },
      north_star_metric: { label: "North Star Metric", Icon: Compass },
      PRODUCTO_SERVICIO_ESTRELLA: { label: "Producto / servicio estrella", Icon: Star },
      producto_servicio_estrella: { label: "Producto / servicio estrella", Icon: Star },
      AUDITORIA_TECNICA_BASICA: { label: "Auditoría técnica básica", Icon: Wrench },
      auditoria_tecnica_basica: { label: "Auditoría técnica básica", Icon: Wrench },
      VISION_ESTRATEGICA: { label: "Visión estratégica", Icon: Lightbulb },
      vision_estrategica: { label: "Visión estratégica", Icon: Lightbulb },
    };
    const parts = raw.split(/\n###\s*TAB:([^\n]+)\n?/i);
    let intro = parts[0]?.trim() ?? "";
    const sections: { id: string; label: string; Icon: React.ComponentType<{ className?: string }>; content: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const name = (parts[i] ?? "").trim();
      const content = (parts[i + 1] ?? "").trim();
      const key = name.toUpperCase().replace(/-/g, "_");
      const config = TAB_MAP[key] ?? TAB_MAP[name] ?? { label: name.replace(/_/g, " "), Icon: FileText };
      sections.push({ id: name, label: config.label, Icon: config.Icon, content });
    }
    if (sections.length === 0 && intro) {
      sections.push({ id: "content", label: "Contenido", Icon: FileText, content: intro });
      intro = "";
    }
    return { intro, sections };
  }, [lead]);

  /** Texto de visión estratégica: sección TAB:vision_estrategica del ai_report (misma fuente que el informe). */
  const strategicVisionText = useMemo(() => {
    const { sections } = commercialReportSections;
    const vision = sections.find((s) => s.id === "vision_estrategica" || s.label === "Visión estratégica");
    return vision?.content?.trim() ?? "";
  }, [commercialReportSections]);

  const hasStrategicVisionText = strategicVisionText.length > 0;

  const documentVersionHistoryByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of documentVersionSummaries) {
      const t = (v.type ?? "").trim();
      if (!t) continue;
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [documentVersionSummaries]);

  const hasMultipleDocumentVersions = useMemo(
    () => [...documentVersionHistoryByType.values()].some((n) => n > 1),
    [documentVersionHistoryByType]
  );

  useEffect(() => {
    if (!copiedWhich) return;
    const t = setTimeout(() => setCopiedWhich(null), 2000);
    return () => clearTimeout(t);
  }, [copiedWhich]);

  /** Pasos del flujo y paso actual (recalculan con lead, leadServices, proposal_confirmed_at, presentationSignals). */
  const flowSteps = useMemo(
    () => getLeadFlowSteps(lead ?? null, leadServices, presentationSignals, commercialDocUrls),
    [lead, leadServices, presentationSignals, commercialDocUrls]
  );
  const currentFlowStep = useMemo(() => getCurrentFlowStep(flowSteps), [flowSteps]);
  const flowSignals = useMemo(
    () => getLeadFlowSignals(lead ?? null, leadServices, presentationSignals, commercialDocUrls),
    [lead, leadServices, presentationSignals, commercialDocUrls]
  );

  /** Material de presentación reconocido por el CRM solo si está archivado (no Gamma efímera / solo web). */
  const hasOfficialArchivedPresentation = useMemo(() => {
    const sig = presentationSignals?.pdfUrl?.trim();
    if (sig && !isTransientGammaExportPdfUrl(sig) && isOfficialPresentationDocumentUrl(sig)) return true;
    const pres = commercialDocUrls.presentation?.trim();
    return Boolean(pres && isOfficialPresentationDocumentUrl(pres));
  }, [presentationSignals?.pdfUrl, commercialDocUrls.presentation]);
  /** Estación activa del flujo = foco de “siguiente paso” (sin retroceder a etapas ya superadas). */
  const displayStepId = useMemo(() => currentFlowStep?.id ?? null, [currentFlowStep]);
  const recommendedTab = displayStepId ? (NEXT_STEP_CONFIG[displayStepId]?.tab ?? null) : null;
  const recommendedSection = displayStepId ? (NEXT_STEP_CONFIG[displayStepId]?.section ?? null) : null;

  /** Payload único de propuesta económica (fuente de verdad para PDF/Gamma/texto/vista cliente). */
  const proposalExportPayload = useMemo(
    () =>
      buildProposalExportPayload({
        lead: lead ?? null,
        leadServices,
        narrative: undefined,
      }),
    [lead, leadServices]
  );

  /** Cargar documentos desde API (DB): solo URLs oficiales persistidas. */
  const loadCommercialDocuments = useCallback(() => {
    if (!id?.trim() || typeof window === "undefined") return;
    fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (data: {
          ok?: boolean;
          documents?: { diagnostic?: string; strategy?: string; proposal?: string; presentation?: string };
          versionSummaries?: {
            type?: string;
            version_number?: number;
            is_current?: boolean;
            created_at?: string;
            status?: string | null;
          }[];
        }) => {
          if (data?.ok && data.documents) {
            setCommercialDocUrls({
              diagnostic: data.documents.diagnostic ?? null,
              strategy: data.documents.strategy ?? null,
              proposal: data.documents.proposal ?? null,
              presentation: data.documents.presentation ?? null,
            });
          }
          const vs = data?.versionSummaries;
          if (data?.ok && Array.isArray(vs)) {
            setDocumentVersionSummaries(
              vs.map((row) => ({
                type: typeof row.type === "string" ? row.type : "",
                version_number: typeof row.version_number === "number" ? row.version_number : 1,
                is_current: row.is_current === true,
                created_at: typeof row.created_at === "string" ? row.created_at : "",
                status: row.status ?? null,
              }))
            );
          } else if (data?.ok) {
            setDocumentVersionSummaries([]);
          }
        }
      )
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    loadCommercialDocuments();
  }, [loadCommercialDocuments]);

  /** Persistir documento en DB y actualizar estado local. */
  const persistCommercialDocUrl = useCallback(
    async (docType: "diagnostic" | "strategy" | "proposal", url: string, generationId: string | null) => {
      if (!id) return;
      try {
        await fetch(`/api/admin/leads/${id}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: docType, url, generationId }),
        });
      } catch {
        // ignorar; estado local se actualiza igual
      }
      setCommercialDocUrls((prev) => ({ ...prev, [docType]: url }));
    },
    [id]
  );

  /** Generar documento comercial (Diagnóstico, Visión Estratégica o Propuesta) vía Gamma y abrir cuando esté listo. */
  const generateCommercialDoc = useCallback(
    async (docType: "diagnostic" | "strategy" | "proposal") => {
      if (!id?.trim()) return;
      setCommercialDocError(null);
      setCommercialDocLoading(docType);
      try {
        const endpoint =
          docType === "diagnostic"
            ? `/api/admin/leads/${id}/gamma-diagnostic`
            : docType === "strategy"
              ? `/api/admin/leads/${id}/gamma-strategy`
              : `/api/admin/leads/${id}/gamma-proposal`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: docType === "proposal" ? JSON.stringify({ profile: "comercial" }) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string })?.error ?? "Error generando documento");
        const generationId = typeof (json as { generationId?: string })?.generationId === "string" ? (json as { generationId: string }).generationId : null;
        if (!generationId) {
          if (typeof console !== "undefined" && console.error) {
            console.error("[generateCommercialDoc] Respuesta sin generationId", json);
          }
          throw new Error("No se pudo iniciar la generación del documento.");
        }
        let completed = false;
        for (let i = 0; i < 45; i++) {
          const statusRes = await fetch(
            `/api/admin/leads/${id}/gamma-proposal/status?generationId=${encodeURIComponent(generationId)}`
          );
          const statusJson = await statusRes.json().catch(() => ({}));
          if (statusJson?.status === "completed") {
            completed = true;
            const persisted = await persistGammaCompletedStatus(
              id.trim(),
              docType,
              generationId,
              {
                pdfUrl: statusJson?.pdfUrl ?? null,
                gammaUrl: statusJson?.gammaUrl ?? null,
              }
            );
            if (persisted.error) {
              setCommercialDocError(persisted.error);
            } else if (persisted.pendingMessage) {
              setCommercialDocError(persisted.pendingMessage);
            } else {
              setCommercialDocError(null);
            }
            if (persisted.crmArchivedUrl) {
              setCommercialDocUrls((prev) => ({ ...prev, [docType]: persisted.crmArchivedUrl! }));
            }
            loadCommercialDocuments();
            const openUrl = persisted.crmArchivedUrl || persisted.openUrl;
            if (openUrl) window.open(openUrl, "_blank");
            break;
          }
          if (statusJson?.status === "failed") throw new Error("Gamma no pudo completar el documento.");
          await new Promise((r) => setTimeout(r, 4000));
        }
        if (!completed) setCommercialDocError("Gamma sigue procesando. Podés revisar el estado en unos minutos.");
      } catch (e) {
        setCommercialDocError(e instanceof Error ? e.message : "Error generando documento");
      } finally {
        setCommercialDocLoading(null);
      }
    },
    [id, persistCommercialDocUrl, loadCommercialDocuments]
  );

  const hasDiagnosticGenerated = Boolean(commercialDocUrls.diagnostic);
  const hasStrategyGenerated = useMemo(
    () =>
      isCommercialStrategyApproved(lead, commercialDocUrls) || Boolean(commercialDocUrls.strategy?.trim()),
    [lead, commercialDocUrls]
  );
  const hasProposalGenerated = Boolean(commercialDocUrls.proposal);
  const allDocsGenerated = hasDiagnosticGenerated && hasStrategyGenerated && hasProposalGenerated;

  /** Paso 1 completado: existe análisis interno IA (insumo del diagnóstico). */
  const aiReport = (lead as any)?.ai_report;
  const hasAnalysisInternal = Boolean(aiReport && String(aiReport).trim().length > 0);
  /** Paso 4 completado: estructura de servicios/table económica definida o confirmada. */
  const hasStructureReady = Boolean(
    (lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at ||
    ((leadServices?.length ?? 0) > 0 && ((proposalExportPayload?.monthlyTable?.rows?.length ?? 0) > 0))
  );

  /** Paso comercial 1–6, CTA y copy alineados con LEADS87 (getCommercialNextAction). */
  const commercialNext = useMemo(
    () =>
      getCommercialNextAction({
        lead: lead ?? null,
        documents: commercialDocUrls,
        structureReady: hasStructureReady,
        leadServicesOrCount: leadServices,
        presentationSignals,
      }),
    [lead, commercialDocUrls, hasStructureReady, leadServices, presentationSignals]
  );

  const currentStep: CommercialStep = commercialNext.currentStep;
  const commercialStepState = commercialNext.commercialStepState;
  const step6Done =
    commercialStepState === "presentation_ready" || commercialStepState === "closing";

  const nextStepConfig = useMemo(
    () => ({
      title: commercialNext.blockTitle,
      description: commercialNext.blockDescription,
      ctaLabel: commercialNext.primaryCtaLabel,
    }),
    [commercialNext]
  );

  /** Bloque de contexto del proceso comercial para section=... (orientación al usuario). */
  const processStepContext = useMemo(() => {
    if (activeTab === "consultor" && sectionFromUrl === "proposal-export") {
      if (currentStep >= 6) {
        return {
          title: "Paso 6 — Presentación comercial",
          description:
            "Generá y archivá la presentación en LEADS87 o revisá el material ya listo; luego avanzá a cierre y seguimiento.",
          nextStep: "Cierre y seguimiento",
        };
      }
      return {
        title: "Paso 5 — Propuesta comercial",
        description: "Aquí revisás la propuesta integral, validás la narrativa y preparás la salida final para el cliente.",
        nextStep: "Cierre del proceso",
      };
    }
    if (activeTab === "consultor" && sectionFromUrl === "services-proposal") {
      return {
        title: "Paso 4 — Estructura de servicios",
        description: "Definí y confirmá la base económica de la propuesta.",
        nextStep: "Paso 5 — Propuesta comercial",
      };
    }
    if (activeTab === "comercial" && sectionFromUrl === "ia-report-block") {
      if (currentStep >= 4) {
        return {
          title: `Paso ${currentStep} — ${commercialNext.blockTitle}`,
          description: commercialNext.blockDescription,
          nextStep:
            currentStep === 4
              ? "Paso 5 — Propuesta comercial"
              : currentStep === 5
                ? "Paso 6 — Presentación comercial (LEADS87)"
                : "Cierre y seguimiento",
        };
      }
      const step = currentStep <= 1 ? 1 : currentStep === 2 ? 2 : 3;
      const config: Record<number, { title: string; description: string; nextStep: string }> = {
        1: {
          title: "Paso 1 — Análisis del lead",
          description: "Generá el análisis interno con IA para detectar oportunidades y preparar la base del diagnóstico comercial.",
          nextStep: "Paso 2 — Diagnóstico comercial",
        },
        2: {
          title: "Paso 2 — Diagnóstico comercial",
          description: "El análisis ya está listo. Aquí generás el documento consultivo del diagnóstico para presentar al lead.",
          nextStep: "Paso 3 — Estrategia de crecimiento",
        },
        3: {
          title: "Paso 3 — Estrategia de crecimiento",
          description: "Generá la visión estratégica que conecta el diagnóstico con el plan de crecimiento.",
          nextStep: "Paso 4 — Estructura de servicios",
        },
      };
      return config[step];
    }
    return null;
  }, [activeTab, sectionFromUrl, currentStep, commercialNext]);

  const presentationPrimaryUrl = useMemo(() => {
    const raw = getPresentationPrimaryUrl(commercialDocUrls);
    if (!raw?.trim()) return null;
    return isOfficialPresentationDocumentUrl(raw) ? raw : null;
  }, [commercialDocUrls]);
  const presentationEmbedBlocked = useMemo(
    () => isLikelyEmbedBlocked(presentationPrimaryUrl),
    [presentationPrimaryUrl]
  );

  // ✅ Usuario actual (app_user.id, comercial_id cuando la API lo exponga)
  const [currentAppUserId, setCurrentAppUserId] = useState<string | null>(null);
  const [currentComercialId, setCurrentComercialId] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { app_user?: { id?: string; comercial_id?: string | null } }) => {
        setCurrentAppUserId(j?.app_user?.id ?? null);
        setCurrentComercialId(j?.app_user?.comercial_id ?? null);
      })
      .catch(() => {
        setCurrentAppUserId(null);
        setCurrentComercialId(null);
      });
  }, []);

  async function loadLeadServices() {
    if (!id) return;
    const res = await fetch(`/api/admin/leads/${id}/services`);
    const json = await res.json();
    if (json?.ok && Array.isArray(json.services)) setLeadServices(json.services);
  }

  useEffect(() => {
    const m: Record<string, ProposalRowDraft> = {};
    for (const r of leadServices) {
      m[r.id] = draftFromProposalRow(r);
    }
    setProposalRowDrafts(m);
    setProposalTechOpen((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!leadServices.some((x) => x.id === k)) delete next[k];
      }
      return next;
    });
  }, [leadServices]);

  // Cargar catálogo y servicios del lead cuando se abre el tab Consultor
  useEffect(() => {
    if (activeTab !== "consultor" || !id) return;
    let cancelled = false;
    setServicesLoading(true);
    setServicesError("");
    (async () => {
      try {
        const catRes = await fetch("/api/admin/services");
        const catJson = await catRes.json();
        if (cancelled) return;
        if (!catRes.ok || !catJson?.ok) {
          setServicesError(catJson?.error ?? "Error al cargar catálogo");
          return;
        }
        setServicesCatalog(catJson.services ?? []);
        await loadLeadServices();
      } catch (e) {
        if (!cancelled) setServicesError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, id]);

  /** Al cambiar de lead, permitir restaurar draft de nuevo. */
  useEffect(() => {
    proposalRestoredFromLeadRef.current = false;
  }, [id]);

  /** Restaurar draft desde lead al cargar (una vez por lead + leadServices). */
  useEffect(() => {
    const raw = (lead as { proposal_draft_json?: string | null } | undefined)?.proposal_draft_json;
    if (!raw?.trim() || !leadServices.length) return;
    if (proposalRestoredFromLeadRef.current) return;
    try {
      const draft = JSON.parse(raw) as { months?: { key: string; label?: string }[]; rows?: { proposalId: string; valuesByMonth: Record<string, number | ""> }[] };
      const months = Array.isArray(draft.months) ? draft.months : [];
      const rows = Array.isArray(draft.rows) ? draft.rows : [];
      const validIds = new Set(leadServices.map((r) => r.id));
      if (months.length > 0) setProposalMonthCount(Math.max(1, Math.min(24, months.length)));
      const overrides: Record<string, Record<string, number | "">> = {};
      for (const row of rows) {
        if (row.proposalId && validIds.has(row.proposalId) && row.valuesByMonth && typeof row.valuesByMonth === "object") {
          overrides[row.proposalId] = { ...row.valuesByMonth };
        }
      }
      if (Object.keys(overrides).length > 0) setProposalGridOverrides(overrides);
      proposalRestoredFromLeadRef.current = true;
      proposalSkipNextSaveRef.current = true;
    } catch {
      // ignore parse error
    }
  }, [lead, leadServices]);

  /** Columnas mensuales para la tabla de propuesta (mes actual + siguientes). */
  const proposalMonthColumns = useMemo(
    () => getProposalMonthColumns(Math.max(1, proposalMonthCount)),
    [proposalMonthCount]
  );

  /** Filas de la grilla: un servicio por fila, valores por mes (override o row.mes/precio). */
  const proposalGridRows = useMemo((): ProposalGridRow[] => {
    return leadServices.map((row) => {
      const valuesByMonth: Record<string, number | ""> = {};
      const overrides = proposalGridOverrides[row.id];
      const sid = (row.agency_service_id ?? row.service_id ?? "").trim();
      proposalMonthColumns.forEach((col, idx) => {
        const oneBased = idx + 1;
        if (overrides && col.key in overrides) {
          valuesByMonth[col.key] = overrides[col.key];
        } else if (row.mes === oneBased) {
          valuesByMonth[col.key] = row.precio != null ? row.precio : "";
        } else {
          valuesByMonth[col.key] = "";
        }
      });
      return {
        proposalId: row.id,
        serviceId: sid,
        codigo: row.codigo ?? null,
        nombre: row.nombre ?? null,
        billingType: row.billing_type ?? null,
        valuesByMonth,
        agencySnapshot: row.agency_snapshot ?? null,
      };
    });
  }, [leadServices, proposalMonthColumns, proposalGridOverrides]);

  /** Persistir draft de propuesta con debounce (1s) al editar tabla o meses. */
  useEffect(() => {
    if (!id || activeTab !== "consultor") return;
    if (proposalSkipNextSaveRef.current) {
      proposalSkipNextSaveRef.current = false;
      return;
    }
    if (proposalDraftSaveRef.current) clearTimeout(proposalDraftSaveRef.current);
    proposalDraftSaveRef.current = setTimeout(() => {
      proposalDraftSaveRef.current = null;
      const draft = {
        months: proposalMonthColumns.map((c) => ({ key: c.key, label: c.label })),
        rows: proposalGridRows.map((r) => ({
          proposalId: r.proposalId,
          serviceId: r.serviceId,
          valuesByMonth: { ...r.valuesByMonth },
          ...(r.agencySnapshot ? { agencySnapshot: r.agencySnapshot } : {}),
        })),
      };
      fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_draft_json: JSON.stringify(draft) }),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (proposalDraftSaveRef.current) clearTimeout(proposalDraftSaveRef.current);
    };
  }, [id, activeTab, proposalMonthColumns, proposalGridRows]);

  // Servicio elegido en el formulario (para placeholder precio y alcance_base)
  const selectedService = useMemo(
    () => servicesCatalog.find((s) => s.id === selectedServiceId) ?? null,
    [servicesCatalog, selectedServiceId]
  );
  // Autocompletar alcance cuando el usuario selecciona un servicio nuevo
  useEffect(() => {
    if (!selectedServiceId) return;
    const svc = servicesCatalog.find((s) => s.id === selectedServiceId);
    if (svc?.alcance_base) setSelectedAlcance(svc.alcance_base);
  }, [selectedServiceId, servicesCatalog]);

  useEffect(() => {
    if (!selectedServiceId) return;
    const svc = servicesCatalog.find((s) => s.id === selectedServiceId);
    if (!svc) return;
    setSelectedUnitPrice(svc.precio_base != null ? String(svc.precio_base) : "");
    const dq = svc.default_quantity ?? 1;
    setSelectedQuantity(String(dq > 0 ? dq : 1));
  }, [selectedServiceId, servicesCatalog]);

  function formatBillingType(value: string | null | undefined): string {
    if (!value) return "—";
    const v = String(value).toLowerCase();
    if (v === "monthly") return "Mensual";
    if (v === "one_time") return "Única vez";
    return value;
  }
  function formatMoney(moneda: string | null | undefined, precio: number | null | undefined): string {
    if (precio == null || !Number.isFinite(precio)) return "—";
    const m = moneda?.trim() || "";
    return m ? `${m} ${precio}` : String(precio);
  }
  function getUniqueCurrencies(items: LeadServiceProposal[]): string[] {
    const set = new Set<string>();
    for (const row of items) {
      const m = row.moneda?.trim();
      if (m) set.add(m);
    }
    return Array.from(set);
  }
  function sumByBillingType(items: LeadServiceProposal[], type: "one_time" | "monthly"): number {
    const t = type.toLowerCase();
    return items
      .filter((r) => String(r.billing_type ?? "").toLowerCase() === t)
      .reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
  }
  function formatSummaryMoney(items: LeadServiceProposal[], amount: number): string {
    if (!Number.isFinite(amount)) return "—";
    if (items.length === 0) return "—";
    const currencies = getUniqueCurrencies(items);
    if (currencies.length !== 1) return "Monedas mixtas";
    return formatMoney(currencies[0], amount);
  }

  function groupServicesByMonth(items: LeadServiceProposal[]): { mes: number; items: LeadServiceProposal[] }[] {
    const byMonth = new Map<number, LeadServiceProposal[]>();
    for (const row of items) {
      const m = Number(row.mes);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(row);
    }
    return Array.from(byMonth.entries())
      .map(([mes, items]) => ({ mes, items }))
      .sort((a, b) => a.mes - b.mes);
  }
  function getMonthSubtotal(items: LeadServiceProposal[]): number {
    return items.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
  }
  function getMonthCurrency(items: LeadServiceProposal[]): string | null {
    const currencies = getUniqueCurrencies(items);
    return currencies.length === 1 ? currencies[0] : null;
  }
  function formatMonthSubtotal(items: LeadServiceProposal[]): string {
    if (items.length === 0) return "—";
    const sub = getMonthSubtotal(items);
    const cur = getMonthCurrency(items);
    if (cur === null) return "Monedas mixtas";
    if (!Number.isFinite(sub) || (sub === 0 && items.every((r) => r.precio == null))) return "—";
    return formatMoney(cur, sub);
  }

  const PHASE_ORDER = ["Diagnóstico y Base", "Implementación", "Optimización y Crecimiento"] as const;
  type PhaseKey = (typeof PHASE_ORDER)[number];

  function getProposalPhase(item: LeadServiceProposal): PhaseKey {
    const bt = String(item.billing_type ?? "").toLowerCase();
    const mes = Number(item.mes);
    if (bt === "one_time" && mes === 1) return "Diagnóstico y Base";
    if (bt === "one_time" && mes >= 2) return "Implementación";
    if (bt === "monthly") return "Optimización y Crecimiento";
    return "Implementación";
  }
  function groupServicesByPhase(items: LeadServiceProposal[]): { phase: PhaseKey; items: LeadServiceProposal[] }[] {
    const byPhase = new Map<PhaseKey, LeadServiceProposal[]>();
    for (const p of PHASE_ORDER) byPhase.set(p, []);
    for (const row of items) {
      const phase = getProposalPhase(row);
      byPhase.get(phase)!.push(row);
    }
    return PHASE_ORDER.map((phase) => ({ phase, items: byPhase.get(phase)! })).filter((x) => x.items.length > 0);
  }
  function getPhaseDescription(phase: PhaseKey): string {
    const desc: Record<PhaseKey, string> = {
      "Diagnóstico y Base":
        "Servicios orientados a entender la situación actual, ordenar prioridades y crear la base estratégica de trabajo.",
      "Implementación":
        "Servicios enfocados en construir, lanzar o poner en marcha los activos y acciones necesarias.",
      "Optimización y Crecimiento":
        "Servicios orientados a mejorar resultados, escalar la captación y sostener el crecimiento en el tiempo.",
    };
    return desc[phase] ?? "";
  }
  function getPhaseSubtotal(items: LeadServiceProposal[]): number {
    return items.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
  }
  function formatPhaseSubtotal(items: LeadServiceProposal[]): string {
    if (items.length === 0) return "—";
    const sub = getPhaseSubtotal(items);
    const cur = getMonthCurrency(items);
    if (cur === null) return "Monedas mixtas";
    if (!Number.isFinite(sub) || (sub === 0 && items.every((r) => r.precio == null))) return "—";
    return formatMoney(cur, sub);
  }

  /** Parsea el informe IA del lead por bloques ### TAB:<moduleId> y devuelve Record<moduleId, contenido>. */
  function parseReportTabsLocal(report: string): Record<string, string> {
    const tabs: Record<string, string> = {};
    if (!report || !report.trim()) return tabs;
    const tabPattern = /###\s+TAB:\s*(\w+)\s*\n/gi;
    const matches: Array<{ tabId: string; startIndex: number }> = [];
    let match;
    while ((match = tabPattern.exec(report)) !== null) {
      matches.push({ tabId: match[1], startIndex: match.index + match[0].length });
    }
    for (let i = 0; i < matches.length; i++) {
      const startIndex = matches[i].startIndex;
      const remaining = report.slice(startIndex);
      const nextTabMatch = remaining.match(/###\s+TAB:\s*\w+\s*\n/i);
      const endIndex = nextTabMatch && typeof nextTabMatch.index === "number" ? startIndex + nextTabMatch.index : report.length;
      const content = report.slice(startIndex, endIndex).trim();
      if (content) tabs[matches[i].tabId] = content;
    }
    return tabs;
  }

  /** Extrae texto estratégico desde ACCIONES, plan_crecimiento, OPORTUNIDADES, propuesta_easy para sugerencias. */
  function getStrategicSourceText(lead: Lead | null): { tabs: Record<string, string>; sourceText: string } {
    const raw = (lead as any)?.ai_report;
    if (!raw || !String(raw).trim()) return { tabs: {}, sourceText: "" };
    const tabs = parseReportTabsLocal(String(raw));
    const order = ["ACCIONES", "plan_crecimiento", "OPORTUNIDADES", "propuesta_easy"];
    const parts: string[] = [];
    for (const id of order) {
      const content = tabs[id];
      if (content?.trim()) parts.push(content.trim());
    }
    return { tabs, sourceText: parts.join("\n\n") };
  }

  function normalizeText(text: string): string {
    return String(text ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchesStrategicKeywords(text: string, keywords: string[]): boolean {
    const norm = normalizeText(text);
    return keywords.some((k) => norm.includes(normalizeText(k)));
  }

  function getSuggestedServicesFromAiReport(
    catalog: EasyService[],
    proposed: LeadServiceProposal[],
    lead: Lead | null
  ): SuggestedService[] {
    const already = getAlreadyProposedServiceIds(proposed);
    const { sourceText, tabs } = getStrategicSourceText(lead);
    const hasAiReport = sourceText.length > 0;

    if (!hasAiReport) {
      const signals = getLeadSignals(lead, proposed);
      return getSuggestedServices(catalog, proposed, signals);
    }

    const normSource = normalizeText(sourceText);
    const candidates: SuggestedService[] = [];

    const add = (
      sourceKeywords: string[],
      catalogKeywords: string[],
      priority: SuggestedService["priority"],
      explanation: SuggestedServiceExplanation
    ) => {
      if (!matchesStrategicKeywords(sourceText, sourceKeywords)) return;
      for (const svc of catalog) {
        if (already.has(svc.id)) continue;
        if (!matchesService(svc, catalogKeywords)) continue;
        const reason = [explanation.diagnostico, explanation.implicancia].join(" ").slice(0, 280);
        candidates.push({ reason, explanation, priority, service: svc });
      }
    };

    // REGLA 1 — REDES
    add(
      ["redes", "instagram", "contenido", "presencia digital", "comunidad", "publicaciones", "visibilidad en redes"],
      ["redes", "social", "contenido", "community", "instagram", "facebook"],
      "alta",
      {
        diagnostico:
          "En el informe aparecen prioridades sobre redes, contenido o presencia digital (Instagram, Facebook u otras comunidades).",
        implicancia:
          "Sin calendario y mensajes alineados a la marca, el alcance rara vez se traduce en consultas o ventas medibles.",
        impacto:
          "Este servicio ordena piezas, ritmo y foco para que lo invertido en redes se vea en conversaciones comerciales reales.",
      }
    );

    // REGLA 2 — PAUTA
    add(
      ["pauta", "ads", "campañas", "captación", "tráfico", "leads", "meta ads", "google ads", "conversiones"],
      ["pauta", "ads", "trafico", "captacion", "media", "campañas", "meta", "google"],
      "alta",
      {
        diagnostico:
          "El texto del análisis menciona captación, leads, pauta o campañas en Meta/Google para acelerar resultados.",
        implicancia:
          "Si el embudo entra poco tráfico calificado, el equipo comercial queda sin volumen predecible de oportunidades.",
        impacto:
          "Permite activar demanda en el corto plazo (7–14 días) con segmentación, pruebas y optimización continua.",
      }
    );

    // REGLA 3 — WEB / LANDING (evitar si el informe dice que la web está correcta)
    const webNegative = /(la\s+web\s+está\s+correcta|sitio\s+correcto|presencia\s+web\s+correcta|web\s+bien\s+resuelta)/i.test(normSource);
    const webPositive = matchesStrategicKeywords(sourceText, ["web", "landing", "sitio", "página", "conversion", "conversión web", "mejorar la web", "optimizar sitio"]);
    if (webPositive && (!webNegative || matchesStrategicKeywords(sourceText, ["crear", "rediseño", "nueva web", "nuevo sitio", "desarrollar web"]))) {
      const webExplanation: SuggestedServiceExplanation = {
        diagnostico:
          "Las acciones del informe señalan mejorar sitio, landing o conversión; no asumen que la web ya está resuelta.",
        implicancia:
          "Sin una base digital clara y orientada a cierre, marketing y ventas no comparten un destino único para medir y convertir.",
        impacto:
          "Este servicio entrega una base para captar, medir y cerrar con menos fricción desde el sitio.",
      };
      for (const svc of catalog) {
        if (already.has(svc.id)) continue;
        if (!matchesService(svc, ["web", "landing", "sitio", "pagina"])) continue;
        candidates.push({
          reason: [webExplanation.diagnostico, webExplanation.implicancia].join(" ").slice(0, 280),
          explanation: webExplanation,
          priority: "media",
          service: svc,
        });
      }
    }

    // REGLA 4 — CONSULTORÍA / ESTRATEGIA
    add(
      ["estrategia", "consultoría", "orden comercial", "hoja de ruta", "prioridades", "propuesta de valor", "posicionamiento"],
      ["consultoria", "estrategia", "growth", "diagnostico", "auditoria"],
      "alta",
      {
        diagnostico:
          "El informe plantea estrategia, consultoría, prioridades u hoja de ruta para ordenar el negocio.",
        implicancia:
          "Sin foco, el cliente suele dispersar presupuesto en tácticas que no encajan con su etapa ni con su capacidad.",
        impacto:
          "Deja criterios claros para decidir qué hacer primero, con qué objetivo y cómo medirlo antes de ejecutar.",
      }
    );

    // REGLA 5 — AUTOMATIZACIÓN / CRM
    add(
      ["automatizacion", "automatización", "crm", "seguimiento", "pipeline", "nutricion", "nutrición", "embudo", "cierre comercial", "procesos comerciales"],
      ["automatizacion", "crm", "pipeline", "embudo", "proceso comercial"],
      "media",
      {
        diagnostico:
          "Las recomendaciones mencionan CRM, automatización, embudo o seguimiento comercial estructurado.",
        implicancia:
          "Sin trazabilidad, los leads se enfrían y el equipo pierde tiempo en tareas repetitivas o en hojas sueltas.",
        impacto:
          "Ordena el pipeline, reduce pérdidas y hace que cada venta sea más replicable y defendible frente al cliente.",
      }
    );

    // REGLA 6 — LINKEDIN (solo si el informe lo menciona en acciones/oportunidades)
    add(
      ["linkedin", "marca personal", "social selling", "autoridad profesional", "posicionamiento en linkedin"],
      ["linkedin", "marca personal", "social selling", "contenido ejecutivo"],
      "media",
      {
        diagnostico:
          "El informe destaca LinkedIn, marca personal o social selling como canal de autoridad o apertura comercial.",
        implicancia:
          "En B2B gran parte de la confianza se juega en perfiles y contenido profesional, no solo en la web corporativa.",
        impacto:
          "Refuerza credibilidad y facilita conversaciones con decisores donde ya están las conversaciones de compra.",
      }
    );

    const byId = new Map<string, SuggestedService>();
    for (const c of candidates) {
      const existing = byId.get(c.service.id);
      if (!existing || PRIORITY_ORDER[c.priority] < PRIORITY_ORDER[existing.priority]) {
        byId.set(c.service.id, c);
      }
    }
    return Array.from(byId.values())
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.service.orden ?? 0) - (b.service.orden ?? 0))
      .slice(0, 6);
  }

  function getFlowStepClasses(status: "done" | "current" | "pending"): string {
    if (status === "done") {
      return "border-green-300 bg-green-50/80 text-slate-900";
    }
    if (status === "current") {
      return "border-amber-400 bg-amber-50/90 text-slate-900 ring-2 ring-amber-200";
    }
    return "border-slate-200 bg-slate-50/50 text-slate-500";
  }

  function getLeadSignals(lead: Lead | null, items: LeadServiceProposal[]): {
    hasWebsite: boolean;
    hasInstagram: boolean;
    hasFacebook: boolean;
    hasLinkedin: boolean;
    hasAiReport: boolean;
    hasObjetivo: boolean;
    hasAudiencia: boolean;
    hasExistingProposal: boolean;
  } {
    const emp = lead?.empresas;
    const webLead = lead?.website?.trim();
    const webEmp = (emp as { web?: string | null } | undefined)?.web?.trim();
    const instaEmp = (emp as { instagram?: string | null } | undefined)?.instagram?.trim();
    const fbEmp = (emp as { facebook?: string | null } | undefined)?.facebook?.trim();
    const aiReportRaw = (lead as any)?.ai_report;
    return {
      hasWebsite: !!(webLead || webEmp),
      hasInstagram: !!instaEmp,
      hasFacebook: !!fbEmp,
      hasLinkedin: !!(
        lead?.linkedin_empresa?.trim() ||
        lead?.linkedin_personal?.trim() ||
        lead?.linkedin_director?.trim()
      ),
      hasAiReport: !!(typeof aiReportRaw === "string" && aiReportRaw.trim()),
      hasObjetivo: !!(lead?.objetivos?.trim()),
      hasAudiencia: !!(lead?.audiencia?.trim()),
      hasExistingProposal: items.length > 0,
    };
  }
  function getAlreadyProposedServiceIds(items: LeadServiceProposal[]): Set<string> {
    const set = new Set<string>();
    for (const r of items) {
      if (r.service_id?.trim()) set.add(r.service_id.trim());
      if (r.agency_service_id?.trim()) set.add(r.agency_service_id.trim());
    }
    return set;
  }
  function matchesService(service: EasyService, keywords: string[]): boolean {
    const raw = [
      service.codigo ?? "",
      service.nombre ?? "",
      service.categoria ?? "",
      service.descripcion_corta ?? "",
      service.alcance_base ?? "",
    ].join(" ");
    const lower = raw.toLowerCase();
    return keywords.some((k) => lower.includes(k.toLowerCase()));
  }
  function getPriorityBadgeClasses(priority: "alta" | "media" | "baja"): string {
    if (priority === "alta") return "rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 border border-red-200";
    if (priority === "media") return "rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200";
    return "rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200";
  }
  function getSuggestedPriorityText(priority: "alta" | "media" | "baja"): string {
    if (priority === "alta") return "Alta prioridad";
    if (priority === "media") return "Prioridad media";
    return "Prioridad baja";
  }
  function getServicePhaseLabel(billingType: string | null | undefined): string {
    const bt = String(billingType ?? "").toLowerCase();
    if (bt === "one_time") return "Fase inicial / implementación";
    if (bt === "monthly") return "Fase de continuidad / crecimiento";
    return "Fase operativa";
  }
  const DEFAULT_SALES_COPY: ServiceSalesCopy = {
    why: "Este servicio puede aportar valor al lead en función de su etapa actual y complementar una propuesta más amplia de crecimiento.",
    outcome: "Ayuda a fortalecer la ejecución, mejorar la propuesta comercial o reforzar la base operativa del negocio.",
    howToSell: "Se puede presentar como una pieza que suma coherencia y capacidad de avance dentro de una propuesta integral.",
  };
  function getServiceSalesCopy(service: EasyService, _signals: ReturnType<typeof getLeadSignals>): ServiceSalesCopy {
    if (matchesService(service, ["web", "landing", "sitio", "pagina"])) {
      return {
        why: "Este servicio es recomendable porque el lead necesita una base digital clara donde presentar su propuesta, captar interés y ordenar su presencia online.",
        outcome: "Permite mejorar visibilidad, dar una imagen más profesional y crear un activo concreto para convertir tráfico o interés en oportunidades reales.",
        howToSell: "Se puede presentar como la base mínima necesaria para que el negocio tenga una presencia sólida, creíble y preparada para sostener acciones comerciales o publicitarias.",
      };
    }
    if (matchesService(service, ["auditoria", "diagnostico", "consultoria", "estrategia", "growth"])) {
      return {
        why: "Este servicio ayuda a ordenar prioridades, detectar oportunidades y definir un camino más claro antes de invertir tiempo o presupuesto en acciones aisladas.",
        outcome: "Genera claridad estratégica, reduce improvisación y permite que las siguientes decisiones comerciales o de marketing tengan más dirección.",
        howToSell: "Se puede vender como una instancia de orden y visión, ideal para transformar intuiciones en una hoja de ruta concreta con foco en resultados.",
      };
    }
    if (matchesService(service, ["pauta", "ads", "trafico", "captacion", "meta", "google"])) {
      return {
        why: "Este servicio es útil cuando el lead ya tiene una base mínima y necesita acelerar visibilidad, generación de demanda o captación de oportunidades.",
        outcome: "Permite aumentar alcance, atraer público más calificado y generar un flujo más constante de contactos o consultas.",
        howToSell: "Se puede presentar como el paso lógico para convertir la base digital existente en un sistema activo de generación de oportunidades.",
      };
    }
    if (matchesService(service, ["linkedin", "contenido", "marca personal", "social selling"])) {
      return {
        why: "Este servicio aprovecha la presencia profesional del lead para construir posicionamiento, autoridad y apertura comercial en canales relevantes.",
        outcome: "Mejora percepción de marca, genera confianza y facilita conversaciones comerciales desde una posición más sólida.",
        howToSell: "Se puede vender como una herramienta para posicionarse mejor, abrir puertas y acompañar ventas consultivas con mayor credibilidad.",
      };
    }
    if (matchesService(service, ["automatizacion", "implementacion", "crm", "sistema", "pipeline"])) {
      return {
        why: "Este servicio permite pasar de acciones dispersas a una operación más ordenada, trazable y escalable.",
        outcome: "Mejora seguimiento, reduce pérdida de oportunidades y ayuda a profesionalizar la gestión comercial o técnica.",
        howToSell: "Se puede presentar como una mejora estructural que ordena procesos y crea capacidad real de crecimiento sostenido.",
      };
    }
    return DEFAULT_SALES_COPY;
  }

  /** Si faltara `explanation` (no debería), arma 3 líneas desde el copy genérico por tipo de servicio. */
  function getSuggestedServiceDisplayExplanation(
    s: SuggestedService,
    signals: ReturnType<typeof getLeadSignals>
  ): SuggestedServiceExplanation {
    const e = s.explanation;
    if (e?.diagnostico?.trim() && e?.implicancia?.trim() && e?.impacto?.trim()) return e;
    const copy = getServiceSalesCopy(s.service, signals);
    return {
      diagnostico: copy.why,
      implicancia: copy.outcome,
      impacto: copy.howToSell,
    };
  }

  const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
  function getSuggestedServices(
    catalog: EasyService[],
    proposed: LeadServiceProposal[],
    signals: ReturnType<typeof getLeadSignals>
  ): SuggestedService[] {
    const already = getAlreadyProposedServiceIds(proposed);
    const candidates: SuggestedService[] = [];

    const add = (keywords: string[], priority: SuggestedService["priority"], explanation: SuggestedServiceExplanation) => {
      for (const svc of catalog) {
        if (already.has(svc.id)) continue;
        if (!matchesService(svc, keywords)) continue;
        const reason = [explanation.diagnostico, explanation.implicancia].join(" ").slice(0, 280);
        candidates.push({ reason, explanation, priority, service: svc });
      }
    };

    if (!signals.hasWebsite) {
      add(["web", "landing", "sitio", "pagina"], "alta", {
        diagnostico: "En la ficha no hay URL de sitio web o presencia digital clara para el negocio.",
        implicancia:
          "Sin un destino único, las campañas, redes y contactos comerciales no tienen dónde medir interés ni conversión.",
        impacto: "Crea una base visible y profesional para canalizar tráfico, credibilidad y pedidos de contacto.",
      });
    }
    if (signals.hasWebsite && !signals.hasAiReport) {
      add(["auditoria", "diagnostico", "consultoria"], "alta", {
        diagnostico: "Hay web cargada pero aún no hay informe IA completo que priorice gaps y próximos pasos.",
        implicancia:
          "Proponer tácticas sin diagnóstico suele generar propuestas genéricas y difíciles de defender con el cliente.",
        impacto: "Una auditoría o consultoría inicial ordena prioridades y evita invertir primero en lo que menos mueve la aguja.",
      });
    }
    if ((signals.hasInstagram || signals.hasFacebook) && !signals.hasObjetivo) {
      add(["consultoria", "estrategia", "growth"], "media", {
        diagnostico: "El lead muestra redes activas pero sin objetivos claros alineados en la ficha.",
        implicancia:
          "Sin norte medible, el contenido y la inversión no se pueden ajustar ni explicar al cliente.",
        impacto: "Define foco, métricas y mensajes para que cada publicación cumpla un rol en el embudo.",
      });
    }
    if (signals.hasWebsite && (signals.hasInstagram || signals.hasFacebook) && !signals.hasExistingProposal) {
      add(["pauta", "ads", "trafico", "captacion"], "media", {
        diagnostico: "Ya existe web y redes; la propuesta aún no incluye servicios para acelerar captación.",
        implicancia:
          "Con solo tráfico orgánico el crecimiento depende del ritmo editorial y del algoritmo, sin control de volumen.",
        impacto: "La pauta permite escalar alcance y leads con segmentación, pruebas y control de costo.",
      });
    }
    if (signals.hasLinkedin) {
      add(["linkedin", "contenido", "marca personal", "social selling"], "media", {
        diagnostico: "Hay perfil o actividad en LinkedIn registrada en la ficha del lead.",
        implicancia:
          "LinkedIn sin plan de contenido y autoridad suele aportar poco pipeline frente al tiempo invertido.",
        impacto: "Refuerza credibilidad del equipo o de la marca y facilita conversaciones con decisores B2B.",
      });
    }
    if (signals.hasAiReport && !signals.hasExistingProposal) {
      add(["consultoria", "implementacion", "automatizacion"], "alta", {
        diagnostico: "El lead ya tiene informe IA y la propuesta aún no tiene líneas de servicio cargadas.",
        implicancia:
          "El diagnóstico solo cobra valor cuando se traduce en alcance, entregables y priorización con presupuesto.",
        impacto: "Permite pasar de lectura a ejecución con plan, priorización y alcance acordado con el cliente.",
      });
    }

    const byId = new Map<string, SuggestedService>();
    for (const c of candidates) {
      const existing = byId.get(c.service.id);
      if (!existing || PRIORITY_ORDER[c.priority] < PRIORITY_ORDER[existing.priority]) {
        byId.set(c.service.id, c);
      }
    }
    return Array.from(byId.values())
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.service.orden ?? 0) - (b.service.orden ?? 0))
      .slice(0, 6);
  }

  async function handleAddProposalService() {
    if (!id) return;
    setServicesError("");
    if (!selectedServiceId.trim()) {
      setServicesError("Seleccioná un servicio antes de agregarlo.");
      return;
    }
    const mesAdd = Number(selectedMes);
    if (!Number.isInteger(mesAdd) || mesAdd < 1 || mesAdd > 24) {
      setServicesError("El mes debe estar entre 1 y 24.");
      return;
    }
    const up =
      selectedUnitPrice === ""
        ? Number(selectedService?.precio_base ?? 0)
        : Number(selectedUnitPrice);
    const qtyRaw =
      selectedQuantity === "" ? Number(selectedService?.default_quantity ?? 1) : Number(selectedQuantity);
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
    const unitPrice = Number.isFinite(up) ? up : 0;
    const totalLine = unitPrice * qty;
    if (qty <= 0 || !Number.isFinite(qty)) {
      setServicesError("La cantidad debe ser un número mayor que 0.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setServicesError("El precio unitario debe ser un número válido (≥ 0).");
      return;
    }
    const basePrice = totalLine;
    setServicesSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_service_id: selectedServiceId,
          mes: mesAdd,
          unit_price: unitPrice,
          quantity: qty,
          precio: totalLine,
          alcance_editado: selectedAlcance.trim() || null,
          observaciones: selectedObservaciones.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(json?.error ?? "Error al agregar el servicio");
        return;
      }
      setSelectedServiceId("");
      setSelectedMes(1);
      setSelectedUnitPrice("");
      setSelectedQuantity("");
      setSelectedAlcance("");
      setSelectedObservaciones("");
      await loadLeadServices();
      const newProposal = (json as { proposal?: { id: string } })?.proposal;
      if (newProposal?.id && Number.isFinite(basePrice)) {
        const cols = getProposalMonthColumns(Math.max(1, proposalMonthCount));
        const next: Record<string, number | ""> = {};
        cols.forEach((c, idx) => {
          next[c.key] = idx + 1 === mesAdd ? basePrice : "";
        });
        setProposalGridOverrides((prev) => ({ ...prev, [newProposal.id]: next }));
      }
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "Error al agregar el servicio");
    } finally {
      setServicesSaving(false);
    }
  }

  async function saveProposalRow(rowId: string) {
    if (!id) return;
    setServicesError("");
    const row = leadServices.find((r) => r.id === rowId);
    const d = proposalRowDrafts[rowId];
    if (!row || !d) return;
    const mes = Number(d.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 24) {
      setServicesError("El mes debe estar entre 1 y 24.");
      return;
    }
    const upAg = Number(d.unit_price);
    const qtyAg = Number(d.quantity);
    if (row.agency_service_id && row.agency_snapshot) {
      if (!Number.isFinite(upAg) || upAg < 0) {
        setServicesError("Precio unitario inválido.");
        return;
      }
      if (!Number.isFinite(qtyAg) || qtyAg <= 0) {
        setServicesError("La cantidad debe ser mayor que 0.");
        return;
      }
    } else {
      if (!Number.isFinite(upAg) || upAg < 0) {
        setServicesError("Precio inválido.");
        return;
      }
    }
    setServicesSaving(true);
    try {
      const patchBody: Record<string, unknown> = {
        mes,
        alcance_editado: d.alcance_editado.trim() || null,
        observaciones: d.observaciones.trim() || null,
      };
      if (row.agency_service_id && row.agency_snapshot) {
        patchBody.precio = upAg * qtyAg;
        patchBody.agency_snapshot = {
          ...row.agency_snapshot,
          unit_price: upAg,
          quantity: qtyAg,
          total_price: upAg * qtyAg,
          notes: d.notes_agency.trim(),
        };
      } else {
        patchBody.precio = upAg;
      }
      const res = await fetch(`/api/admin/leads/${id}/services/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(json?.error ?? "No se pudo guardar el servicio propuesto.");
        return;
      }
      await loadLeadServices();
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "No se pudo guardar el servicio propuesto.");
    } finally {
      setServicesSaving(false);
    }
  }

  async function handleDeleteProposal(proposalId: string) {
    if (!id) return;
    if (!confirm("¿Eliminar este servicio de la propuesta?")) return;
    setServicesError("");
    setDeletingServiceId(proposalId);
    try {
      const res = await fetch(`/api/admin/leads/${id}/services/${proposalId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(json?.error ?? "No se pudo eliminar el servicio propuesto.");
        return;
      }
      setProposalGridOverrides((prev) => {
        const next = { ...prev };
        delete next[proposalId];
        return next;
      });
      await loadLeadServices();
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "No se pudo eliminar el servicio propuesto.");
    } finally {
      setDeletingServiceId(null);
    }
  }

  async function handleConfirmProposal() {
    if (!id) return;
    setProposalConfirming(true);
    setServicesError("");
    try {
      const draft = {
        months: proposalMonthColumns.map((c) => ({ key: c.key, label: c.label })),
        rows: proposalGridRows.map((r) => ({
          proposalId: r.proposalId,
          serviceId: r.serviceId,
          valuesByMonth: { ...r.valuesByMonth },
          ...(r.agencySnapshot ? { agencySnapshot: r.agencySnapshot } : {}),
        })),
      };
      const res = await fetch(`/api/admin/leads/${id}/proposal/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setServicesError(json?.error ?? "No se pudo confirmar la propuesta.");
        return;
      }
      await fetchLead();
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "No se pudo confirmar la propuesta.");
    } finally {
      setProposalConfirming(false);
    }
  }

  async function handleMarkProposalSent() {
    if (!id) return;
    setProposalSentSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_sent_at: new Date().toISOString() }),
      });
      if (!res.ok) return;
      await fetchLead();
    } finally {
      setProposalSentSaving(false);
    }
  }

  /** Descarga real de PDF por fetch+blob+objectURL (solo same-origin). En CORS falla y no se debe usar para externos. */
  const handleDownloadPdf = useCallback(async (url: string, filename: string) => {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  async function handleAddSuggestedService(suggestion: SuggestedService) {
    if (!id) return;
    setServicesError("");
    const dq = suggestion.service.default_quantity ?? 1;
    const qty = dq > 0 ? dq : 1;
    const up = Number(suggestion.service.precio_base ?? 0);
    const basePrice = up * qty;
    setServicesSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_service_id: suggestion.service.id,
          mes: 1,
          unit_price: up,
          quantity: qty,
          precio: basePrice,
          alcance_editado: suggestion.service.alcance_base?.trim() || null,
          observaciones: `Sugerido automáticamente para el lead (${suggestion.priority}).`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(json?.error ?? "Error al agregar el servicio");
        return;
      }
      await loadLeadServices();
      const newProposal = (json as { proposal?: { id: string } })?.proposal;
      if (newProposal?.id && Number.isFinite(basePrice)) {
        const cols = getProposalMonthColumns(Math.max(1, proposalMonthCount));
        const mesAdd = 1;
        const next: Record<string, number | ""> = {};
        cols.forEach((c, idx) => {
          next[c.key] = idx + 1 === mesAdd ? basePrice : "";
        });
        setProposalGridOverrides((prev) => ({ ...prev, [newProposal.id]: next }));
      }
      requestAnimationFrame(() => {
        document.getElementById("services-proposal")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "Error al agregar el servicio");
    } finally {
      setServicesSaving(false);
    }
  }

  // Helper: el lead es "mío" si soy comercial y lead.comercial_id coincide con mi comercial (o app_user id como fallback)
  const isLeadOwner =
    role === "comercial" &&
    !!lead?.comercial_id &&
    (currentComercialId ?? currentAppUserId) === lead.comercial_id;

  const canEditLead = !!lead && (hasPermission("leads.write") || isLeadOwner);

  // Eliminar: solo admin (opción 1; si querés comercial dueño, usar canEditLead)
  const canDeleteThisLead = role === "admin";

  // ✅ Etapas (pipelines)
  type EtapaRow = { id: string; nombre: string };
  const [etapas, setEtapas] = useState<string[]>([]);
  const [loadingEtapas, setLoadingEtapas] = useState(false);
  const [contactForm, setContactForm] = useState<{
    nombre: string;
    cargo: string;
    telefono: string;
    email: string;
    is_primary: boolean;
    notas: string;
  }>({
    nombre: "",
    cargo: "",
    telefono: "",
    email: "",
    is_primary: false,
    notas: "",
  });

  useEffect(() => {
    if (!lead?.empresas) return;
    const e = lead.empresas;
    setEntityForm({
      nombre: e.nombre ?? "",
      telefono: e.telefono ?? "",
      email: e.email ?? "",
      direccion: e.direccion ?? "",
      website: e.web ?? "",
      instagram: e.instagram ?? "",
      facebook: (e as { facebook?: string | null }).facebook ?? "",
      rubro: e.rubros?.nombre ?? "",
      celular: e.celular ?? "",
      rut: e.rut ?? "",
      ciudad: e.ciudad ?? "",
      pais: e.pais ?? "",
      contacto_celular: e.contacto_celular ?? "",
      contacto_email: e.contacto_email ?? "",
      etiquetas: e.etiquetas ?? "",
    });
  }, [lead]);

  // Función reutilizable para abrir Meet en ventana popup controlada
  function openMeetWindow(meetUrl: string) {
    // Si ya existe una ventana abierta y no cerrada, hacer focus y retornar
    if (meetWinRef.current && !meetWinRef.current.closed) {
      meetWinRef.current.focus();
      return;
    }

    const name = "meet_assistido_window";
    const features = "popup=yes,width=500,height=700,left=80,top=80";
    const w = window.open(meetUrl, name, features);

    if (w === null) {
      // Popup bloqueado, fallback a nueva pestaña
      window.open(meetUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Ventana abierta exitosamente
    meetWinRef.current = w;
    w.focus();
    sessionStorage.setItem("meetWindowOpened", "true");
    setMeetWindowOpened(!!meetWinRef.current && !meetWinRef.current.closed);
  }

  // Monitorear estado de la ventana para detectar cierre
  useEffect(() => {
    // Interval para detectar cierre de ventana
    let intervalId: number | null = null;
    
    if (meetWindowOpened && meetWinRef.current) {
      intervalId = window.setInterval(() => {
        if (meetWinRef.current?.closed === true) {
          setMeetWindowOpened(false);
          sessionStorage.removeItem("meetWindowOpened");
          meetWinRef.current = null;
        } else {
          // Actualizar estado basado en estado real de la ventana
          setMeetWindowOpened(!!meetWinRef.current && !meetWinRef.current.closed);
        }
      }, 1500);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [meetWindowOpened]);

  // ✅ Opciones dinámicas desde API
  const [leadOptions, setLeadOptions] = useState<{
    objetivos: string[];
    audiencia: string[];
    tamanios: string[];
  }>({
    objetivos: OBJETIVOS_OPTS_FALLBACK,
    audiencia: AUDIENCIA_OPTS_FALLBACK,
    tamanios: TAMANO_OPTS_FALLBACK,
  });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function fetchLead() {
    if (!id) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando lead");

      const next = (json?.data ?? null) as Lead | null;
      // Convertir objetivos/audiencia de array a string si vienen como array (backward compatibility)
      if (next) {
        if (Array.isArray(next.objetivos)) {
          next.objetivos = arrayToString(next.objetivos);
        }
        if (Array.isArray(next.audiencia)) {
          next.audiencia = arrayToString(next.audiencia);
        }
      }
      setLead(next);

      if (!editing) setDraft({});
    } catch (e: any) {
      setError(e?.message ?? "Error cargando lead");
      setLead(null);
    } finally {
      setLoading(false);
    }
  }

  async function patchLead(payload: PatchPayload) {
    if (!id) return;

    setError(null);
    setMutating(true);
    try {
      // Log temporal para confirmar si se está enviando linkedin
      console.log("[patchLead] Payload linkedin:", {
        linkedin_empresa: payload.linkedin_empresa !== undefined ? (payload.linkedin_empresa || "null") : "undefined (no se incluye)",
        linkedin_personal: payload.linkedin_personal !== undefined ? (payload.linkedin_personal || "null") : "undefined (no se incluye)",
      });

      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as LeadApiResponse & { warning?: string };
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando lead");

      const updated = json?.data ?? null;
      if (!updated) throw new Error("No se recibió el lead actualizado");

      // Merge robusto: preservar empresas y empresa_id del estado anterior si el PATCH no los trae
      setLead((prev) => {
        if (!prev) return updated;
        return {
          ...prev,
          ...updated,
          // Preservar empresas si el PATCH no lo incluye
          empresas: updated.empresas ?? prev.empresas ?? null,
          // Preservar empresa_id si viene vacío por error
          empresa_id: updated.empresa_id ?? prev.empresa_id ?? null,
        };
      });
      
      // Si hay advertencia (ej: error al crear socio), mostrarla pero no fallar
      if (json?.warning) {
        setError(json.warning);
      } else {
        flash("Guardado.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando lead");
      throw e; // Re-lanzar para que el caller pueda manejar el error
    } finally {
      setMutating(false);
    }
  }

  // Función reutilizable para guardar el draft actual
  async function saveDraft() {
    if (!id) return;
    
    // Solo guarda si hay cambios pendientes
    if (Object.keys(draft).length === 0) {
      return; // No hay cambios, no hace nada
    }

    // Construir payload base (sin linkedin_empresa/linkedin_personal, se agregan condicionalmente)
    const normalized: PatchPayload = {
      nombre: norm(draft.nombre),
      contacto: norm(draft.contacto),
      telefono: norm(draft.telefono),
      email: norm(draft.email),
      origen: norm(draft.origen),
      pipeline: norm(draft.pipeline),
      notas: norm(draft.notas),
      website: norm(draft.website),
      objetivos: norm(draft.objetivos),
      audiencia: norm(draft.audiencia),
      tamano: norm(draft.tamano),
      oferta: norm(draft.oferta),
      meet_url: norm(draft.meet_url),
      score: draft.score ?? null,
      score_categoria: draft.score_categoria ?? null,
      comercial_id: draft.comercial_id ?? null,
    };

    // Preservar linkedin_empresa y linkedin_personal si el draft está vacío pero el lead tiene valores
    const currentLinkedinEmpresa = (lead?.linkedin_empresa ?? "").trim();
    const currentLinkedinPersonal = (
      (lead?.linkedin_personal ?? lead?.linkedin_director ?? "") as string
    ).trim();
    const newLinkedinEmpresa = (draft.linkedin_empresa ?? "").trim();
    const newLinkedinPersonal = (draft.linkedin_personal ?? "").trim();

    // LinkedIn Empresa: solo incluir si cambió explícitamente
    if (draft.linkedin_empresa !== undefined) {
      if (newLinkedinEmpresa === "" && currentLinkedinEmpresa) {
        // Draft vacío pero lead tiene valor → NO incluir (preservar valor existente)
        // No hacer nada, no incluir en normalized
      } else if (newLinkedinEmpresa !== currentLinkedinEmpresa) {
        // Valor nuevo diferente al actual → incluir (puede ser cambio o borrado explícito)
        normalized.linkedin_empresa = newLinkedinEmpresa || null;
      }
      // Si son iguales, no incluir (no cambió)
    }

    // LinkedIn contacto: solo incluir si cambió explícitamente
    if (draft.linkedin_personal !== undefined) {
      if (newLinkedinPersonal === "" && currentLinkedinPersonal) {
        // Draft vacío pero lead tiene valor → NO incluir (preservar valor existente)
      } else if (newLinkedinPersonal !== currentLinkedinPersonal) {
        normalized.linkedin_personal = newLinkedinPersonal || null;
      }
    }

    // REGLA: Solo incluir empresa_id en el payload si realmente cambió
    // Comparar con el valor actual del lead
    if (draft.empresa_id !== undefined) {
      const currentEmpresaId = lead?.empresa_id ?? null;
      const newEmpresaId = draft.empresa_id?.trim() || null;
      
      if (currentEmpresaId !== newEmpresaId) {
        // Solo incluir si cambió
        if (newEmpresaId) {
          // Vincular a nueva empresa
          normalized.empresa_id = newEmpresaId;
        } else {
          // Intentando desvincular (de un valor a null)
          // No permitir desvincular desde el formulario normal sin flag
          // El usuario debe usar un botón específico para desvincular
          console.warn("[Frontend] Intento de desvincular empresa_id desde formulario normal, ignorando. Use el botón específico para desvincular.");
          // No incluir empresa_id en el payload, se preservará el valor actual
        }
      }
      // Si no cambió, no incluirlo en el payload (se preserva automáticamente en backend)
    }

    await patchLead(normalized);
  }

  // Función para obtener sesión activa
  async function fetchActiveSession() {
    if (!id) return;
    
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/meet-sessions?status=active`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      
      const json = (await res.json()) as ApiResp<any>;
      if (res.ok && json?.data) {
        setActiveSession({ id: json.data.id });
      } else {
        setActiveSession(null);
      }
    } catch (e: any) {
      console.warn("Error obteniendo sesión activa:", e?.message);
      setActiveSession(null);
    } finally {
      setLoadingSession(false);
    }
  }

  async function startMeetSession() {
    if (!id) {
      setError("ID de lead no disponible");
      return;
    }

    // Si ya hay sesión activa, navegar a ella en lugar de crear una nueva
    if (activeSession?.id) {
      router.push(`/admin/leads/${id}/meet-sessions/${activeSession.id}`);
      return;
    }

    setStartingMeet(true);
    setError(null);
    try {
      // Determinar el URL final: usar el del lead o pedirlo al usuario
      let urlFinal: string | null = lead?.meet_url ?? null;

      if (!urlFinal || urlFinal.trim().length === 0) {
        // Pedir URL al usuario
        const urlInput = window.prompt("Pegá el link de Google Meet (https://meet.google.com/...)");
        
        if (!urlInput || urlInput.trim().length === 0) {
          setError("Debes ingresar un link de Google Meet");
          setStartingMeet(false);
          return;
        }

        const urlTrimmed = urlInput.trim();
        
        // Validar que empiece con "https://meet.google.com/"
        if (!urlTrimmed.startsWith("https://meet.google.com/")) {
          setError("El link debe empezar con https://meet.google.com/");
          setStartingMeet(false);
          return;
        }

        urlFinal = urlTrimmed;

        // Guardar el URL en el lead
        const patchRes = await fetch(`/api/admin/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meet_url: urlFinal }),
        });

        const patchJson = (await patchRes.json().catch(() => ({}))) as LeadApiResponse;
        if (!patchRes.ok) {
          throw new Error(patchJson?.error ?? "Error guardando el link de Meet");
        }

        // Actualizar el estado local del lead con merge robusto (preservar empresas)
        if (patchJson?.data) {
          const next = patchJson.data as Lead;
          setLead((prev) => {
            if (!prev) return next;
            return {
              ...prev,
              ...next,
              // preservar relación empresas si el patch no la trae
              empresas: next.empresas ?? prev.empresas ?? null,
              empresa_id: next.empresa_id ?? prev.empresa_id ?? null,
            };
          });
        }
      }

      // Iniciar sesión con el URL final
      const res = await fetch(`/api/admin/leads/${id}/meet-sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meet_url: urlFinal }),
      });

      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok) {
        throw new Error(json?.error ?? "Error al iniciar sesión de Meet");
      }

      if (res.status === 201 && json?.data) {
        const session = json.data;
        const sessionId = session?.id;
        
        if (!sessionId) {
          throw new Error("No se recibió sessionId en la respuesta");
        }

        // Abrir Google Meet en ventana popup controlada
        if (urlFinal) {
          openMeetWindow(urlFinal);
        }

        flash("Sesión de Meet iniciada");

        // Redirigir inmediatamente a la pantalla exclusiva del Meet
        window.location.href = `/admin/leads/${id}/meet-sessions/${sessionId}`;
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error("Error desconocido");
      setError(error.message);
      setStartingMeet(false);
    }
  }

  async function deleteLead() {
    if (!id) return;

    const ok = window.confirm(
      "¿Eliminar este lead? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando lead");

      router.push("/admin/leads");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando lead");
    } finally {
      setDeleting(false);
    }
  }

  async function convertToMember() {
    if (!id || !lead) return;

    const ok = window.confirm(
      `¿Convertir este lead en ${labels.memberSingular.toLowerCase()}? Se creará un registro en la tabla de ${labels.memberPlural.toLowerCase()}.`
    );
    if (!ok) return;

    setError(null);
    setMutating(true);
    try {
      // Primero guardar el draft pendiente
      await saveDraft();

      // Luego convertir a socio
      const res = await fetch(`/api/admin/leads/${id}/convert-to-member`, {
        method: "POST",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<any>;
      if (!res.ok) throw new Error(json?.error ?? "Error convirtiendo a socio");

      flash("Lead convertido en socio correctamente.");
      await fetchLead();
    } catch (e: any) {
      setError(e?.message ?? "Error convirtiendo a socio");
    } finally {
      setMutating(false);
    }
  }


  // ✅ Fetch opciones dinámicas desde API
  async function fetchLeadOptions() {
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const res = await fetch("/api/admin/config/leads/options", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadOptionsResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando opciones");

      const data = json?.data;
      if (!data) {
        throw new Error("No se recibieron opciones");
      }

      // Extraer labels de items activos y mapear a arrays de strings
      const objetivos =
        data.membership_goals
          ?.filter((item) => item.is_active)
          .map((item) => item.label.trim())
          .filter(Boolean) ?? [];

      const audiencia =
        data.icp_targets
          ?.filter((item) => item.is_active)
          .map((item) => item.label.trim())
          .filter(Boolean) ?? [];

      const tamanios =
        data.company_size
          ?.filter((item) => item.is_active)
          .map((item) => item.label.trim())
          .filter(Boolean) ?? [];

      // Solo actualizar si hay datos válidos, sino mantener fallback
      if (objetivos.length > 0 || audiencia.length > 0 || tamanios.length > 0) {
        setLeadOptions({
          objetivos: objetivos.length > 0 ? objetivos : OBJETIVOS_OPTS_FALLBACK,
          audiencia: audiencia.length > 0 ? audiencia : AUDIENCIA_OPTS_FALLBACK,
          tamanios: tamanios.length > 0 ? tamanios : TAMANO_OPTS_FALLBACK,
        });
      }
    } catch (e: any) {
      setOptionsError(e?.message ?? "Error cargando opciones");
      // Mantener fallback hardcodeado en caso de error
      setLeadOptions({
        objetivos: OBJETIVOS_OPTS_FALLBACK,
        audiencia: AUDIENCIA_OPTS_FALLBACK,
        tamanios: TAMANO_OPTS_FALLBACK,
      });
    } finally {
      setOptionsLoading(false);
    }
  }

  async function fetchEtapas() {
    setLoadingEtapas(true);
    try {
      const res = await fetch("/api/admin/leads/pipelines", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = await res.json();

      // Soporta varios formatos (por si el endpoint devuelve data directo)
      const rows: EtapaRow[] =
        json?.data?.pipelines ??
        json?.data ??
        json?.pipelines ??
        [];

      const names = (rows || [])
        .map((r) => (r?.nombre ?? "").trim())
        .filter(Boolean);

      // fallback mínimo por si no hay nada aún
      const fallback = ["Nuevo", "Perdido", "Ganado"];

      setEtapas(Array.from(new Set([...names, ...fallback])));
    } catch {
      setEtapas(["Nuevo", "Perdido", "Ganado"]);
    } finally {
      setLoadingEtapas(false);
    }
  }

  useEffect(() => {
    fetchLead();
    fetchLeadOptions();
    fetchActiveSession();
    
    // Cargar labels personalizados
    fetchLabels().then(setLabels).catch(() => {
      // Fallback a defaults si falla
    });
    
    // Escuchar actualizaciones de config
    const handleUpdate = () => {
      fetchLabels().then(setLabels).catch(() => {});
    };
    window.addEventListener("portal-config-updated", handleUpdate);
    return () => window.removeEventListener("portal-config-updated", handleUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchEtapas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchComerciales() {
    setLoadingComerciales(true);
    try {
      const res = await fetch("/api/admin/comerciales", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json?.data)) {
        setComerciales(json.data.map((c: any) => ({ id: c.id, nombre: c.nombre })));
      }
    } catch (e) {
      console.error("Error cargando comerciales:", e);
    } finally {
      setLoadingComerciales(false);
    }
  }

  useEffect(() => {
    fetchComerciales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refrescar sesión activa después de iniciar una nueva
  useEffect(() => {
    if (!startingMeet) {
      fetchActiveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingMeet]);

  // ✅ Fetch contactos cuando se entra al tab
  async function fetchContacts() {
    if (!id) return;

    setContactsError(null);
    setContactsLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/contacts`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error cargando contactos");

      setContacts(json?.data || []);
    } catch (e: any) {
      setContactsError(e?.message ?? "Error cargando contactos");
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "contactos" && id) {
      fetchContacts();
    }
  }, [activeTab, id]);

  // ✅ Funciones para manejar contactos
  function openContactModal(contact?: typeof contacts[0] | null) {
    if (contact) {
      setEditingContact(contact);
      setContactForm({
        nombre: contact.nombre,
        cargo: contact.cargo,
        telefono: contact.telefono || "",
        email: contact.email || "",
        is_primary: contact.is_primary,
        notas: contact.notas || "",
      });
    } else {
      setEditingContact(null);
      setContactForm({
        nombre: "",
        cargo: "",
        telefono: "",
        email: "",
        is_primary: false,
        notas: "",
      });
    }
    setShowContactModal(true);
  }

  function closeContactModal() {
    setShowContactModal(false);
    setEditingContact(null);
    setContactForm({
      nombre: "",
      cargo: "",
      telefono: "",
      email: "",
      is_primary: false,
      notas: "",
    });
  }

  async function saveContact() {
    if (!id || !lead) return;
    if (!contactForm.nombre.trim()) {
      setContactsError("El nombre es obligatorio");
      return;
    }

    setContactsError(null);
    const payload = {
      nombre: contactForm.nombre.trim(),
      cargo: contactForm.cargo.trim() || null,
      telefono: contactForm.telefono.trim() || null,
      email: contactForm.email.trim() || null,
      is_primary: contactForm.is_primary,
      notas: contactForm.notas.trim() || null,
      lead_id: lead.id,
      empresa_id: lead?.empresas?.id ?? null,
    };

    console.log("[CONTACT] payload", payload);

    try {
      const url = editingContact
        ? `/api/admin/leads/${id}/contacts/${editingContact.id}`
        : `/api/admin/leads/${id}/contacts`;
      const method = editingContact ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      console.log("[CONTACT] response", { status: res.status, json });
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Error guardando contacto");

      closeContactModal();
      await fetchContacts();
      flash(editingContact ? "Contacto actualizado." : "Contacto creado.");
    } catch (err) {
      console.error("[CONTACT] ERROR", err);
      setContactsError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteContact(contactId: string) {
    if (!id) return;
    if (!confirm("¿Eliminar este contacto?")) return;

    setContactsError(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}/contacts/${contactId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando contacto");

      await fetchContacts();
      flash("Contacto eliminado.");
    } catch (e: any) {
      setContactsError(e?.message ?? "Error eliminando contacto");
    }
  }

  const disabled = loading || mutating || deleting;

  function startEdit() {
    if (!lead) return;
    setEditing(true);
    setDraft({
      nombre: lead.nombre ?? "",
      contacto: lead.contacto ?? "",
      score: lead.score ?? 0,
      score_categoria: lead.score_categoria ?? null,
      telefono: lead.telefono ?? "",
      email: lead.email ?? "",
      empresa_id: lead.empresa_id ?? null,
      comercial_id: lead.comercial_id ?? null,
      origen: lead.origen ?? "",
      pipeline: lead.pipeline ?? "Nuevo",
      notas: lead.notas ?? "",

      website: lead.website ?? "",
      objetivos: lead.objetivos ?? "",
      audiencia: lead.audiencia ?? "",
      tamano: lead.tamano ?? "",
      oferta: lead.oferta ?? "",
      linkedin_empresa: lead.linkedin_empresa ?? "",
      linkedin_personal: (lead.linkedin_personal ?? lead.linkedin_director ?? "") as string,
      meet_url: lead.meet_url ?? "",
    });
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setError(null);
    if (lead?.empresas) {
      const e = lead.empresas;
      setEntityForm({
        nombre: e.nombre ?? "",
        telefono: e.telefono ?? "",
        email: e.email ?? "",
        direccion: e.direccion ?? "",
        website: e.web ?? "",
        instagram: e.instagram ?? "",
        facebook: (e as { facebook?: string | null }).facebook ?? "",
        rubro: e.rubros?.nombre ?? "",
        celular: e.celular ?? "",
        rut: e.rut ?? "",
        ciudad: e.ciudad ?? "",
        pais: e.pais ?? "",
        contacto_celular: e.contacto_celular ?? "",
        contacto_email: e.contacto_email ?? "",
        etiquetas: e.etiquetas ?? "",
      });
    }
  }

  async function saveEdit() {
    // Validar que no se intente cambiar la etapa si el lead está cerrado
    if (draft.pipeline !== undefined && lead?.pipeline) {
      if (isLeadClosed(lead.pipeline)) {
        const newNorm = normalizePipelineForPolicy(draft.pipeline as string);
        const currentNorm = normalizePipelineForPolicy(lead.pipeline);
        if (newNorm !== currentNorm) {
          setError("Lead cerrado: no se puede cambiar la etapa desde un pipeline de cierre.");
          return;
        }
      }
    }

    await saveDraft();

    if (lead?.empresas?.id) {
      try {
        const empresaPayload = {
          nombre: entityForm.nombre.trim() || null,
          telefono: entityForm.telefono.trim() || null,
          email: entityForm.email.trim() || null,
          direccion: entityForm.direccion.trim() || null,
          web: entityForm.website.trim() || null,
          instagram: entityForm.instagram.trim() || null,
          facebook: entityForm.facebook.trim() || null,
          celular: entityForm.celular.trim() || null,
          rut: entityForm.rut.trim() || null,
          ciudad: entityForm.ciudad.trim() || null,
          pais: entityForm.pais.trim() || null,
          contacto_celular: entityForm.contacto_celular.trim() || null,
          contacto_email: entityForm.contacto_email.trim() || null,
          etiquetas: entityForm.etiquetas.trim() || null,
        };
        const res = await fetch(`/api/admin/empresas/${lead.empresas.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(empresaPayload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Error actualizando iniciativa");
        }
      } catch (e: any) {
        setError(e?.message ?? "Error guardando datos de iniciativa");
        return;
      }
    }

    setEditing(false);
    await fetchLead();
  }

  const pipelineValue = useMemo(() => {
    if (editing) return (draft.pipeline as any) ?? "Nuevo";
    return lead?.pipeline ?? "—";
  }, [editing, draft.pipeline, lead?.pipeline]);

  const title = loading ? "Cargando…" : lead?.nombre ?? "Lead";
  const leadIdSafe = (id ?? lead?.id ?? "").trim();

  const leadForAi = useMemo(() => {
    if (!lead) return null;

    const toArray = (value: unknown): string[] | null => {
      if (!value) return null;

      if (Array.isArray(value)) {
        return value.map(String).map(v => v.trim()).filter(Boolean);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed.split(",").map(v => v.trim()).filter(Boolean);
      }

      return null;
    };

    return {
      ...lead,
      objetivos: toArray(lead.objetivos),
      audiencia: toArray(lead.audiencia),
    };
  }, [lead]);

  // Website e Instagram: lead primero, fallback desde iniciativa vinculada (empresa)
  const websiteEffective = (lead?.website ?? "").trim() || (lead?.empresas?.web ?? "").trim() || "";
  const instagramEffective = (lead?.empresas?.instagram ?? "").trim() || "";
  const hasIniciativaVinculada = Boolean(lead?.empresa_id || lead?.empresas?.id);

  /** Lead Health Score (semáforo comercial) centralizado. */
  const leadHealth = useMemo(() => getLeadHealth(lead ?? null), [lead]);

  const setBreadcrumbSegment = useSetBreadcrumbSegment();
  useEffect(() => {
    if (!setBreadcrumbSegment) return;
    setBreadcrumbSegment(lead?.nombre?.trim() || "Detalle");
  }, [lead?.nombre, setBreadcrumbSegment]);

  /** Fecha "Activo desde" (created_at) formateada. */
  const activeFromLabel = useMemo(() => {
    const iso = lead?.created_at ?? lead?.updated_at;
    if (!iso) return "Fecha no disponible";
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "Fecha no disponible";
      const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
      const dateStr = d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
      return days <= 0 ? dateStr : `${dateStr} · ${days} días`;
    } catch {
      return "Fecha no disponible";
    }
  }, [lead?.created_at, lead?.updated_at]);

  const vendedorLabel = lead?.comercial?.nombre?.trim() ? lead.comercial.nombre : "Sin asignar";

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          {/* FILA 1 — Nombre del lead + línea secundaria (vendedor, activo desde, semáforo) */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900 break-words pr-4">{title}</h1>
            {lead?.is_member && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {labels.memberSingular}
                {lead.member_since && (
                  <span className="text-emerald-600">
                    desde {new Date(lead.member_since).toLocaleDateString("es-UY", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                )}
              </span>
            )}
            {/* Línea secundaria: vendedor, activo desde, estado del proceso */}
            {lead && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
                <span>
                  <span className="font-medium text-slate-500">Vendedor:</span>{" "}
                  {vendedorLabel}
                </span>
                <span>
                  <span className="font-medium text-slate-500">Activo desde:</span>{" "}
                  {activeFromLabel}
                </span>
                {leadHealth && (
                  <Tooltip
                    content={`${leadHealth.label}: ${leadHealth.reasons.join(". ")}`}
                    maxWidth="280px"
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-0.5 text-xs font-semibold ${
                        leadHealth.color === "green"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : leadHealth.color === "yellow"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          leadHealth.color === "green"
                            ? "bg-emerald-500"
                            : leadHealth.color === "yellow"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        aria-hidden
                      />
                      {leadHealth.label}
                    </span>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {/* FILA 2 — Jerarquía: (1) navegación tipo tabs · (2) acciones secundarias · (3) CTA comercial único */}
          <div className="space-y-4">
            <nav
              className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3"
              aria-label="Secciones del lead"
            >
              <button
                type="button"
                onClick={() => id && setDocsOpen(true)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 border ${
                  docsOpen
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                disabled={disabled || !id}
                title="Documentación PDF del lead"
              >
                Documentación
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                title="Meet Asistido (en pausa)"
              >
                Meet asistido
              </button>
              <button
                type="button"
                onClick={() => id && router.push(`/admin/leads/${id}?tab=consultor&section=services-proposal`)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 border ${
                  activeTab === "consultor" &&
                  (sectionFromUrl === "services-proposal" || sectionFromUrl === "proposal-export")
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                disabled={disabled || !id}
                title={
                  leadServices?.length || (lead as { proposal_draft_json?: string | null } | undefined)?.proposal_draft_json
                    ? "Abrir propuesta comercial del lead"
                    : "Abre el constructor de propuesta comercial del lead"
                }
              >
                Propuesta comercial
              </button>
              {visibleTabIds.includes("contactos") && (
                <button
                  type="button"
                  onClick={() => setActiveTab("contactos")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 border ${
                    activeTab === "contactos"
                      ? "border-blue-200 bg-blue-50 text-blue-900"
                      : "border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  disabled={disabled || !lead}
                  title="Ver y gestionar contactos del lead"
                >
                  Contactos
                </button>
              )}
              {visibleTabIds.includes("acciones") && (
                <button
                  type="button"
                  onClick={() => setActiveTab("acciones")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 border ${
                    activeTab === "acciones"
                      ? "border-blue-200 bg-blue-50 text-blue-900"
                      : "border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  disabled={disabled || !lead}
                  title="Ver acciones y seguimiento del lead"
                >
                  Acciones
                </button>
              )}
            </nav>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLead}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-none hover:bg-slate-50 disabled:opacity-50 transition"
                  disabled={disabled}
                >
                  Refrescar
                </button>
                {!editing ? (
                  canEditLead && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-none hover:bg-slate-50 disabled:opacity-50 transition"
                      disabled={disabled || !lead}
                    >
                      Editar
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-none hover:bg-slate-50 disabled:opacity-50 transition"
                      disabled={disabled}
                    >
                      Cancelar
                    </button>
                    {canEditLead && (
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-none hover:bg-slate-50 disabled:opacity-50 transition"
                        disabled={disabled}
                      >
                        Guardar
                      </button>
                    )}
                  </>
                )}
                {canDeleteThisLead && (
                  <button
                    type="button"
                    onClick={deleteLead}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-none hover:bg-red-50 disabled:opacity-50 transition"
                    disabled={disabled || !lead}
                    title="Eliminar lead"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {!lead?.is_member ? (
                <div className="flex shrink-0 items-center border-t border-slate-100 pt-3 sm:border-t-0 sm:border-l sm:border-slate-200 sm:pt-0 sm:pl-4">
                  <button
                    type="button"
                    onClick={convertToMember}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition sm:w-auto"
                    disabled={disabled || !lead}
                    title={`Convertir este lead en ${labels.memberSingular.toLowerCase()}`}
                  >
                    Convertir en {labels.memberSingular.toLowerCase()}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* FILA 3 — Selector de vista: Lista / Kanban / Ficha */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Vista de leads</p>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm">
              <Link
                href="/admin/leads"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow transition"
                title="Ver todos los leads en lista"
              >
                <List className="w-4 h-4 shrink-0" aria-hidden />
                Lista
              </Link>
              <Link
                href="/admin/leads/kanban"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow transition"
                title="Ver leads en tablero Kanban"
              >
                <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden />
                Kanban
              </Link>
              <span
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow border border-slate-200"
                title="Vista ficha del lead actual"
              >
                <FileText className="w-4 h-4 shrink-0 text-slate-600" aria-hidden />
                Ficha
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              <Link href="/admin/dashboard" className="text-slate-600 hover:text-slate-900 underline">
                Ver Dashboard Comercial
              </Link>
            </p>
          </div>
        </div>

          {notice && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {notice}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Flujo del proceso */}
          {lead && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Flujo del proceso</h2>
              <p className="mt-1 text-sm text-slate-600">
                Mapa de avance del lead dentro del proceso comercial, consultivo y de propuesta.
              </p>
              {(() => {
                const steps = flowSteps;
                const flowCurrent = currentFlowStep;
                const recommendedFlowStepId = flowCurrent?.id ?? null;

                type MicroState = "completado" | "pendiente_revision" | "siguiente_generar" | "bloqueado";
                function getStepMicroState(step: { id: string; status: "done" | "current" | "pending" }): MicroState {
                  if (step.status === "done") return "completado";
                  if (step.status === "current") return "siguiente_generar";
                  return "bloqueado";
                }
                const microStateLabels: Record<MicroState, string> = {
                  completado: "Completado",
                  pendiente_revision: "Pendiente de revisión",
                  siguiente_generar: "Siguiente a generar",
                  bloqueado: "Bloqueado",
                };

                return (
                  <>
                    <div className="mt-4 flex items-center gap-3 flex-wrap text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Completo
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-400 border border-amber-500" />
                        Pendiente de revisión
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                        Siguiente a generar
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                        Bloqueado
                      </span>
                    </div>
                    <div className="mt-4 flex flex-col md:flex-row md:items-start md:flex-nowrap overflow-x-auto pb-2 gap-4 md:gap-0">
                      {steps.map((step, index) => {
                        const microState = getStepMicroState(step);
                        const isRecommendedAction = recommendedFlowStepId === step.id;
                        return (
                          <div key={step.id} className="flex items-start gap-0 flex-shrink-0">
                            {index > 0 && (
                              <div className="hidden md:block flex-shrink-0 w-4 lg:w-6 h-0.5 mt-5 border-t-2 border-slate-200 self-center" aria-hidden />
                            )}
                            <div
                              className={`rounded-xl border p-3 w-[180px] md:min-w-[140px] md:max-w-[160px] ${getFlowStepClasses(step.status)} ${isRecommendedAction ? "ring-2 ring-blue-400 border-blue-300 shadow-sm" : ""}`}
                            >
                              {isRecommendedAction && (
                                <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 mb-1.5">
                                  Acción recomendada
                                </span>
                              )}
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    step.status === "done"
                                      ? "bg-green-600 text-white"
                                      : step.status === "current"
                                      ? "bg-amber-500 text-white"
                                      : "bg-slate-300 text-slate-600"
                                  }`}
                                >
                                  {step.status === "done" ? "✓" : step.status === "current" ? "•" : ""}
                                </span>
                                <span className="text-sm font-medium truncate">{step.label}</span>
                                {step.id === "presentacion" && step.status === "done" && (
                                  <span className="flex-shrink-0 text-sm opacity-80" title="Material listo para compartir" aria-hidden>📄</span>
                                )}
                              </div>
                              <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                                {microStateLabels[microState]}
                              </p>
                              <p className="mt-1 text-xs opacity-90 line-clamp-2">{step.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <h3 className="text-sm font-semibold text-slate-800">Siguiente paso recomendado</h3>
                      {flowCurrent ? (
                        (() => {
                          const flowStepId = flowCurrent.id;
                          const display = getNextStepDisplay(flowStepId, flowSignals);
                          const isPresentacion = flowStepId === "presentacion";
                          return (
                            <>
                              <p className="mt-1 text-sm text-slate-700">
                                Siguiente paso: <strong>{display.label}</strong>.
                              </p>
                              <p className="mt-2 text-xs text-slate-600 whitespace-pre-line">{display.description.trim()}</p>
                              {display.checklist.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-slate-600 mb-1.5">Checklist del paso</p>
                                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                                    {display.checklist.map((item, i) => (
                                      <li key={i}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {id && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {isPresentacion &&
                                  (commercialNext.primaryCtaIntent === "generate_presentation" ||
                                    commercialNext.primaryCtaIntent === "advance_close") ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        router.push(`/admin/leads87/${encodeURIComponent(id)}`)
                                      }
                                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                                    >
                                      {commercialNext.primaryCtaLabel}
                                    </button>
                                  ) : null}
                                  {isPresentacion && commercialNext.primaryCtaIntent === "closing_followup" ? (
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/admin/leads/${id}?tab=acciones`)}
                                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                                    >
                                      {commercialNext.primaryCtaLabel}
                                    </button>
                                  ) : null}
                                  {isPresentacion &&
                                  commercialNext.primaryCtaIntent !== "generate_presentation" &&
                                  commercialNext.primaryCtaIntent !== "advance_close" &&
                                  commercialNext.primaryCtaIntent !== "closing_followup" ? (
                                    presentationEmbedBlocked && presentationPrimaryUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          window.open(
                                            presentationPrimaryUrl,
                                            PRESENTATION_POPUP_NAME,
                                            PRESENTATION_POPUP_FEATURES
                                          )
                                        }
                                        className="inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
                                      >
                                        {display.cta}
                                      </button>
                                    ) : (
                                      <Link
                                        href={`/admin/leads/${id}/presentacion`}
                                        className="inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
                                      >
                                        {display.cta}
                                      </Link>
                                    )
                                  ) : null}
                                  {!isPresentacion ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        router.push(`/admin/leads/${id}?tab=${display.tab}&section=${display.section}`)
                                      }
                                      className="rounded-xl border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
                                    >
                                      {display.cta}
                                    </button>
                                  ) : null}
                                  {isPresentacion &&
                                  (commercialNext.primaryCtaIntent === "generate_presentation" ||
                                    commercialNext.primaryCtaIntent === "advance_close") ? (
                                    <Link
                                      href={`/admin/leads/${id}/presentacion`}
                                      className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      Vista presentación (clásica)
                                    </Link>
                                  ) : null}
                                </div>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        <p className="mt-1 text-sm text-slate-700">
                          El flujo principal del lead se encuentra completo.
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Separador y subnavegación del lead */}
          {lead && (
            <>
              <div className="mt-6 pt-4 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Áreas de trabajo del lead</p>
                <div className="inline-flex overflow-hidden rounded-xl border bg-white">
                  {workAreaTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 text-sm font-semibold transition ${
                        activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Etiqueta contextual cuando el tab activo es el recomendado para el paso actual */}
          {lead && displayStepId && recommendedTab && activeTab === recommendedTab && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="text-emerald-600" aria-hidden>◎</span>
              <p className="text-xs font-medium text-emerald-800">Zona recomendada para continuar</p>
            </div>
          )}

          {/* Indicador cuando se está en Contactos o Acciones (abiertos desde la barra superior) */}
          {lead && (activeTab === "contactos" || activeTab === "acciones") && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-600">
                Vista: {activeTab === "contactos" ? "Contactos" : "Acciones"}
              </p>
              <span className="text-slate-400 text-xs">· Usá las áreas de trabajo de abajo para cambiar de vista</span>
            </div>
          )}

          {/* Warning si no está vinculado a empresa */}
          {!hasIniciativaVinculada && activeTab === "datos" && (
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-yellow-900">
                    Este lead no está vinculado a una iniciativa
                  </div>
                  <div className="mt-1 text-xs text-yellow-700">
                    Vincula este lead a una iniciativa para acceder a sus datos completos.
                  </div>
                </div>
                {editing && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={empresaIdInput}
                      onChange={(e) => setEmpresaIdInput(e.target.value)}
                      placeholder="ID de empresa"
                      className="h-9 w-48 rounded-xl border border-yellow-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-yellow-200"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!empresaIdInput.trim()) return;
                        const empresaId = empresaIdInput.trim();
                        setDraft((p) => ({ ...p, empresa_id: empresaId || null }));
                        setEmpresaIdInput("");
                        // Guardar inmediatamente
                        // NOTA: Si empresaId está vacío, no enviamos empresa_id: null sin flag
                        // El usuario debería usar un botón específico para desvincular
                        try {
                          if (empresaId) {
                            // Vincular: enviar empresa_id con valor
                            await patchLead({ empresa_id: empresaId });
                          } else {
                            // Desvincular: requerir flag force_unlink_entity
                            // Por ahora, no permitimos desvincular desde este botón
                            setError("Para desvincular una empresa, contacta al administrador");
                            return;
                          }
                          await fetchLead();
                        } catch (e: any) {
                          setError(e?.message ?? "Error vinculando empresa");
                        }
                      }}
                      className="rounded-xl border border-yellow-300 bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-900 hover:bg-yellow-200"
                    >
                      Vincular
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contenido de Tabs */}
          {activeTab === "datos" && (
            <div id="lead-data-base" className="mt-5 grid grid-cols-1 gap-4">
              {/* Investigación Digital */}
              <div className="rounded-2xl border bg-white">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setInvestigacionOpen((v) => !v)}
                  onKeyDown={(e) => e.key === "Enter" && setInvestigacionOpen((v) => !v)}
                  className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900 flex items-center gap-2"
                >
                  <span className="text-slate-500">{investigacionOpen ? "▼" : "▶"}</span>
                  Investigación Digital
                </div>
                {investigacionOpen && (
                <div className="p-4">
                <div className="text-xs font-semibold text-slate-500 mb-3">Datos del lead (base)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre" editing={editing} value={editing ? (draft.nombre ?? lead?.nombre ?? "") : (lead?.nombre ?? "")} onChange={(v) => setDraft((p) => ({ ...p, nombre: v }))} />
                  <Field label="Contacto" editing={editing} value={editing ? (draft.contacto ?? lead?.contacto ?? "") : (lead?.contacto ?? "")} onChange={(v) => setDraft((p) => ({ ...p, contacto: v }))} />
                  <Field label="Teléfono" editing={editing} value={editing ? (draft.telefono ?? lead?.telefono ?? "") : (lead?.telefono ?? "")} onChange={(v) => setDraft((p) => ({ ...p, telefono: v }))} />
                  <Field label="Email" editing={editing} value={editing ? (draft.email ?? lead?.email ?? "") : (lead?.email ?? "")} onChange={(v) => setDraft((p) => ({ ...p, email: v }))} />
                  <Field label="Origen" editing={editing} value={editing ? (draft.origen ?? lead?.origen ?? "") : (lead?.origen ?? "")} onChange={(v) => setDraft((p) => ({ ...p, origen: v }))} />
                  <div>
                    <div className="text-xs text-slate-500">Etapa</div>
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {lead?.pipeline ?? "Nuevo"}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-500 mt-6 mb-3">Datos de Iniciativa</div>
                <div className="mt-3 space-y-3">
                  <Field
                    label="Nombre"
                    editing={editing}
                    value={editing ? entityForm.nombre : (lead?.empresas?.nombre ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, nombre: v }))}
                  />
                  <Field
                    label="Teléfono"
                    editing={editing}
                    value={editing ? entityForm.telefono : (lead?.empresas?.telefono ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, telefono: v }))}
                  />
                  <Field
                    label="Email"
                    editing={editing}
                    value={editing ? entityForm.email : (lead?.empresas?.email ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, email: v }))}
                  />
                  <Field
                    label="Rubro"
                    editing={editing}
                    value={editing ? entityForm.rubro : (lead?.empresas?.rubros?.nombre ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, rubro: v }))}
                  />
                  <Field
                    label="Dirección"
                    editing={editing}
                    value={editing ? entityForm.direccion : (lead?.empresas?.direccion ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, direccion: v }))}
                  />
                  <Field
                    label="Website"
                    editing={editing}
                    value={editing ? entityForm.website : (lead?.empresas?.web ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, website: v }))}
                  />
                  <Field
                    label="Instagram"
                    editing={editing}
                    value={editing ? entityForm.instagram : (lead?.empresas?.instagram ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, instagram: v }))}
                  />
                  <Field
                    label="Facebook"
                    editing={editing}
                    value={editing ? entityForm.facebook : ((lead?.empresas as { facebook?: string | null })?.facebook ?? "")}
                    onChange={(v) => setEntityForm((p) => ({ ...p, facebook: v }))}
                  />
                  {(editing || lead?.empresas?.celular) && (
                    <Field
                      label="Celular"
                      editing={editing}
                      value={editing ? entityForm.celular : (lead?.empresas?.celular ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, celular: v }))}
                    />
                  )}
                  {(editing || lead?.empresas?.rut) && (
                    <Field
                      label="RUT"
                      editing={editing}
                      value={editing ? entityForm.rut : (lead?.empresas?.rut ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, rut: v }))}
                    />
                  )}
                  {(editing || lead?.empresas?.ciudad) && (
                    <Field
                      label="Ciudad"
                      editing={editing}
                      value={editing ? entityForm.ciudad : (lead?.empresas?.ciudad ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, ciudad: v }))}
                    />
                  )}
                  {(editing || lead?.empresas?.pais) && (
                    <Field
                      label="País"
                      editing={editing}
                      value={editing ? entityForm.pais : (lead?.empresas?.pais ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, pais: v }))}
                    />
                  )}
                  {(editing || lead?.empresas?.contacto_celular) && (
                    <Field
                      label="Contacto (celular)"
                      editing={editing}
                      value={editing ? entityForm.contacto_celular : (lead?.empresas?.contacto_celular ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, contacto_celular: v }))}
                    />
                  )}
                  {(editing || lead?.empresas?.contacto_email) && (
                    <Field
                      label="Contacto (email)"
                      editing={editing}
                      value={editing ? entityForm.contacto_email : (lead?.empresas?.contacto_email ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, contacto_email: v }))}
                    />
                  )}
                  {(editing || lead?.empresas?.etiquetas) && (
                    <Field
                      label="Etiquetas"
                      editing={editing}
                      value={editing ? entityForm.etiquetas : (lead?.empresas?.etiquetas ?? "")}
                      onChange={(v) => setEntityForm((p) => ({ ...p, etiquetas: v }))}
                    />
                  )}
                </div>
                </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "comercial" && (
            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="rounded-xl border bg-white">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setEstadoComercialOpen((v) => !v)}
                  onKeyDown={(e) => e.key === "Enter" && setEstadoComercialOpen((v) => !v)}
                  className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900 flex items-center gap-2"
                >
                  <span className="text-slate-500">{estadoComercialOpen ? "▼" : "▶"}</span>
                  Estado Comercial
                </div>
                {estadoComercialOpen && (
                <div className="px-4 pb-4">
                  <div className="space-y-3">
                    {/* Score (0-10 estrellas) */}
                    <div className="rounded-xl border p-4">
                      <div className="text-xs font-semibold text-slate-600 mb-2">
                        Calidad del lead
                      </div>
                      {editing ? (
                        <StarRating
                          value={draft.score ?? null}
                          onChange={(v) => setDraft((p) => ({ ...p, score: v }))}
                          disabled={disabled}
                        />
                      ) : (
                        <>
                          {lead?.score !== null && lead?.score !== undefined ? (
                            <>
                              <StarRating
                                value={lead.score}
                                onChange={() => {}}
                                disabled={true}
                              />
                              {lead?.score_categoria && (
                                <div className="mt-1 text-xs text-slate-500">
                                  Categoría IA: {lead.score_categoria}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-slate-500">
                              Sin score IA
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Field
                      label="Origen"
                      editing={editing}
                      value={(editing ? (draft.origen as any) : lead?.origen) ?? ""}
                      onChange={(v) => setDraft((p) => ({ ...p, origen: v }))}
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Etapa</div>

                      {(() => {
                        const currentPipeline = (editing ? (draft.pipeline as any) : lead?.pipeline) ?? "Nuevo";
                        const isClosed = isLeadClosed(
                          typeof currentPipeline === "string" ? currentPipeline : String(currentPipeline ?? "")
                        );

                        return editing ? (
                          <>
                            <select
                              value={currentPipeline as string}
                              onChange={(e) => {
                                if (isClosed) {
                                  setError("Lead cerrado: no se puede cambiar la etapa desde un pipeline de cierre.");
                                  return;
                                }
                                setDraft((p) => ({ ...p, pipeline: e.target.value }));
                              }}
                              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                              disabled={mutating || loadingEtapas || isClosed}
                            >
                              <option value="Nuevo">Nuevo</option>
                              {etapas
                                .filter((x) => x !== "Nuevo")
                                .map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                            </select>
                            {isClosed && (
                              <div className="mt-1 text-xs text-amber-600">
                                Este lead está en un pipeline de cierre. No se puede cambiar la etapa.
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {(pipelineValue ?? lead?.pipeline ?? "Nuevo") || "Nuevo"}
                          </div>
                        );
                      })()}

                      {editing && loadingEtapas && (
                        <div className="mt-1 text-xs text-slate-500">Cargando etapas…</div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500">Comercial</div>
                      {editing ? (
                        <select
                          value={(draft.comercial_id as any) ?? ""}
                          onChange={(e) => setDraft((p) => ({ ...p, comercial_id: e.target.value || null }))}
                          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                          disabled={mutating || loadingComerciales}
                        >
                          <option value="">— Sin asignar —</option>
                          {comerciales.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {(() => {
                            const comercialId = lead?.comercial_id;
                            if (!comercialId) return "—";
                            const comercial = comerciales.find((c) => c.id === comercialId);
                            return comercial?.nombre ?? comercialId;
                          })()}
                        </div>
                      )}
                      {editing && loadingComerciales && (
                        <div className="mt-1 text-xs text-slate-500">Cargando comerciales…</div>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </div>

              <div className="rounded-xl border bg-white">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDatosLeadOpen((v) => !v)}
                  onKeyDown={(e) => e.key === "Enter" && setDatosLeadOpen((v) => !v)}
                  className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900 flex items-center gap-2"
                >
                  <span className="text-slate-500">{datosLeadOpen ? "▼" : "▶"}</span>
                  Datos del Lead
                </div>
                {datosLeadOpen && (
                <div className="px-4 pb-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs text-slate-500">Website</div>
                      {editing && !lead?.website?.trim() && lead?.empresas?.web?.trim() && (
                        <button
                          type="button"
                          onClick={async () => {
                            const empresaWeb = lead?.empresas?.web?.trim();
                            if (empresaWeb) {
                              setDraft((p) => ({ ...p, website: empresaWeb }));
                              try {
                                await patchLead({ website: empresaWeb });
                                await fetchLead();
                                flash("Website copiado desde Iniciativa.");
                              } catch (e: any) {
                                setError(e?.message ?? "Error copiando website");
                              }
                            }
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Copiar desde Iniciativa
                        </button>
                      )}
                    </div>
                    {editing ? (
                      <input
                        value={(draft.website as any) ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, website: e.target.value }))}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="https://..."
                      />
                    ) : (
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {websiteEffective ? (
                          <a
                            href={websiteEffective}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {websiteEffective}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Instagram</div>
                    <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {lead?.empresas?.instagram?.trim() ? (
                        <a
                          href={lead.empresas.instagram.startsWith("http") ? lead.empresas.instagram : `https://instagram.com/${lead.empresas.instagram.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {lead.empresas.instagram}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  {lead && linkedInModule.readiness?.status === "missing_schema" ? (
                    <ModuleReadinessPanel
                      moduleId="leads_linkedin_personal"
                      readiness={linkedInModule.readiness}
                      loading={linkedInModule.loading}
                      initializing={linkedinInitBusy}
                      onInitialize={handleLinkedinModuleInit}
                    />
                  ) : null}

                  {lead &&
                  linkedInModule.readiness?.status === "ok" &&
                  linkedInModule.readiness.details?.linkedinPersonalAvailable === false ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      <p className="font-medium">LinkedIn contacto (modo compatibilidad)</p>
                      <p className="mt-1 text-amber-900/90">
                        Falta la columna <span className="font-mono">linkedin_personal</span> en <span className="font-mono">leads</span>.
                        {linkedInModule.readiness.details?.fallbackLinkedinColumn ? (
                          <>
                            {" "}
                            Se usa <span className="font-mono">linkedin_director</span> para mostrar y guardar hasta migrar.
                          </>
                        ) : (
                          <> Ejecutá el SQL de inicialización del módulo para añadirla.</>
                        )}
                      </p>
                    </div>
                  ) : null}

                  <Field
                    label="LinkedIn Empresa"
                    editing={editing}
                    value={(editing ? (draft.linkedin_empresa as any) : lead?.linkedin_empresa) ?? ""}
                    onChange={(v) => setDraft((p) => ({ ...p, linkedin_empresa: v }))}
                    placeholder="https://linkedin.com/..."
                  />
                  <Field
                    label="LinkedIn contacto"
                    editing={editing}
                    value={
                      (editing
                        ? (draft.linkedin_personal as any)
                        : (lead?.linkedin_personal ?? lead?.linkedin_director)) ?? ""
                    }
                    onChange={(v) => setDraft((p) => ({ ...p, linkedin_personal: v }))}
                    placeholder="https://linkedin.com/..."
                  />

                  <div>
                    <div className="text-xs text-slate-500">Objetivo</div>
                    {editing ? (
                      <textarea
                        value={(draft.objetivos as any) ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, objetivos: e.target.value }))}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Ej: Abrir mercado USA, conseguir distribuidores, networking, visibilidad..."
                      />
                    ) : (
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                        {(lead?.objetivos ?? "").trim() || "—"}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">¿Ya es cliente de la Agencia?</div>
                    {editing ? (
                      <textarea
                        value={(draft.audiencia as any) ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, audiencia: e.target.value }))}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Sí / No / En proceso..."
                      />
                    ) : (
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                        {(lead?.audiencia ?? "").trim() || "—"}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Tamaño</div>
                    {editing ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {leadOptions.tamanios.map((opt) => {
                          const active = ((draft.tamano as any) ?? "") === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({ ...p, tamano: active ? "" : opt }))
                              }
                              className={[
                                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                                active
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-slate-700 hover:bg-slate-50",
                              ].join(" ")}
                              aria-pressed={active}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {(lead?.tamano ?? "").trim() || "—"}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">
                      Notas de prensa e info adicional.
                    </div>
                    {editing ? (
                      <textarea
                        value={(draft.oferta as any) ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, oferta: e.target.value }))}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Ej: descuentos, expertise, charlas, referrals, partnership…"
                      />
                    ) : (
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                        {(lead?.oferta ?? "").trim() || "—"}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Notas</div>
                    {editing ? (
                      <textarea
                        value={(draft.notas as any) ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, notas: e.target.value }))}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        rows={5}
                        placeholder="Notas internas…"
                      />
                    ) : (
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                        {(lead?.notas ?? "").trim() || "—"}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>

              {/* ✅ Creado / Actualizado fijo */}
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div className="rounded-xl border bg-white px-3 py-2">
                  <div className="font-semibold">Creado</div>
                  <div className="mt-1">
                    {formatDateTime(lead?.created_at ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border bg-white px-3 py-2">
                  <div className="font-semibold">Actualizado</div>
                  <div className="mt-1">
                    {formatDateTime(lead?.updated_at ?? null)}
                  </div>
                </div>
              </div>

              {/* PROCESO COMERCIAL — pipeline de 6 pasos */}
              <div id="proceso-comercial" className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                <Tooltip content="Flujo consultivo: Análisis del lead (IA) → Diagnóstico comercial → Estrategia → Estructura de servicios → Propuesta comercial → Presentación para el cliente." maxWidth="340px">
                  <h2 className="text-xl font-semibold text-slate-900 inline-block cursor-help">Proceso comercial</h2>
                </Tooltip>
                <p className="mt-1 text-sm text-slate-600">
                  Seis pasos para llevar el lead desde el análisis interno hasta la presentación final para el cliente.
                </p>
                {commercialDocError && (
                  <p className="mt-2 text-sm text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    {commercialDocError}
                  </p>
                )}

                {/* BLOQUE 1 — Barra de progreso (lineal: completados = pasos anteriores al actual; paso 6 cierra con presentación archivada o cierre) */}
                {(() => {
                  const completed =
                    currentStep < 6
                      ? Math.max(0, currentStep - 1)
                      : step6Done
                        ? 6
                        : 5;
                  return (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="text-xs font-medium text-slate-600">
                        Progreso: {completed} de 6 pasos
                      </span>
                      <div className="h-2 flex-1 min-w-[120px] max-w-[240px] rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${(completed / 6) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* BLOQUE 1 — Tarjetas de pasos 1–6 */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {([
                    { n: 1, label: "Análisis", tip: "Análisis del lead con IA. Entrada: datos del lead. Salida: informe interno que alimenta diagnóstico y estrategia." },
                    { n: 2, label: "Diagnóstico", tip: "Documento consultivo del diagnóstico. Usa el análisis interno. Salida: diagnóstico listo para presentar al lead." },
                    { n: 3, label: "Estrategia", tip: "Visión estratégica de crecimiento. Usa el diagnóstico. Salida: documento de estrategia o confirmación en LEADS87." },
                    { n: 4, label: "Estructura", tip: "Estructura de servicios y costos. Se define en Consultor. Base económica de la propuesta." },
                    { n: 5, label: "Propuesta final", tip: "Propuesta comercial y documento final para el cliente. Revisar, compartir y marcar envío." },
                    {
                      n: 6,
                      label: "Presentación",
                      tip: "Presentación comercial archivada para el cliente y cierre de etapa (LEADS87 paso 6).",
                    },
                  ] as const).map(({ n, label, tip }) => {
                    const done =
                      n === 6 ? step6Done : isStepDone(n as CommercialStep, currentStep);
                    const actual =
                      n === 6 ? currentStep === 6 && !step6Done : isStepActual(n as CommercialStep, currentStep);
                    return (
                      <Tooltip key={n} content={tip} maxWidth="300px">
                        <div
                          className={`rounded-lg border-2 px-3 py-2 min-w-[100px] text-center cursor-help ${
                            done ? "border-emerald-200 bg-emerald-50/70" : actual ? "border-emerald-400 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"
                          }`}
                        >
                          <span className="text-xs font-semibold text-slate-700">Paso {n}</span>
                          <p className="text-xs font-medium text-slate-800 mt-0.5">{label}</p>
                          <p className="text-[10px] mt-0.5 text-slate-500">{done ? "Completado ✓" : actual ? "Actual" : "Bloqueado"}</p>
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* BLOQUE 2 — Paso actual / acción principal */}
                <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4">
                  {currentStep === 1 && !hasAnalysisInternal && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Paso actual</p>
                  )}
                  {(currentStep > 1 || hasAnalysisInternal) && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Siguiente paso recomendado</p>
                  )}
                  {currentStep > 1 && (
                    <p className="mt-0.5 text-xs font-medium text-emerald-700">Paso {currentStep - 1} completado ✓</p>
                  )}
                  <p className="mt-1 text-sm font-semibold text-slate-900">{nextStepConfig.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{nextStepConfig.description}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Qué obtiene:{" "}
                    {currentStep === 1 && "Informe interno del lead que servirá de base para diagnóstico y estrategia."}
                    {currentStep === 2 && "Documento consultivo del diagnóstico listo para presentar al lead."}
                    {currentStep === 3 && "Documento de visión estratégica que conecta diagnóstico con el plan de crecimiento."}
                    {currentStep === 4 && "Tabla de servicios, alcance y costos definida en Consultor (base de la propuesta)."}
                    {currentStep === 5 && "Documento final para compartir con el cliente, descargar PDF y marcar como enviada."}
                    {currentStep === 6 &&
                      "Presentación comercial archivada y cierre de etapa alineado con LEADS87 (sin recomendar estrategia si ya está aprobada)."}
                  </p>
                  <div className="mt-3">
                    {currentStep === 1 && (
                      <Tooltip content="Crea el análisis interno del lead con IA. Este resultado alimenta el diagnóstico comercial y la estrategia. Abre las herramientas del paso 1 para ejecutarlo." maxWidth="320px">
                        <span className="inline-block">
                          <button
                            type="button"
                            onClick={() => { const wrapper = document.getElementById("ia-report-block"); wrapper?.scrollIntoView({ behavior: "smooth" }); const details = wrapper?.querySelector("details"); if (details instanceof HTMLDetailsElement) details.setAttribute("open", "open"); }}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700"
                          >
                            {nextStepConfig.ctaLabel}
                          </button>
                        </span>
                      </Tooltip>
                    )}
                    {currentStep === 2 && (
                      <Tooltip content="Genera el documento comercial del Paso 2. Este archivo presenta el diagnóstico consultivo del lead de forma clara y profesional." maxWidth="300px">
                        <span className="inline-block">
                          <button
                            type="button"
                            onClick={() => generateCommercialDoc("diagnostic")}
                            disabled={!id || commercialDocLoading !== null}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700 disabled:opacity-50 disabled:animate-none"
                          >
                            {commercialDocLoading === "diagnostic" ? "Generando…" : nextStepConfig.ctaLabel}
                          </button>
                        </span>
                      </Tooltip>
                    )}
                    {currentStep === 3 && (
                      <Tooltip content="Genera el documento de estrategia de crecimiento a partir del diagnóstico y la información disponible del lead." maxWidth="300px">
                        <span className="inline-block">
                          <button
                            type="button"
                            onClick={() => generateCommercialDoc("strategy")}
                            disabled={!id || commercialDocLoading !== null || !hasDiagnosticGenerated}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700 disabled:opacity-50 disabled:animate-none"
                          >
                            {commercialDocLoading === "strategy" ? "Generando…" : nextStepConfig.ctaLabel}
                          </button>
                        </span>
                      </Tooltip>
                    )}
                    {currentStep === 4 && id && (
                      <Tooltip content="Lleva al tab Consultor para definir la tabla de servicios, alcance y costos. Es la base económica de la propuesta comercial." maxWidth="320px">
                        <span className="inline-block">
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/leads/${id}?tab=consultor&section=services-proposal`)}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700"
                          >
                            {nextStepConfig.ctaLabel}
                          </button>
                        </span>
                      </Tooltip>
                    )}
                    {currentStep === 5 && (
                      <span className="inline-block flex flex-wrap items-center gap-2">
                        {commercialNext.primaryCtaIntent === "proposal_review" && id ? (
                          <Tooltip
                            content="Confirmá la revisión de la propuesta en LEADS87 para habilitar la presentación comercial."
                            maxWidth="320px"
                          >
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/leads87/${encodeURIComponent(id)}`)}
                              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
                            >
                              {nextStepConfig.ctaLabel}
                            </button>
                          </Tooltip>
                        ) : !commercialDocUrls.proposal ? (
                          <Tooltip content="Genera la propuesta comercial final con servicios, inversión y condiciones para presentar al cliente." maxWidth="300px">
                            <button
                              type="button"
                              onClick={() => generateCommercialDoc("proposal")}
                              disabled={!id || commercialDocLoading !== null || !hasStrategyGenerated}
                              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 disabled:animate-none"
                            >
                              {commercialDocLoading === "proposal" ? "Generando…" : nextStepConfig.ctaLabel}
                            </button>
                          </Tooltip>
                        ) : null}
                        <Tooltip content="Baja al bloque del Paso 5 para ver la propuesta, descargar PDF o marcar como enviada." maxWidth="280px">
                          <button
                            type="button"
                            onClick={() => document.getElementById("bloque-paso-5")?.scrollIntoView({ behavior: "smooth" })}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Ir al bloque del paso 5
                          </button>
                        </Tooltip>
                      </span>
                    )}
                    {currentStep === 6 && id && (
                      <span className="inline-block flex flex-wrap items-center gap-2">
                        {commercialNext.primaryCtaIntent === "closing_followup" ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/leads/${id}?tab=acciones`)}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
                          >
                            {nextStepConfig.ctaLabel}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/leads87/${encodeURIComponent(id)}`)}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
                          >
                            {nextStepConfig.ctaLabel}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/leads/${id}?tab=consultor&section=proposal-export`)}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Abrir Consultor — propuesta
                        </button>
                      </span>
                    )}
                  </div>
                </div>

                {/* BLOQUE 3 — Después de esto sigue… */}
                {currentStep < 6 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <p className="text-xs font-semibold text-slate-600">Después de esto sigue</p>
                    <p className="mt-0.5 text-sm text-slate-700">
                      {currentStep === 1 && "Paso 2: Diagnóstico comercial — documento consultivo para presentar al lead."}
                      {currentStep === 2 && "Paso 3: Estrategia de crecimiento — visión estratégica que conecta diagnóstico con el plan."}
                      {currentStep === 3 && "Paso 4: Estructura de servicios — tabla de servicios y costos en el tab Consultor."}
                      {currentStep === 4 && "Paso 5: Propuesta final para cliente — documento integral, compartir y marcar envío."}
                      {currentStep === 5 && "Paso 6: Presentación comercial — generá y archivá la presentación en LEADS87 (recomendado)."}
                    </p>
                  </div>
                )}

                {/* Bloque único de cierre: Paso 5 — Propuesta final para cliente (ver documento, descargar PDF, marcar enviada) */}
                {(currentStep === 5 || (currentStep === 6 && Boolean(commercialDocUrls.proposal?.trim()))) && id && (
                  <div id="bloque-paso-5" className="mt-4 rounded-xl border-2 border-slate-300 bg-slate-50/80 p-4">
                    <h3 className="text-base font-semibold text-slate-900">Paso 5 — Propuesta final para cliente</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Revisá la propuesta, compartí el documento final con el cliente y marcá como enviada cuando corresponda.
                    </p>
                    {(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at && (
                      <p className="mt-2 text-sm font-medium text-emerald-700">Propuesta confirmada ✔</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(lead as { proposal_sent_at?: string | null } | undefined)?.proposal_sent_at && (
                        <div className="flex flex-col gap-0.5">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Propuesta enviada ✔</span>
                          <p className="text-xs text-slate-600">
                            Propuesta enviada al cliente el {formatDateTime((lead as { proposal_sent_at?: string | null }).proposal_sent_at)}.
                          </p>
                        </div>
                      )}
                      {commercialDocUrls.proposal && (
                        <>
                          <Tooltip content="Abre la propuesta comercial en nueva pestaña." maxWidth="280px">
                            <a
                              href={commercialDocUrls.proposal}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                              Ver propuesta comercial
                            </a>
                          </Tooltip>
                          {isPdfUrl(commercialDocUrls.proposal) &&
                            (typeof window !== "undefined" && isSameOriginPdfUrl(commercialDocUrls.proposal, window.location.origin) ? (
                              <Tooltip content="Descarga el PDF de la propuesta." maxWidth="280px">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPdf(commercialDocUrls.proposal!, "propuesta-comercial.pdf")}
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Descargar PDF
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip content="Abre el PDF en el navegador (documento externo)." maxWidth="280px">
                                <a
                                  href={commercialDocUrls.proposal}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Abrir PDF
                                </a>
                              </Tooltip>
                            ))}
                        </>
                      )}
                      {!(lead as { proposal_sent_at?: string | null } | undefined)?.proposal_sent_at && (
                        <Tooltip content="Registra que la propuesta fue enviada al cliente y comienza la etapa de seguimiento." maxWidth="320px">
                          <button
                            type="button"
                            onClick={handleMarkProposalSent}
                            disabled={proposalSentSaving}
                            className="inline-flex items-center justify-center rounded-lg border-2 border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {proposalSentSaving ? "Guardando…" : "Marcar como enviada al cliente"}
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )}

                {/* BLOQUE 4 — Herramientas avanzadas (colapsado por defecto) */}
                <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50">
                  <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                    <Tooltip content="Abre herramientas por paso: informe IA, diagnóstico, estrategia, exportación PDF, copiar texto, prompt en uso y acciones secundarias." maxWidth="320px">
                      <span className="inline-block">▼ Ver herramientas avanzadas de este flujo</span>
                    </Tooltip>
                  </summary>
                  <div className="mt-2 space-y-4 px-0">
                    <div id="ia-report-block">
                      {activeTab === "comercial" && sectionFromUrl === "ia-report-block" && processStepContext && (
                        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Proceso comercial</p>
                          <h3 className="mt-1 text-lg font-semibold text-slate-900">{processStepContext.title}</h3>
                          <p className="mt-1.5 text-sm text-slate-600">{processStepContext.description}</p>
                          <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-slate-600">Después sigue: {processStepContext.nextStep}</p>
                        </div>
                      )}
                      <details className="rounded-lg border border-slate-200 bg-white mx-0">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Tooltip content="Generar análisis con IA, ver informe comercial, editar prompt y exportar. Todo lo del paso 1 en un solo lugar." maxWidth="300px">
                        <span className="inline-block">▼ Herramientas del Paso 1 — Análisis del Lead (IA)</span>
                      </Tooltip>
                    </summary>
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                      {allowedProfiles.includes("comercial") && (
                        <AiLeadReport
                          key={`ai-comercial-${leadIdSafe}`}
                          leadId={leadIdSafe}
                          lead={leadForAi as any}
                          allowedProfiles={["comercial"]}
                          initialProfile="comercial"
                          onBeforeGenerate={async () => await saveDraft()}
                          onPromptSaved={fetchLead}
                          onPresentationSignalChange={(signals) => setPresentationSignals((prev) => ({ ...prev, ...signals }))}
                          titleLabel="Análisis interno del lead (IA)"
                          subtitleLabel="Este análisis interno genera la base técnica y estratégica que alimenta el diagnóstico comercial."
                          buttonHelperText="Usa IA para analizar el lead, detectar oportunidades y preparar el contenido base del diagnóstico."
                          buttonTooltipContent="Ejecuta el análisis interno con IA. Este proceso no reemplaza el diagnóstico comercial: lo prepara y lo alimenta."
                        />
                      )}
                    </div>
                  </details>
                  </div>
                  <details className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Tooltip content="Documentos de diagnóstico y visión estratégica (pasos 2 y 3). En todos: Ver, Descargar, Copiar." maxWidth="300px">
                        <span className="inline-block">▼ Herramientas del Paso 2 y 3 — Diagnóstico y Estrategia</span>
                      </Tooltip>
                    </summary>
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-4">
                      {documentVersionSummaries.length > 0 && (
                        <details className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-2 py-2">
                          <summary className="cursor-pointer select-none text-xs font-medium text-slate-600">
                            Historial de versiones en CRM
                            {hasMultipleDocumentVersions ? " (varias versiones por tipo)" : ""}
                          </summary>
                          <p className="mt-1.5 text-[11px] text-slate-500">
                            Los enlaces de arriba siempre apuntan a la versión vigente. Aquí se listan todas las filas
                            guardadas por tipo (auditoría).
                          </p>
                          <ul className="mt-2 max-h-40 overflow-auto text-[11px] text-slate-600 space-y-1">
                            {documentVersionSummaries.map((row, idx) => {
                              const label =
                                row.type === "diagnostic"
                                  ? "Diagnóstico"
                                  : row.type === "strategy"
                                    ? "Estrategia"
                                    : row.type === "proposal"
                                      ? "Propuesta"
                                      : row.type === "presentation"
                                        ? "Presentación"
                                        : row.type;
                              const when = row.created_at ? new Date(row.created_at).toLocaleString() : "—";
                              return (
                                <li key={`${row.type}-${row.version_number}-${idx}`}>
                                  <span className="font-medium">{label}</span> · v{row.version_number}
                                  {row.is_current ? " · vigente" : ""}
                                  {row.status ? ` · ${row.status}` : ""} · {when}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      )}
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Diagnóstico comercial</p>
                        <div className="flex flex-wrap gap-2">
                          {commercialDocUrls.diagnostic ? (
                            <Tooltip content="Abre el documento generado para revisión." maxWidth="260px">
                              <a href={commercialDocUrls.diagnostic} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ver diagnóstico comercial
                              </a>
                            </Tooltip>
                          ) : null}
                          {commercialDocUrls.diagnostic && isPdfUrl(commercialDocUrls.diagnostic)
                            ? (typeof window !== "undefined" && isSameOriginPdfUrl(commercialDocUrls.diagnostic, window.location.origin) ? (
                                <Tooltip content="Descarga el PDF ya generado del documento." maxWidth="260px">
                                  <button type="button" onClick={() => handleDownloadPdf(commercialDocUrls.diagnostic!, "diagnostico-comercial.pdf")} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                    Descargar PDF diagnóstico comercial
                                  </button>
                                </Tooltip>
                              ) : (
                                <Tooltip content="Abre el PDF en el navegador (documento externo)." maxWidth="260px">
                                  <a href={commercialDocUrls.diagnostic} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                    Abrir PDF diagnóstico comercial
                                  </a>
                                </Tooltip>
                              ))
                            : id ? (
                            <Tooltip content="Abre el área correspondiente para generar el PDF del documento." maxWidth="260px">
                              <Link href={`/admin/leads/${id}?tab=comercial&section=ia-report-block`} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ir a generar PDF
                              </Link>
                            </Tooltip>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Visión estratégica</p>
                        <div className="flex flex-wrap gap-2">
                          {commercialDocUrls.strategy ? (
                            <Tooltip content="Abre el documento generado para revisión." maxWidth="260px">
                              <a href={commercialDocUrls.strategy} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ver visión estratégica
                              </a>
                            </Tooltip>
                          ) : null}
                          {commercialDocUrls.strategy && isPdfUrl(commercialDocUrls.strategy)
                            ? (typeof window !== "undefined" && isSameOriginPdfUrl(commercialDocUrls.strategy, window.location.origin) ? (
                                <Tooltip content="Descarga el PDF ya generado del documento." maxWidth="260px">
                                  <button type="button" onClick={() => handleDownloadPdf(commercialDocUrls.strategy!, "vision-estrategica.pdf")} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                    Descargar PDF visión estratégica
                                  </button>
                                </Tooltip>
                              ) : (
                                <Tooltip content="Abre el PDF en el navegador (documento externo)." maxWidth="260px">
                                  <a href={commercialDocUrls.strategy} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                    Abrir PDF visión estratégica
                                  </a>
                                </Tooltip>
                              ))
                            : id ? (
                            <Tooltip content="Abre el área correspondiente para generar el PDF del documento." maxWidth="260px">
                              <Link href={`/admin/leads/${id}?tab=comercial&section=ia-report-block`} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ir a generar PDF
                              </Link>
                            </Tooltip>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </details>
                  <details className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Tooltip content="Estado de propuesta confirmada, material final y acciones: PDF, copiar texto, CTAs para el cliente." maxWidth="320px">
                        <span className="inline-block">▼ Herramientas del Paso 4, 5 y 6 — Estructura, Propuesta y Presentación</span>
                      </Tooltip>
                    </summary>
                    <div className="border-t border-slate-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Propuesta confirmada</span>
                      )}
                      {hasOfficialArchivedPresentation && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          Presentación archivada en el CRM
                        </span>
                      )}
                    </div>
                    {typeof process !== "undefined" && process.env.NODE_ENV === "development" && (
                      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-600">
                        <summary className="cursor-pointer font-medium">Preview payload (solo desarrollo)</summary>
                        <div className="mt-2 space-y-1 pl-2">
                          <p>Meses: {proposalExportPayload.monthlyTable?.months.length ?? 0}</p>
                          <p>Total general: {proposalExportPayload.monthlyTable?.grandTotal?.toLocaleString("es-UY") ?? "—"}</p>
                        </div>
                      </details>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {commercialDocUrls.proposal ? (
                        <Tooltip content="Abre el documento generado para revisión." maxWidth="280px">
                          <a href={commercialDocUrls.proposal} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            Ver propuesta comercial
                          </a>
                        </Tooltip>
                      ) : null}
                      {commercialDocUrls.proposal && isPdfUrl(commercialDocUrls.proposal)
                        ? (typeof window !== "undefined" && isSameOriginPdfUrl(commercialDocUrls.proposal, window.location.origin) ? (
                            <Tooltip content="Descarga el PDF ya generado del documento." maxWidth="280px">
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(commercialDocUrls.proposal!, "propuesta-comercial.pdf")}
                                className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Descargar PDF propuesta comercial
                              </button>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Abre el PDF en el navegador (documento externo)." maxWidth="280px">
                              <a href={commercialDocUrls.proposal} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Abrir PDF propuesta comercial
                              </a>
                            </Tooltip>
                          ))
                        : id ? (
                        <Tooltip content="Abre el área correspondiente para generar el PDF del documento." maxWidth="280px">
                          <Link href={`/admin/leads/${id}?tab=comercial&section=ia-report-block`} className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            Ir a generar PDF
                          </Link>
                        </Tooltip>
                      ) : null}
                      {hasAnalysisInternal && (
                        <Tooltip content="Copia el contenido textual del informe (base de la propuesta)." maxWidth="280px">
                          <button
                            type="button"
                            onClick={() => {
                              const text = (lead as { ai_report?: string | null })?.ai_report;
                              if (typeof text === "string" && text.trim()) {
                                void navigator.clipboard.writeText(text.trim());
                                setCopiedWhich("informe-paso46");
                              }
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {copiedWhich === "informe-paso46" ? "Copiado" : "Copiar informe"}
                          </button>
                        </Tooltip>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <ProposalClientActions showPrint={false} proposalDocumentUrl={commercialDocUrls.proposal ?? null} />
                    </div>
                    </div>
                  </details>
                  </div>
                </details>

              </div>
            </div>
          )}

          {activeTab === "tecnico" && (
            <div className="mt-5 grid grid-cols-1 gap-4">
              {allowedProfiles.includes("tecnico") ? (
                <details className="rounded-2xl border bg-white">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
                    IA — Informe técnico
                  </summary>
                  <div className="px-4 pb-4">
                    <AiLeadReport
                      key={`ai-tecnico-${leadIdSafe}`}
                      leadId={leadIdSafe}
                      lead={leadForAi as any}
                      allowedProfiles={["tecnico"]}
                      initialProfile="tecnico"
                      onBeforeGenerate={async () => {
                        await saveDraft();
                      }}
                      onPromptSaved={fetchLead}
                      onPresentationSignalChange={(signals) =>
                        setPresentationSignals((prev) => ({ ...prev, ...signals }))
                      }
                    />
                  </div>
                </details>
              ) : (
                <div className="rounded-2xl border bg-white p-6">
                  <div className="text-sm font-semibold text-slate-900 mb-2">Bloque técnico</div>
                  <p className="text-sm text-slate-600">
                    Aquí se integrará el contenido técnico (auditoría, métricas, roadmap) para el lead.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "consultor" && (
            <div className="mt-5 grid grid-cols-1 gap-6">
              {/* Documentos de respaldo (análisis interno) */}
              <div className="space-y-6">
                {/* BLOQUE B — Informe comercial (documento interno CRM: ai_report). Generar/Regenerar → tab Comercial; Ver/Copiar cuando hay contenido; contenido colapsado por defecto. */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Informe comercial</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Documento de respaldo con análisis comercial, investigación digital, FODA, oportunidades, acciones y plan de avance.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Incluye: investigación digital, redes, posicionamiento, competencia, FODA, oportunidades, acciones 72h, plan 30–90 días.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {id && (
                      <Tooltip content={hasAnalysisInternal ? "Ir al paso de análisis con IA para regenerar el informe." : "Ir al paso de análisis con IA para generar el informe."} maxWidth="280px">
                        <button
                          type="button"
                          onClick={() => {
                            if (!lead?.id) return;
                            window.location.href = `/admin/leads/${lead.id}?tab=comercial&section=ia-report-block`;
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {hasAnalysisInternal ? "Regenerar informe comercial" : "Generar informe comercial"}
                        </button>
                      </Tooltip>
                    )}
                    {hasAnalysisInternal && (
                      <Tooltip content={showCommercialReport ? "Oculta el contenido del informe." : "Muestra el contenido del informe debajo."} maxWidth="280px">
                        <button
                          type="button"
                          onClick={() => setShowCommercialReport((v) => !v)}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {showCommercialReport ? "Ocultar informe comercial" : "Ver informe comercial"}
                        </button>
                      </Tooltip>
                    )}
                    {hasAnalysisInternal && (
                      <Tooltip content="Copia el contenido textual del informe al portapapeles." maxWidth="280px">
                        <button
                          type="button"
                          onClick={async () => {
                            const text = (lead as { ai_report?: string | null })?.ai_report;
                            if (typeof text !== "string" || !text.trim()) return;
                            try {
                              await navigator.clipboard.writeText(text.trim());
                              setCopiedWhich("informe");
                            } catch {
                              setNotice("No se pudo copiar al portapapeles.");
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {copiedWhich === "informe" ? "Copiado" : "Copiar informe comercial"}
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {showCommercialReport && hasAnalysisInternal && (() => {
                    const SUBTITLE_KEYS = ["Fortalezas", "Debilidades", "Oportunidades", "Amenazas", "Siguientes pasos", "LA JUGADA MÁS RENTABLE", "Resumen", "Conclusiones"];
                    const renderReportContent = (content: string) => {
                      return (
                        <div className="space-y-2 text-sm text-slate-700">
                          {content.split(/\n\n+/).map((block, i) => {
                            const trimmed = block.trim();
                            if (!trimmed) return null;
                            const isSubtitle = SUBTITLE_KEYS.some((k) => trimmed === k || trimmed.startsWith(k + ":") || trimmed.startsWith(k + "\n"));
                            const firstLine = trimmed.split("\n")[0] ?? "";
                            const isList = /^[\s]*[-*•]\s/.test(trimmed) || /^[\s]*\d+[.)]\s/.test(trimmed);
                            if (isSubtitle || SUBTITLE_KEYS.some((k) => firstLine === k)) {
                              return (
                                <p key={i} className="mt-3 font-semibold text-slate-800">
                                  {trimmed}
                                </p>
                              );
                            }
                            if (isList) {
                              const items = trimmed.split(/\n/).filter((l) => l.trim());
                              return (
                                <ul key={i} className="list-disc pl-5 space-y-1">
                                  {items.map((line, j) => (
                                    <li key={j}>{line.replace(/^[\s]*[-*•]\s|^\d+[.)]\s/, "").trim()}</li>
                                  ))}
                                </ul>
                              );
                            }
                            return (
                              <p key={i} className="whitespace-pre-wrap">
                                {trimmed}
                              </p>
                            );
                          })}
                        </div>
                      );
                    };
                    const { intro, sections } = commercialReportSections;
                    return (
                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-6">
                        {intro ? <div className="text-sm text-slate-700 whitespace-pre-wrap">{intro}</div> : null}
                        {sections.map(({ id, label, Icon, content }) => (
                          <div key={id} className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Icon className="h-4 w-4 text-slate-500 shrink-0" />
                              <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                            </div>
                            {content ? renderReportContent(content) : null}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* BLOQUE C — Visión estratégica. Generar/Regenerar = gamma strategy; Ver/Copiar cuando hay contenido; contenido colapsado por defecto. */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Visión estratégica</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Documento ejecutivo complementario para presentar una lectura más global del negocio, sus oportunidades y la dirección estratégica recomendada.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Incluye: lectura global, oportunidades de crecimiento, foco estratégico, riesgos, dirección recomendada.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {id && (
                      <Tooltip content={hasStrategicVisionText || commercialDocUrls.strategy ? "Vuelve a generar el documento de visión estratégica (Gamma)." : "Genera el documento de visión estratégica con Gamma."} maxWidth="280px">
                        <button
                          type="button"
                          onClick={() => generateCommercialDoc("strategy")}
                          disabled={commercialDocLoading === "strategy"}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {commercialDocLoading === "strategy" ? "Generando…" : (hasStrategicVisionText || commercialDocUrls.strategy ? "Regenerar visión estratégica" : "Generar visión estratégica")}
                        </button>
                      </Tooltip>
                    )}
                    {hasStrategicVisionText && (
                      <Tooltip content={showStrategicVision ? "Oculta el contenido." : "Muestra el contenido debajo."} maxWidth="280px">
                        <button
                          type="button"
                          onClick={() => setShowStrategicVision((v) => !v)}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {showStrategicVision ? "Ocultar visión estratégica" : "Ver visión estratégica"}
                        </button>
                      </Tooltip>
                    )}
                    {hasStrategicVisionText && (
                      <Tooltip content="Copia el contenido al portapapeles." maxWidth="280px">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!strategicVisionText) return;
                            try {
                              await navigator.clipboard.writeText(strategicVisionText);
                              setCopiedWhich("vision");
                            } catch {
                              setNotice("No se pudo copiar al portapapeles.");
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {copiedWhich === "vision" ? "Copiado" : "Copiar visión estratégica"}
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {showStrategicVision && hasStrategicVisionText && (() => {
                    const VISION_SUBTITLES = ["Posicionamiento Potencial", "Expansión de Servicios", "Crecimiento Digital", "Diferenciación Frente a Competidores", "Conclusión", "Resumen", "Fortalezas", "Debilidades", "Oportunidades", "Siguientes pasos"];
                    const renderVisionContent = (content: string) => {
                      return (
                        <div className="space-y-2 text-sm text-slate-700">
                          {content.split(/\n\n+/).map((block, i) => {
                            const trimmed = block.trim();
                            if (!trimmed) return null;
                            const firstLine = trimmed.split("\n")[0] ?? "";
                            const isSubtitle = VISION_SUBTITLES.some((k) => trimmed === k || firstLine === k || trimmed.startsWith(k + ":") || trimmed.startsWith(k + "\n"));
                            const isList = /^[\s]*[-*•]\s/.test(trimmed) || /^[\s]*\d+[.)]\s/.test(trimmed);
                            if (isSubtitle) {
                              return (
                                <p key={i} className="mt-3 font-semibold text-slate-800">
                                  {trimmed}
                                </p>
                              );
                            }
                            if (isList) {
                              const items = trimmed.split(/\n/).filter((l) => l.trim());
                              return (
                                <ul key={i} className="list-disc pl-5 space-y-1">
                                  {items.map((line, j) => (
                                    <li key={j}>{line.replace(/^[\s]*[-*•]\s|^\d+[.)]\s/, "").trim()}</li>
                                  ))}
                                </ul>
                              );
                            }
                            return (
                              <p key={i} className="whitespace-pre-wrap">
                                {trimmed}
                              </p>
                            );
                          })}
                        </div>
                      );
                    };
                    return (
                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="h-4 w-4 text-slate-500 shrink-0" />
                            <h3 className="text-sm font-semibold text-slate-800">Visión estratégica</h3>
                          </div>
                          {renderVisionContent(strategicVisionText)}
                        </div>
                      </div>
                    );
                  })()}
                  {!hasStrategicVisionText && (
                    <p className="mt-3 text-sm text-slate-500">
                      El contenido de visión estratégica aparece aquí cuando el informe comercial incluye la sección correspondiente.
                    </p>
                  )}
                </div>

                {id && (
                  <div>
                    <Tooltip content="Lleva al tab Comercial para ver el proceso de 6 pasos: análisis, diagnóstico, estrategia, estructura, propuesta y presentación." maxWidth="300px">
                      <Link
                        href={`/admin/leads/${id}?tab=comercial&section=proceso-comercial`}
                        className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Ir a proceso comercial (tab Comercial)
                      </Link>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Servicios sugeridos para este lead */}
              <div className="rounded-2xl border bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Servicios sugeridos para este lead</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Recomendaciones iniciales construidas a partir del diagnóstico estratégico y de las acciones detectadas por la IA.
                </p>
                {(() => {
                  const { sourceText } = getStrategicSourceText(lead);
                  const hasAiReport = sourceText.length > 0;
                  return (
                    <p className="mt-2 text-xs text-slate-500">
                      {hasAiReport ? "Fuente de sugerencias: acciones, oportunidades y plan de crecimiento del análisis IA." : "Fuente de sugerencias: señales básicas del lead (modo inicial)."}
                    </p>
                  );
                })()}
                {servicesCatalog.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Aún no hay catálogo disponible para calcular sugerencias.</p>
                ) : (() => {
                  const suggested = getSuggestedServicesFromAiReport(servicesCatalog, leadServices, lead);
                  const signals = getLeadSignals(lead, leadServices);
                  if (suggested.length === 0) {
                    return <p className="mt-3 text-sm text-slate-500">No se detectaron sugerencias automáticas adicionales para este lead por ahora.</p>;
                  }
                  return (
                    <div className="mt-4 space-y-4">
                      {suggested.map((s) => {
                        const exp = getSuggestedServiceDisplayExplanation(s, signals);
                        return (
                          <SuggestedServiceCard
                            key={s.service.id}
                            titulo={s.service.nombre ?? s.service.codigo ?? "Servicio"}
                            categoria={s.service.categoria}
                            prioridadBadgeClass={getPriorityBadgeClasses(s.priority)}
                            prioridadCorta={s.priority}
                            diagnostico={exp.diagnostico}
                            implicancia={exp.implicancia}
                            impacto={exp.impacto}
                            onAgregar={() => void handleAddSuggestedService(s)}
                            disabled={servicesSaving}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Sección 4: Propuesta Comercial Inteligente (Paso 4 estructura / Paso 5 propuesta) */}
              <div id="proposal-export">
                {activeTab === "consultor" && sectionFromUrl === "proposal-export" && processStepContext && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Proceso comercial</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{processStepContext.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-600">{processStepContext.description}</p>
                    <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-slate-600">Después sigue: {processStepContext.nextStep}</p>
                  </div>
                )}
                <div id="services-proposal" className="rounded-2xl border bg-white p-6">
                  {activeTab === "consultor" && sectionFromUrl === "services-proposal" && processStepContext && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Proceso comercial</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">{processStepContext.title}</h3>
                      <p className="mt-1.5 text-sm text-slate-600">{processStepContext.description}</p>
                      <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-slate-600">Después sigue: {processStepContext.nextStep}</p>
                    </div>
                  )}
                <h2 className="text-lg font-semibold text-slate-900">Propuesta Comercial Inteligente</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Seleccioná servicios del catálogo de la agencia, definí precio unitario y cantidad, organizá por mes y prepará la propuesta para este lead.
                </p>

                {servicesLoading && (
                  <p className="mt-3 text-sm text-slate-600">Cargando catálogo y propuesta del lead...</p>
                )}
                {servicesError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-800">{servicesError}</p>
                  </div>
                )}

                <ProposalServiceEditor
                  servicesCatalog={servicesCatalog}
                  selectedServiceId={selectedServiceId}
                  onServiceIdChange={setSelectedServiceId}
                  selectedMes={selectedMes}
                  onMesChange={setSelectedMes}
                  selectedUnitPrice={selectedUnitPrice}
                  onUnitPriceChange={setSelectedUnitPrice}
                  selectedQuantity={selectedQuantity}
                  onQuantityChange={setSelectedQuantity}
                  selectedAlcance={selectedAlcance}
                  onAlcanceChange={setSelectedAlcance}
                  selectedObservaciones={selectedObservaciones}
                  onObservacionesChange={setSelectedObservaciones}
                  selectedService={selectedService}
                  servicesSaving={servicesSaving}
                  servicesLoading={servicesLoading}
                  onAdd={() => void handleAddProposalService()}
                  lineTotalLabel={(() => {
                    const up =
                      selectedUnitPrice === ""
                        ? Number(selectedService?.precio_base ?? 0)
                        : Number(selectedUnitPrice);
                    const q =
                      selectedQuantity === ""
                        ? Number(selectedService?.default_quantity ?? 1)
                        : Number(selectedQuantity);
                    const qty = Number.isFinite(q) && q > 0 ? q : 1;
                    const unitP = Number.isFinite(up) ? up : 0;
                    const t = unitP * qty;
                    const cur = selectedService?.moneda?.trim() || "";
                    return Number.isFinite(t)
                      ? `${cur ? `${cur} ` : ""}${t.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                      : "—";
                  })()}
                />

                {/* Tabla mensual de propuesta: matriz servicios x meses */}
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">Propuesta por mes</h3>
                      {(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Propuesta confirmada</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Propuesta en construcción</span>
                      )}
                      {(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at && currentFlowStep?.id === "presentacion" && id && (
                        presentationEmbedBlocked && presentationPrimaryUrl ? (
                          <button
                            type="button"
                            onClick={() => window.open(presentationPrimaryUrl, PRESENTATION_POPUP_NAME, PRESENTATION_POPUP_FEATURES)}
                            className="inline-block rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Ver presentación
                          </button>
                        ) : (
                          <Link
                            href={`/admin/leads/${id}/presentacion`}
                            className="inline-block rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Ver presentación
                          </Link>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setProposalMonthCount((c) => Math.min(24, c + 1))}
                        disabled={!!(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + Mes
                      </button>
                      <button
                        type="button"
                        onClick={() => setProposalMonthCount((c) => Math.max(1, c - 1))}
                        disabled={proposalMonthCount <= 1 || !!(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        − Mes
                      </button>
                      {!(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at && (
                        <button
                          type="button"
                          onClick={handleConfirmProposal}
                          disabled={proposalConfirming || proposalGridRows.length === 0}
                          className="rounded-xl border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          {proposalConfirming ? "Confirmando…" : "Confirmar estructura de propuesta"}
                        </button>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const isProposalConfirmed = !!(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at;
                    return proposalGridRows.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">Aún no hay servicios en la propuesta. Agregá uno desde las sugerencias o el formulario de arriba.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full min-w-[480px] text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left py-2 pl-2 pr-3 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[140px]">Servicios</th>
                            {proposalMonthColumns.map((col) => (
                              <th key={col.key} className="text-right py-2 px-2 font-semibold text-slate-700 min-w-[72px]">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {proposalGridRows.map((row) => (
                            <tr key={row.proposalId} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-1.5 pl-2 pr-3 align-middle sticky left-0 bg-white z-10 border-r border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900 truncate max-w-[180px]" title={[row.codigo, row.nombre].filter(Boolean).join(" — ")}>
                                    {[row.codigo, row.nombre].filter(Boolean).join(" — ") || "—"}
                                  </span>
                                  {!isProposalConfirmed && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProposal(row.proposalId)}
                                      disabled={deletingServiceId !== null}
                                      className="flex-shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                      title="Eliminar de la propuesta"
                                    >
                                      {deletingServiceId === row.proposalId ? "…" : "Eliminar"}
                                    </button>
                                  )}
                                </div>
                              </td>
                              {proposalMonthColumns.map((col) => (
                                <td key={col.key} className="py-1 px-1 align-middle">
                                  <input
                                    type="number"
                                    step={0.01}
                                    min={0}
                                    readOnly={isProposalConfirmed}
                                    value={row.valuesByMonth[col.key] === "" ? "" : row.valuesByMonth[col.key]}
                                    onChange={(e) => {
                                      if (isProposalConfirmed) return;
                                      const raw = e.target.value;
                                      const num = raw === "" ? "" : Number(raw);
                                      setProposalGridOverrides((prev) => ({
                                        ...prev,
                                        [row.proposalId]: {
                                          ...(prev[row.proposalId] ?? {}),
                                          [col.key]: num,
                                        },
                                      }));
                                    }}
                                    className="w-full min-w-[60px] max-w-[80px] rounded border border-slate-200 px-1.5 py-1 text-right text-slate-800 text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                            <td className="py-2 pl-2 pr-3 text-slate-800 sticky left-0 bg-slate-100 z-10">Total</td>
                            {proposalMonthColumns.map((col) => (
                              <td key={col.key} className="py-2 px-2 text-right text-slate-900 min-w-[72px]">
                                {getColumnTotal(proposalGridRows, col.key).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                  })()}
                  {proposalGridRows.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Total del período: {proposalMonthColumns.reduce((sum, col) => sum + getColumnTotal(proposalGridRows, col.key), 0).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-1 text-sm font-semibold text-slate-800">Servicios propuestos para este lead</h3>
                  <p className="mb-4 text-xs text-slate-500">
                    Vista comercial: precio, cantidad y nota al cliente. El detalle técnico (horas, costos, márgenes) está un nivel abajo.
                  </p>
                  {leadServices.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún no hay servicios cargados en la propuesta.</p>
                  ) : (
                    <>
                      <ProposalServicesTotalsSummary
                        rows={leadServices}
                        drafts={proposalRowDrafts}
                        formatMoney={formatMoney}
                      />
                      <div className="space-y-5">
                      {leadServices.map((row) => {
                        const draft = proposalRowDrafts[row.id] ?? draftFromProposalRow(row);
                        return (
                          <ProposalServiceLineCard
                            key={row.id}
                            row={row}
                            draft={draft}
                            onDraftChange={(patch) =>
                              setProposalRowDrafts((prev) => {
                                const current = prev[row.id] ?? draftFromProposalRow(row);
                                return { ...prev, [row.id]: { ...current, ...patch } };
                              })
                            }
                            techOpen={!!proposalTechOpen[row.id]}
                            onToggleTech={() =>
                              setProposalTechOpen((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                            }
                            onSave={() => void saveProposalRow(row.id)}
                            onDelete={() => void handleDeleteProposal(row.id)}
                            servicesSaving={servicesSaving}
                            deleting={deletingServiceId === row.id}
                            formatMoney={formatMoney}
                          />
                        );
                      })}
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Argumentos comerciales de la propuesta</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Base consultiva para presentar cada servicio incluido dentro de la propuesta.
                  </p>
                  {leadServices.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Aún no hay servicios cargados para construir argumentos comerciales.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {leadServices.map((row) => {
                        const catalogService = servicesCatalog.find(
                          (c) => c.id === row.service_id || c.id === row.agency_service_id
                        );
                        const copy = catalogService ? getServiceSalesCopy(catalogService, getLeadSignals(lead, leadServices)) : DEFAULT_SALES_COPY;
                        return (
                          <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-slate-900">{[row.codigo, row.nombre].filter(Boolean).join(" — ") || "—"}</span>
                              <span className="text-slate-500">Mes {row.mes}</span>
                              <span className="text-slate-500">{formatBillingType(row.billing_type)}</span>
                              <span className="text-slate-600">{formatMoney(row.moneda, row.precio)}</span>
                            </div>
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 space-y-1.5">
                              <p><strong>Por qué incluirlo:</strong> {copy.why}</p>
                              <p><strong>Qué resultado busca:</strong> {copy.outcome}</p>
                              <p><strong>Cómo presentarlo al lead:</strong> {copy.howToSell}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Vista consolidada por mes</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Resumen de la propuesta comercial organizado por mes para facilitar la construcción de la oferta final.
                  </p>
                  {leadServices.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Aún no hay meses para consolidar porque no hay servicios cargados.</p>
                  ) : (
                    <>
                      {groupServicesByMonth(leadServices).map(({ mes, items }) => (
                        <div key={mes} className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                            <span className="text-sm font-semibold text-slate-800">Mes {mes}</span>
                            <span className="text-sm font-medium text-slate-700">{formatMonthSubtotal(items)}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[400px] text-sm text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-600 font-medium">
                                  <th className="py-2 pr-3 pl-4">Servicio</th>
                                  <th className="py-2 pr-3">Tipo</th>
                                  <th className="py-2 pr-3">Precio</th>
                                  <th className="py-2 pr-3">Alcance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((row) => (
                                  <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                                    <td className="py-2 pr-3 pl-4 text-slate-900">
                                      {[row.codigo, row.nombre].filter(Boolean).join(" — ") || "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-slate-700">{formatBillingType(row.billing_type)}</td>
                                    <td className="py-2 pr-3 text-slate-700">{formatMoney(row.moneda, row.precio)}</td>
                                    <td className="py-2 pr-3 text-slate-700 max-w-[200px] truncate" title={row.alcance_editado ?? undefined}>
                                      {row.alcance_editado?.trim() || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/30 p-3">
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Lectura estratégica de la propuesta</h4>
                        <p className="mt-1 text-sm text-slate-600">
                          Esta vista permitirá luego transformar la propuesta en una estructura comercial lista para exportar a PDF y Gamma, con narrativa por fase, inversión y alcance.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div id="proposal-builder" className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Fases de la propuesta</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Lectura estratégica de la propuesta comercial organizada por fase de trabajo.
                  </p>
                  {leadServices.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Aún no hay servicios suficientes para construir una lectura por fases.</p>
                  ) : (
                    <>
                      {groupServicesByPhase(leadServices).map(({ phase, items }) => (
                        <div key={phase} className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                            <span className="text-sm font-semibold text-slate-800">{phase}</span>
                            <span className="text-sm font-medium text-slate-700">{formatPhaseSubtotal(items)}</span>
                          </div>
                          <p className="px-4 py-2 text-xs text-slate-600 bg-white border-b border-slate-100">{getPhaseDescription(phase)}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[400px] text-sm text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-600 font-medium">
                                  <th className="py-2 pr-3 pl-4">Servicio</th>
                                  <th className="py-2 pr-3">Mes</th>
                                  <th className="py-2 pr-3">Tipo</th>
                                  <th className="py-2 pr-3">Precio</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((row) => (
                                  <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                                    <td className="py-2 pr-3 pl-4 text-slate-900">
                                      {[row.codigo, row.nombre].filter(Boolean).join(" — ") || "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-slate-700">Mes {row.mes}</td>
                                    <td className="py-2 pr-3 text-slate-700">{formatBillingType(row.billing_type)}</td>
                                    <td className="py-2 pr-3 text-slate-700">{formatMoney(row.moneda, row.precio)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Narrativa comercial base</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Base consultiva para presentar la propuesta al lead.
                  </p>
                  {leadServices.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No hay aún suficiente información cargada para construir una narrativa comercial.</p>
                  ) : (
                    <>
                      <div className="mt-3 space-y-3 text-sm text-slate-700">
                        {groupServicesByPhase(leadServices).some((x) => x.phase === "Diagnóstico y Base") && (
                          <p>La propuesta comienza con una fase de diagnóstico y base, orientada a ordenar la situación actual del lead, detectar oportunidades y preparar una estructura clara para avanzar.</p>
                        )}
                        {groupServicesByPhase(leadServices).some((x) => x.phase === "Implementación") && (
                          <p>Luego se incorpora una fase de implementación, donde se ejecutan los activos, sistemas o acciones necesarias para transformar la estrategia en una operación concreta.</p>
                        )}
                        {groupServicesByPhase(leadServices).some((x) => x.phase === "Optimización y Crecimiento") && (
                          <p>Finalmente, la propuesta contempla una fase de optimización y crecimiento, enfocada en sostener resultados, mejorar el rendimiento y acompañar la evolución comercial en el tiempo.</p>
                        )}
                      </div>
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                        <p className="text-xs text-slate-600">
                          Más adelante esta narrativa podrá editarse manualmente y exportarse como propuesta comercial formal en PDF o Gamma.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {leadServices.length > 0 && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Resumen económico de la propuesta</h3>
                    {(() => {
                      const oneTimeItems = leadServices.filter((r) => String(r.billing_type ?? "").toLowerCase() === "one_time");
                      const monthlyItems = leadServices.filter((r) => String(r.billing_type ?? "").toLowerCase() === "monthly");
                      const totalOneTime = sumByBillingType(leadServices, "one_time");
                      const totalMonthly = sumByBillingType(leadServices, "monthly");
                      const totalGeneral = totalOneTime + totalMonthly;
                      const mixedOne = getUniqueCurrencies(oneTimeItems).length > 1;
                      const mixedMonthly = getUniqueCurrencies(monthlyItems).length > 1;
                      const mixedTotal = getUniqueCurrencies(leadServices).length > 1;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Implementación única</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {mixedOne ? "Monedas mixtas" : formatSummaryMoney(oneTimeItems, totalOneTime)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Inversión mensual</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {mixedMonthly ? "Monedas mixtas" : formatSummaryMoney(monthlyItems, totalMonthly)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total base estimado</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {mixedTotal ? "Monedas mixtas" : formatSummaryMoney(leadServices, totalGeneral)}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "acciones" && id && (
            <Acciones
              leadId={id}
              meetAssistantSessionId={activeSession?.id ?? null}
              onStartMeetAssistant={() => void startMeetSession()}
              onFirstCommercialActionSaved={() => {
                flash("Acción registrada");
                void fetchActiveSession();
              }}
            />
          )}
          {activeTab === "contactos" && (
            <div className="mt-5">
              {lead && (
                <div className="rounded-2xl border bg-white p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Contactos del Lead</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Gestioná los contactos asociados a este lead
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openContactModal(null)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      + Agregar contacto
                    </button>
                  </div>

                  {contactsError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {contactsError}
                    </div>
                  )}

                  {contactsLoading ? (
                    <div className="text-sm text-slate-500">Cargando contactos…</div>
                  ) : contacts.length === 0 ? (
                    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                      No hay contactos. Agregá el primero usando el botón "+ Agregar contacto".
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border">
                      <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_120px] bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                        <div>Principal</div>
                        <div>Nombre</div>
                        <div>Cargo</div>
                        <div>Celular</div>
                        <div>Email</div>
                        <div>Acciones</div>
                      </div>
                      <div className="divide-y">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_120px] px-4 py-3 text-sm items-center"
                          >
                            <div>
                              {contact.is_primary ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                            <div className="font-medium text-slate-900">{contact.nombre}</div>
                            <div className="text-slate-700">{contact.cargo}</div>
                            <div className="text-slate-700">{contact.telefono || "—"}</div>
                            <div className="text-slate-700">{contact.email || "—"}</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openContactModal(contact)}
                                className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteContact(contact.id)}
                                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && !lead && (
            <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              No se encontró el lead.
            </div>
          )}

        <LeadDocsModal
          open={docsOpen}
          onClose={() => setDocsOpen(false)}
          leadId={id ?? ""}
          leadName={lead?.nombre ?? null}
        />

        {/* Modal de contacto */}
        {showContactModal && (
          <Modal
            open={showContactModal}
            title={editingContact ? "Editar contacto" : "Agregar contacto"}
            onClose={closeContactModal}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={contactForm.nombre}
                  onChange={(e) => setContactForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Cargo
                </label>
                <input
                  type="text"
                  value={contactForm.cargo}
                  onChange={(e) => setContactForm((f) => ({ ...f, cargo: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Ej: CEO, Director, Gerente"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Celular
                </label>
                <input
                  type="text"
                  value={contactForm.telefono}
                  onChange={(e) => setContactForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Ej: 099123456"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Ej: juan@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Notas
                </label>
                <textarea
                  value={contactForm.notas}
                  onChange={(e) => setContactForm((f) => ({ ...f, notas: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Notas adicionales sobre el contacto"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactForm.is_primary}
                  onChange={(e) => setContactForm((f) => ({ ...f, is_primary: e.target.checked }))}
                  className="rounded border"
                  id="is_primary"
                />
                <label htmlFor="is_primary" className="text-sm text-slate-700">
                  Contacto principal
                </label>
              </div>
              {contactsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {contactsError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeContactModal}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveContact}
                  className="rounded-xl border bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                >
                  {editingContact ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  editing,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      {editing ? (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          placeholder={placeholder}
        />
      ) : (
        <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value?.trim?.() ? value : "—"}
        </div>
      )}
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const handleClick = (star: number) => {
    if (disabled) return;
    // Si clickeamos la misma estrella que ya está seleccionada, la deseleccionamos (null)
    if (value === star) {
      onChange(null);
    } else {
      onChange(star);
    }
  };

  // Si value es null, no mostrar estrellas (solo en modo lectura)
  if (value === null && disabled) {
    return null;
  }

  // Normalizar: null se trata como 0 solo para mostrar estrellas (en modo edición)
  const normalizedValue = value ?? 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={disabled}
            className={`text-xl transition-all ${
              star <= normalizedValue
                ? "text-yellow-400"
                : "text-slate-300"
            } ${
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:scale-110"
            }`}
            title={normalizedValue === star ? "Quitar score" : `Calificar ${star}/10`}
          >
            ★
          </button>
        ))}
      </div>
      {normalizedValue === 0 && !disabled && (
        <span className="text-xs text-slate-500">Sin calificar</span>
      )}
      {normalizedValue > 0 && (
        <span className="text-xs text-slate-600">
          {normalizedValue}/10
        </span>
      )}
    </div>
  );
}