"use client";

/*
  SMOKE TESTS (checklist):
  - [ ] Editar Facebook en Datos de Entidad → Guardar → Refresh → Facebook persiste.
  - [ ] Editar 3 campos distintos de entidad → Guardar → Refresh → persisten.
  - [ ] Informe IA con "¿Ya es cliente de la Agencia?" = Sí/cliente → NO critica destructivamente; sugiere optimizaciones.
  - [ ] Informe IA con "¿Ya es cliente de la Agencia?" = No/vacío → puede marcar oportunidades/gaps.
  - [ ] Informe IA menciona redes cargadas (FB/IG/LinkedIn/Web) y usa contactos si existen.
*/

import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { LeadDocsModal } from "@/components/leads/LeadDocsModal";
import { ProposalClientActions } from "@/components/leads/ProposalClientActions";
import { Tooltip } from "@/components/ui/Tooltip";
import { PageContainer } from "@/components/layout/PageContainer";
import Acciones from "@/components/acciones/Acciones";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { List, LayoutGrid, FileText } from "lucide-react";
import { useSetBreadcrumbSegment } from "@/app/admin/context/BreadcrumbContext";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LABELS, fetchLabels, type Labels } from "@/lib/labels";
import { usePermissions } from "@/lib/rbac/usePermissions";

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
    | "linkedin_director"
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
};

type LeadServiceProposal = {
  id: string;
  lead_id: string;
  service_id: string;
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
};

type SuggestedService = {
  reason: string;
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
      cta: "Generar presentación final",
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
  const [selectedPrecio, setSelectedPrecio] = useState("");
  const [selectedAlcance, setSelectedAlcance] = useState("");
  const [selectedObservaciones, setSelectedObservaciones] = useState("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    mes: number;
    precio: string;
    alcance_editado: string;
    observaciones: string;
  }>({ mes: 1, precio: "", alcance_editado: "", observaciones: "" });
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  /** Número de columnas mensuales en la tabla de propuesta (mín 1). */
  const [proposalMonthCount, setProposalMonthCount] = useState(6);
  /** Overrides por celda: proposalId -> monthKey -> value. Si no hay override, se usa row.mes/row.precio para la columna que coincida. */
  const [proposalGridOverrides, setProposalGridOverrides] = useState<Record<string, Record<string, number | "">>>({});
  const proposalDraftSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proposalRestoredFromLeadRef = useRef(false);
  const proposalSkipNextSaveRef = useRef(false);
  const [proposalConfirming, setProposalConfirming] = useState(false);

  const [estadoComercialOpen, setEstadoComercialOpen] = useState(false);
  const [datosLeadOpen, setDatosLeadOpen] = useState(false);
  const [investigacionOpen, setInvestigacionOpen] = useState(false);

  // ✅ Permisos RBAC
  const { hasPermission, role, loading: permissionsLoading } = usePermissions();

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
        if (sectionFromUrl === "ia-report-block" && el instanceof HTMLDetailsElement) {
          el.setAttribute("open", "open");
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
    lastGeneratedPdf?: boolean;
    exportReady?: boolean;
  }>({});

  /** Generación de documentos comerciales (Diagnóstico, Visión, Propuesta). */
  const [commercialDocLoading, setCommercialDocLoading] = useState<"diagnostic" | "strategy" | "proposal" | null>(null);
  const [commercialDocError, setCommercialDocError] = useState<string | null>(null);
  /** URLs de documentos generados en esta sesión (persistido en sessionStorage por lead). */
  const [commercialDocUrls, setCommercialDocUrls] = useState<{ diagnostic: string | null; strategy: string | null; proposal: string | null }>({
    diagnostic: null,
    strategy: null,
    proposal: null,
  });

  /** Pasos del flujo y paso actual (recalculan con lead, leadServices, proposal_confirmed_at, presentationSignals). */
  const flowSteps = useMemo(
    () => getLeadFlowSteps(lead ?? null, leadServices, presentationSignals),
    [lead, leadServices, presentationSignals]
  );
  const currentFlowStep = useMemo(() => getCurrentFlowStep(flowSteps), [flowSteps]);
  const flowSignals = useMemo(
    () => getLeadFlowSignals(lead ?? null, leadServices, presentationSignals),
    [lead, leadServices, presentationSignals]
  );
  /** Paso que se recomienda en el bloque "Siguiente paso recomendado" (para enfoque y etiqueta). */
  const displayStepId = useMemo(() => {
    if (!currentFlowStep) return null;
    const stepIndex = LEAD_FLOW_STEP_IDS.indexOf(currentFlowStep.id);
    const previousStepId = stepIndex > 0 ? LEAD_FLOW_STEP_IDS[stepIndex - 1] : null;
    const previousStepDone = previousStepId != null && flowSignals[previousStepId];
    return previousStepDone ? previousStepId : currentFlowStep.id;
  }, [currentFlowStep, flowSignals]);
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

  useEffect(() => {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      console.log("[PROPOSAL PAYLOAD DEBUG]", proposalExportPayload);
    }
  }, [proposalExportPayload]);

  const COMMERCIAL_DOCS_STORAGE_KEY = "lead_commercial_docs";

  /** Cargar documentos desde API (DB). Fallback opcional: sessionStorage. */
  const loadCommercialDocuments = useCallback(() => {
    if (!id?.trim() || typeof window === "undefined") return;
    fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; documents?: { diagnostic?: string; strategy?: string; proposal?: string } }) => {
        if (data?.ok && data.documents) {
          setCommercialDocUrls({
            diagnostic: data.documents.diagnostic ?? null,
            strategy: data.documents.strategy ?? null,
            proposal: data.documents.proposal ?? null,
          });
          return;
        }
        try {
          const raw = sessionStorage.getItem(`${COMMERCIAL_DOCS_STORAGE_KEY}_${id}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { diagnostic?: string | null; strategy?: string | null; proposal?: string | null };
            setCommercialDocUrls({
              diagnostic: parsed.diagnostic ?? null,
              strategy: parsed.strategy ?? null,
              proposal: parsed.proposal ?? null,
            });
          }
        } catch {
          // ignorar
        }
      })
      .catch(() => {
        try {
          const raw = sessionStorage.getItem(`${COMMERCIAL_DOCS_STORAGE_KEY}_${id}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { diagnostic?: string | null; strategy?: string | null; proposal?: string | null };
            setCommercialDocUrls({
              diagnostic: parsed.diagnostic ?? null,
              strategy: parsed.strategy ?? null,
              proposal: parsed.proposal ?? null,
            });
          }
        } catch {
          // ignorar
        }
      });
  }, [id]);

  useEffect(() => {
    loadCommercialDocuments();
  }, [loadCommercialDocuments]);

  /** Persistir documento en DB y actualizar estado local (y sessionStorage como fallback). */
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
      setCommercialDocUrls((prev) => {
        const next = { ...prev, [docType]: url };
        try {
          sessionStorage.setItem(`${COMMERCIAL_DOCS_STORAGE_KEY}_${id}`, JSON.stringify(next));
        } catch {
          // ignorar
        }
        return next;
      });
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
            const url = statusJson?.pdfUrl ?? statusJson?.gammaUrl ?? null;
            if (url) {
              await persistCommercialDocUrl(docType, url, generationId);
              window.open(url, "_blank");
            }
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
    [id, persistCommercialDocUrl]
  );

  const hasDiagnosticGenerated = Boolean(commercialDocUrls.diagnostic);
  const hasStrategyGenerated = Boolean(commercialDocUrls.strategy);
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

  /** Siguiente paso recomendado del pipeline comercial (1–6). */
  const nextCommercialStep = useMemo((): 1 | 2 | 3 | 4 | 5 | 6 => {
    if (!hasAnalysisInternal) return 1;
    if (!hasDiagnosticGenerated) return 2;
    if (!hasStrategyGenerated) return 3;
    if (!hasStructureReady) return 4;
    if (!hasProposalGenerated) return 5;
    return 6;
  }, [hasAnalysisInternal, hasDiagnosticGenerated, hasStrategyGenerated, hasStructureReady, hasProposalGenerated]);

  /** Config del siguiente paso para el bloque "Siguiente paso recomendado". */
  const nextStepConfig = useMemo(() => {
    const steps: Record<number, { title: string; description: string; ctaLabel: string }> = {
      1: {
        title: "Análisis del Lead",
        description: "Generá el análisis interno con IA para detectar oportunidades y preparar la base del diagnóstico comercial.",
        ctaLabel: "Generar Análisis Comercial",
      },
      2: {
        title: "Diagnóstico Comercial",
        description: "Generá el documento consultivo del diagnóstico para presentar al lead.",
        ctaLabel: "Generar Diagnóstico",
      },
      3: {
        title: "Estrategia de Crecimiento",
        description: "Generá la visión estratégica que conecta el diagnóstico con el plan de crecimiento.",
        ctaLabel: "Generar Visión Estratégica",
      },
      4: {
        title: "Estructura de Servicios",
        description: "Definí la tabla de servicios, alcance y costos en el tab Consultor.",
        ctaLabel: "Ir a estructura de servicios",
      },
      5: {
        title: "Propuesta Comercial",
        description: "Generá la propuesta comercial integral (narrativa + estructura económica) para el cliente.",
        ctaLabel: "Generar Propuesta Comercial",
      },
      6: {
        title: "Presentación para el Cliente",
        description: "Los documentos están listos. Abrí la presentación final para compartir con el cliente.",
        ctaLabel: "Presentar al cliente",
      },
    };
    return steps[nextCommercialStep];
  }, [nextCommercialStep]);

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
        serviceId: row.service_id,
        codigo: row.codigo ?? null,
        nombre: row.nombre ?? null,
        billingType: row.billing_type ?? null,
        valuesByMonth,
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
        rows: proposalGridRows.map((r) => ({ proposalId: r.proposalId, serviceId: r.serviceId, valuesByMonth: { ...r.valuesByMonth } })),
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

    const add = (sourceKeywords: string[], catalogKeywords: string[], priority: SuggestedService["priority"], reason: string) => {
      if (!matchesStrategicKeywords(sourceText, sourceKeywords)) return;
      for (const svc of catalog) {
        if (already.has(svc.id)) continue;
        if (!matchesService(svc, catalogKeywords)) continue;
        candidates.push({ reason, priority, service: svc });
      }
    };

    // REGLA 1 — REDES
    add(
      ["redes", "instagram", "contenido", "presencia digital", "comunidad", "publicaciones", "visibilidad en redes"],
      ["redes", "social", "contenido", "community", "instagram", "facebook"],
      "alta",
      "El análisis estratégico detecta la necesidad de fortalecer la presencia y la comunicación en redes sociales."
    );

    // REGLA 2 — PAUTA
    add(
      ["pauta", "ads", "campañas", "captación", "tráfico", "leads", "meta ads", "google ads", "conversiones"],
      ["pauta", "ads", "trafico", "captacion", "media", "campañas", "meta", "google"],
      "alta",
      "El diagnóstico sugiere acelerar captación y visibilidad mediante campañas pagas."
    );

    // REGLA 3 — WEB / LANDING (evitar si el informe dice que la web está correcta)
    const webNegative = /(la\s+web\s+está\s+correcta|sitio\s+correcto|presencia\s+web\s+correcta|web\s+bien\s+resuelta)/i.test(normSource);
    const webPositive = matchesStrategicKeywords(sourceText, ["web", "landing", "sitio", "página", "conversion", "conversión web", "mejorar la web", "optimizar sitio"]);
    if (webPositive && (!webNegative || matchesStrategicKeywords(sourceText, ["crear", "rediseño", "nueva web", "nuevo sitio", "desarrollar web"]))) {
      for (const svc of catalog) {
        if (already.has(svc.id)) continue;
        if (!matchesService(svc, ["web", "landing", "sitio", "pagina"])) continue;
        candidates.push({
          reason: "Las acciones recomendadas muestran una oportunidad de mejora en la base web y en la conversión digital.",
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
      "El informe plantea una necesidad de dirección estratégica y priorización comercial."
    );

    // REGLA 5 — AUTOMATIZACIÓN / CRM
    add(
      ["automatizacion", "automatización", "crm", "seguimiento", "pipeline", "nutricion", "nutrición", "embudo", "cierre comercial", "procesos comerciales"],
      ["automatizacion", "crm", "pipeline", "embudo", "proceso comercial"],
      "media",
      "Las recomendaciones apuntan a ordenar el seguimiento comercial y mejorar la conversión del proceso."
    );

    // REGLA 6 — LINKEDIN (solo si el informe lo menciona en acciones/oportunidades)
    add(
      ["linkedin", "marca personal", "social selling", "autoridad profesional", "posicionamiento en linkedin"],
      ["linkedin", "marca personal", "social selling", "contenido ejecutivo"],
      "media",
      "El análisis detecta una oportunidad concreta de posicionamiento comercial en LinkedIn."
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
      hasLinkedin: !!(lead?.linkedin_empresa?.trim() || lead?.linkedin_director?.trim()),
      hasAiReport: !!(typeof aiReportRaw === "string" && aiReportRaw.trim()),
      hasObjetivo: !!(lead?.objetivos?.trim()),
      hasAudiencia: !!(lead?.audiencia?.trim()),
      hasExistingProposal: items.length > 0,
    };
  }
  function getAlreadyProposedServiceIds(items: LeadServiceProposal[]): Set<string> {
    return new Set(items.map((r) => r.service_id));
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
  const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
  function getSuggestedServices(
    catalog: EasyService[],
    proposed: LeadServiceProposal[],
    signals: ReturnType<typeof getLeadSignals>
  ): SuggestedService[] {
    const already = getAlreadyProposedServiceIds(proposed);
    const candidates: SuggestedService[] = [];

    const add = (keywords: string[], priority: SuggestedService["priority"], reason: string) => {
      for (const svc of catalog) {
        if (already.has(svc.id)) continue;
        if (!matchesService(svc, keywords)) continue;
        candidates.push({ reason, priority, service: svc });
      }
    };

    if (!signals.hasWebsite) {
      add(["web", "landing", "sitio", "pagina"], "alta", "El lead no muestra una presencia web clara y necesita una base digital visible.");
    }
    if (signals.hasWebsite && !signals.hasAiReport) {
      add(["auditoria", "diagnostico", "consultoria"], "alta", "Conviene comenzar con una instancia de diagnóstico para ordenar prioridades y detectar oportunidades.");
    }
    if ((signals.hasInstagram || signals.hasFacebook) && !signals.hasObjetivo) {
      add(["consultoria", "estrategia", "growth"], "media", "El lead tiene presencia digital, pero falta una dirección estratégica clara para convertirla en resultados.");
    }
    if (signals.hasWebsite && (signals.hasInstagram || signals.hasFacebook) && !signals.hasExistingProposal) {
      add(["pauta", "ads", "trafico", "captacion"], "media", "Ya existe una base digital mínima; el siguiente paso puede ser acelerar captación y visibilidad.");
    }
    if (signals.hasLinkedin) {
      add(["linkedin", "contenido", "marca personal", "social selling"], "media", "La presencia en LinkedIn abre oportunidades comerciales y de posicionamiento.");
    }
    if (signals.hasAiReport && !signals.hasExistingProposal) {
      add(["consultoria", "implementacion", "automatizacion"], "alta", "El lead ya cuenta con diagnóstico IA y está en condiciones de transformarlo en plan de acción.");
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
    const precioNum = selectedPrecio === "" ? null : Number(selectedPrecio);
    const basePrice = precioNum ?? selectedService?.precio_base ?? 0;
    setServicesSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedServiceId,
          mes: 1,
          precio: precioNum ?? selectedService?.precio_base ?? null,
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
      setSelectedPrecio("");
      setSelectedAlcance("");
      setSelectedObservaciones("");
      await loadLeadServices();
      const newProposal = (json as { proposal?: { id: string } })?.proposal;
      if (newProposal?.id && Number.isFinite(basePrice)) {
        const cols = getProposalMonthColumns(Math.max(1, proposalMonthCount));
        const next: Record<string, number | ""> = {};
        cols.forEach((c) => { next[c.key] = basePrice; });
        setProposalGridOverrides((prev) => ({ ...prev, [newProposal.id]: next }));
      }
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "Error al agregar el servicio");
    } finally {
      setServicesSaving(false);
    }
  }

  async function handleSaveProposalEdit() {
    if (!id || !editingServiceId) return;
    setServicesError("");
    const mes = Number(editingValues.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 24) {
      setServicesError("El mes debe estar entre 1 y 24.");
      return;
    }
    setServicesSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/services/${editingServiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes,
          precio: editingValues.precio === "" ? null : Number(editingValues.precio),
          alcance_editado: editingValues.alcance_editado.trim() || null,
          observaciones: editingValues.observaciones.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(json?.error ?? "No se pudo guardar el servicio propuesto.");
        return;
      }
      setEditingServiceId(null);
      setEditingValues({ mes: 1, precio: "", alcance_editado: "", observaciones: "" });
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
      if (editingServiceId === proposalId) {
        setEditingServiceId(null);
        setEditingValues({ mes: 1, precio: "", alcance_editado: "", observaciones: "" });
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
        rows: proposalGridRows.map((r) => ({ proposalId: r.proposalId, serviceId: r.serviceId, valuesByMonth: { ...r.valuesByMonth } })),
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

  async function handleAddSuggestedService(suggestion: SuggestedService) {
    if (!id) return;
    setServicesError("");
    const basePrice = suggestion.service.precio_base ?? 0;
    setServicesSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: suggestion.service.id,
          mes: 1,
          precio: suggestion.service.precio_base ?? null,
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
        const next: Record<string, number | ""> = {};
        cols.forEach((c) => { next[c.key] = basePrice; });
        setProposalGridOverrides((prev) => ({ ...prev, [newProposal.id]: next }));
      }
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
        linkedin_director: payload.linkedin_director !== undefined ? (payload.linkedin_director || "null") : "undefined (no se incluye)",
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

    // Construir payload base (sin linkedin_empresa/linkedin_director, se agregan condicionalmente)
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

    // Preservar linkedin_empresa y linkedin_director si el draft está vacío pero el lead tiene valores
    const currentLinkedinEmpresa = (lead?.linkedin_empresa ?? "").trim();
    const currentLinkedinDirector = (lead?.linkedin_director ?? "").trim();
    const newLinkedinEmpresa = (draft.linkedin_empresa ?? "").trim();
    const newLinkedinDirector = (draft.linkedin_director ?? "").trim();

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

    // LinkedIn Director: solo incluir si cambió explícitamente
    if (draft.linkedin_director !== undefined) {
      if (newLinkedinDirector === "" && currentLinkedinDirector) {
        // Draft vacío pero lead tiene valor → NO incluir (preservar valor existente)
        // No hacer nada, no incluir en normalized
      } else if (newLinkedinDirector !== currentLinkedinDirector) {
        // Valor nuevo diferente al actual → incluir (puede ser cambio o borrado explícito)
        normalized.linkedin_director = newLinkedinDirector || null;
      }
      // Si son iguales, no incluir (no cambió)
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
      linkedin_director: lead.linkedin_director ?? "",
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
      const currentPipeline = norm(lead.pipeline);
      const normalizedCurrent = currentPipeline ? currentPipeline.trim().toLowerCase() : "";
      const isClosed = normalizedCurrent === "ganado" || normalizedCurrent === "perdido";

      if (isClosed) {
        const newPipeline = norm(draft.pipeline as string);
        const normalizedNew = newPipeline ? newPipeline.trim().toLowerCase() : "";
        if (normalizedNew !== normalizedCurrent) {
          setError("Lead cerrado: no se puede cambiar la etapa desde Ganado/Perdido.");
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
          throw new Error((j as { error?: string }).error ?? "Error actualizando entidad");
        }
      } catch (e: any) {
        setError(e?.message ?? "Error guardando datos de entidad");
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

  // Variables efectivas para website e instagram (con fallback desde entidad)
  const websiteEffective = (lead?.website ?? "").trim() || (lead?.empresas?.web ?? "").trim() || "";
  const instagramEffective = (lead?.empresas?.instagram ?? "").trim() || "";
  const hasEntidad = Boolean(lead?.empresa_id || lead?.empresas?.id);

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

          {/* FILA 2 — Botonera completa */}
          <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              {/* Grupo 1 — Acciones operativas frecuentes */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLead}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                  disabled={disabled}
                >
                  Refrescar
                </button>
                <button
                  type="button"
                  onClick={() => id && setDocsOpen(true)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                  disabled={disabled || !id}
                  title="Documentación PDF del lead"
                >
                  Documentación
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                  title="Meet Asistido (en pausa)"
                >
                  Meet Asistido
                </button>
                <button
                  type="button"
                  onClick={() => id && router.push(`/admin/leads/${id}?tab=consultor&section=services-proposal`)}
                  className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                  disabled={disabled || !id}
                  title={leadServices?.length || (lead as { proposal_draft_json?: string | null } | undefined)?.proposal_draft_json ? "Abrir propuesta comercial del lead" : "Abre el constructor de propuesta comercial del lead"}
                >
                  Propuesta comercial
                </button>
              </div>

              {/* Divider sutil entre grupos */}
              <div className="hidden sm:block w-px self-stretch min-h-[32px] bg-slate-200" aria-hidden />

              {/* Grupo 2 — Accesos transversales */}
              <div className="flex flex-wrap items-center gap-2">
                {visibleTabIds.includes("contactos") && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("contactos")}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${activeTab === "contactos" ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
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
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${activeTab === "acciones" ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    disabled={disabled || !lead}
                    title="Ver acciones y seguimiento del lead"
                  >
                    Acciones
                  </button>
                )}
              </div>

              {/* Divider sutil */}
              <div className="hidden sm:block w-px self-stretch min-h-[32px] bg-slate-200" aria-hidden />

              {/* Grupo 3 — Gestión del lead */}
              <div className="flex flex-wrap items-center gap-2">
                {!lead?.is_member && (
                  <button
                    type="button"
                    onClick={convertToMember}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 hover:border-emerald-600 disabled:opacity-50 transition"
                    disabled={disabled || !lead}
                    title={`Convertir este lead en ${labels.memberSingular.toLowerCase()}`}
                  >
                    Convertir en {labels.memberSingular.toLowerCase()}
                  </button>
                )}
                {!editing ? (
                  canEditLead && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
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
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                      disabled={disabled}
                    >
                      Cancelar
                    </button>
                    {canEditLead && (
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="rounded-xl border border-slate-300 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition"
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
                    className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                    disabled={disabled || !lead}
                    title="Eliminar lead"
                  >
                    Eliminar
                  </button>
                )}
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
                const currentStep = currentFlowStep;
                const stepIndex = currentStep ? LEAD_FLOW_STEP_IDS.indexOf(currentStep.id) : -1;
                const previousStepId = stepIndex > 0 ? LEAD_FLOW_STEP_IDS[stepIndex - 1] : null;
                const previousStepDone = previousStepId != null && flowSignals[previousStepId];
                const displayStepId = currentStep && previousStepDone ? previousStepId : currentStep?.id ?? null;

                type MicroState = "completado" | "pendiente_revision" | "siguiente_generar" | "bloqueado";
                function getStepMicroState(step: { id: string; status: "done" | "current" | "pending" }): MicroState {
                  if (step.status === "done") {
                    return displayStepId === step.id ? "pendiente_revision" : "completado";
                  }
                  if (step.status === "current") {
                    return displayStepId === step.id ? "siguiente_generar" : "siguiente_generar";
                  }
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
                        const isRecommendedAction = displayStepId === step.id;
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
                      {currentStep ? (
                        (() => {
                          const stepIndex = LEAD_FLOW_STEP_IDS.indexOf(currentStep.id);
                          const previousStepId = stepIndex > 0 ? LEAD_FLOW_STEP_IDS[stepIndex - 1] : null;
                          const previousStepDone = previousStepId != null && flowSignals[previousStepId];
                          const displayStepId = previousStepDone ? previousStepId : currentStep.id;
                          const display = getNextStepDisplay(displayStepId, flowSignals);
                          const isPresentacion = displayStepId === "presentacion";
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
                                <div className="mt-3">
                                  {isPresentacion ? (
                                    <Link
                                      href={`/admin/leads/${id}/presentacion`}
                                      className="inline-block rounded-xl border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
                                    >
                                      {display.cta}
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/admin/leads/${id}?tab=${display.tab}&section=${display.section}`)}
                                      className="rounded-xl border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
                                    >
                                      {display.cta}
                                    </button>
                                  )}
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
          {!hasEntidad && activeTab === "datos" && (
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
                        const normalizedCurrent = typeof currentPipeline === "string" ? currentPipeline.trim().toLowerCase() : "";
                        const isClosed = normalizedCurrent === "ganado" || normalizedCurrent === "perdido";
                        
                        return editing ? (
                          <>
                            <select
                              value={currentPipeline as string}
                              onChange={(e) => {
                                if (isClosed) {
                                  setError("Lead cerrado: no se puede cambiar la etapa desde Ganado/Perdido.");
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
                                Este lead está cerrado (Ganado/Perdido). No se puede cambiar la etapa.
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

                    <Field
                      label="LinkedIn Empresa"
                      editing={editing}
                      value={(editing ? (draft.linkedin_empresa as any) : lead?.linkedin_empresa) ?? ""}
                      onChange={(v) => setDraft((p) => ({ ...p, linkedin_empresa: v }))}
                      placeholder="https://linkedin.com/..."
                    />

                    <Field
                      label="LinkedIn Director"
                      editing={editing}
                      value={(editing ? (draft.linkedin_director as any) : lead?.linkedin_director) ?? ""}
                      onChange={(v) => setDraft((p) => ({ ...p, linkedin_director: v }))}
                      placeholder="https://linkedin.com/..."
                    />
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

                {/* Siguiente paso recomendado */}
                <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Siguiente paso recomendado</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{nextStepConfig.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{nextStepConfig.description}</p>
                  <div className="mt-3">
                    {nextCommercialStep === 1 && (
                      <button
                        type="button"
                        onClick={() => { const el = document.getElementById("ia-report-block"); el?.scrollIntoView({ behavior: "smooth" }); (el as HTMLDetailsElement)?.setAttribute("open", "true"); }}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700"
                      >
                        {nextStepConfig.ctaLabel}
                      </button>
                    )}
                    {nextCommercialStep === 2 && (
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
                    {nextCommercialStep === 3 && (
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
                    {nextCommercialStep === 4 && id && (
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/leads/${id}?tab=consultor&section=services-proposal`)}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700"
                      >
                        {nextStepConfig.ctaLabel}
                      </button>
                    )}
                    {nextCommercialStep === 5 && (
                      <Tooltip content="Genera la propuesta comercial final con servicios, inversión y condiciones para presentar al cliente." maxWidth="300px">
                        <span className="inline-block">
                          <button
                            type="button"
                            onClick={() => generateCommercialDoc("proposal")}
                            disabled={!id || commercialDocLoading !== null || !hasStrategyGenerated}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700 disabled:opacity-50 disabled:animate-none"
                          >
                            {commercialDocLoading === "proposal" ? "Generando…" : nextStepConfig.ctaLabel}
                          </button>
                        </span>
                      </Tooltip>
                    )}
                    {nextCommercialStep === 6 && allDocsGenerated && id && (
                      <Link
                        href={`/admin/leads/${id}/presentacion`}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md animate-pulse hover:bg-emerald-700"
                      >
                        {nextStepConfig.ctaLabel}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Progreso: X de 6 pasos */}
                {(() => {
                  const completed = [hasAnalysisInternal, hasDiagnosticGenerated, hasStrategyGenerated, hasStructureReady, hasProposalGenerated, allDocsGenerated].filter(Boolean).length;
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

                {/* Pipeline de 6 pasos */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
                  {/* Paso 1 — Análisis del Lead */}
                  {(() => {
                    const done = hasAnalysisInternal;
                    const actual = nextCommercialStep === 1;
                    const blocked = false;
                    return (
                      <div className={`rounded-xl border-2 p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-red-100 bg-red-50/30" : actual ? "border-emerald-300 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"}`}>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Paso 1</span>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">📋 Análisis del Lead</h3>
                        <p className="mt-1 text-xs font-medium text-slate-600">{done ? "✓ Completado" : actual ? "Siguiente paso" : "○ Pendiente"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">Análisis interno con IA que alimenta el diagnóstico comercial.</p>
                        {done ? (
                          <p className="mt-2 text-xs text-emerald-700">Análisis generado. Podés verlo en Herramientas del diagnóstico (Paso 1) debajo.</p>
                        ) : (
                          <Tooltip content="Ejecuta el análisis interno con IA. No reemplaza el diagnóstico comercial: lo prepara y lo alimenta." maxWidth="300px">
                            <span className="block mt-3 w-full">
                              <button type="button" onClick={() => { const el = document.getElementById("ia-report-block"); el?.scrollIntoView({ behavior: "smooth" }); (el as HTMLDetailsElement)?.setAttribute("open", "true"); }} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                Generar Análisis Comercial
                              </button>
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })()}
                  {/* Paso 2 — Diagnóstico Comercial */}
                  {(() => {
                    const done = hasDiagnosticGenerated;
                    const actual = nextCommercialStep === 2;
                    const blocked = !hasAnalysisInternal;
                    return (
                      <div className={`rounded-xl border-2 p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-slate-100 bg-slate-100/80" : actual ? "border-emerald-300 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"}`}>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Paso 2</span>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">🔍 Diagnóstico Comercial</h3>
                        <p className="mt-1 text-xs font-medium text-slate-600">{done ? "✓ Generado" : blocked ? "🔒 Bloqueado" : actual ? "Siguiente paso" : "○ Pendiente"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">Documento consultivo del diagnóstico para presentar al lead.</p>
                        {commercialDocUrls.diagnostic ? (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Diagnóstico comercial generado</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => window.open(commercialDocUrls.diagnostic!, "_blank")} className="inline-flex rounded-lg border-2 border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-700">Abrir diagnóstico</button>
                              <button type="button" onClick={() => generateCommercialDoc("diagnostic")} disabled={!id || commercialDocLoading !== null} className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Regenerar diagnóstico</button>
                            </div>
                          </div>
                        ) : (
                          <Tooltip content="Genera el documento comercial del Paso 2. Presenta el diagnóstico consultivo del lead de forma clara y profesional." maxWidth="300px">
                            <span className="block mt-3 w-full">
                              <button type="button" onClick={() => generateCommercialDoc("diagnostic")} disabled={!id || commercialDocLoading !== null || blocked} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                {commercialDocLoading === "diagnostic" ? "Generando…" : "Generar Diagnóstico"}
                              </button>
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })()}
                  {/* Paso 3 — Estrategia de Crecimiento */}
                  {(() => {
                    const done = hasStrategyGenerated;
                    const actual = nextCommercialStep === 3;
                    const blocked = !hasDiagnosticGenerated;
                    return (
                      <div className={`rounded-xl border-2 p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-slate-100 bg-slate-100/80" : actual ? "border-emerald-300 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"}`}>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Paso 3</span>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">🎯 Estrategia de Crecimiento</h3>
                        <p className="mt-1 text-xs font-medium text-slate-600">{done ? "✓ Generado" : blocked ? "🔒 Bloqueado" : actual ? "Siguiente paso" : "○ Pendiente"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">Visión estratégica que conecta diagnóstico con el plan de crecimiento.</p>
                        {commercialDocUrls.strategy ? (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Visión estratégica generada</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => window.open(commercialDocUrls.strategy!, "_blank")} className="inline-flex rounded-lg border-2 border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-700">Abrir visión estratégica</button>
                              <button type="button" onClick={() => generateCommercialDoc("strategy")} disabled={!id || commercialDocLoading !== null || blocked} className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Regenerar visión estratégica</button>
                            </div>
                          </div>
                        ) : (
                          <Tooltip content="Genera el documento de estrategia de crecimiento a partir del diagnóstico y la información del lead." maxWidth="300px">
                            <span className="block mt-3 w-full">
                              <button type="button" onClick={() => generateCommercialDoc("strategy")} disabled={!id || commercialDocLoading !== null || blocked} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                {commercialDocLoading === "strategy" ? "Generando…" : "Generar Visión Estratégica"}
                              </button>
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })()}
                  {/* Paso 4 — Estructura de Servicios */}
                  {(() => {
                    const done = hasStructureReady;
                    const actual = nextCommercialStep === 4;
                    const blocked = !hasStrategyGenerated;
                    return (
                      <div className={`rounded-xl border-2 p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-slate-100 bg-slate-100/80" : actual ? "border-emerald-300 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"}`}>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Paso 4</span>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">📊 Estructura de Servicios</h3>
                        <p className="mt-1 text-xs font-medium text-slate-600">{done ? "✓ Completado" : blocked ? "🔒 Bloqueado" : actual ? "Siguiente paso" : "○ Pendiente"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">Tabla de servicios, alcance y costos en el tab Consultor.</p>
                        {done ? (
                          <p className="mt-2 text-xs text-emerald-700">Estructura definida o confirmada. Podés editarla en Consultor → Estructura de servicios.</p>
                        ) : id ? (
                          <Tooltip content="Aquí se arma la propuesta económica real: servicios, meses y precios. Se define en el tab Consultor." maxWidth="300px">
                            <span className="block mt-3 w-full">
                              <button type="button" onClick={() => router.push(`/admin/leads/${id}?tab=consultor&section=services-proposal`)} disabled={blocked} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                Ir a estructura de servicios
                              </button>
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                    );
                  })()}
                  {/* Paso 5 — Propuesta Comercial */}
                  {(() => {
                    const done = hasProposalGenerated;
                    const actual = nextCommercialStep === 5;
                    const blocked = !hasStructureReady;
                    return (
                      <div className={`rounded-xl border-2 p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-slate-100 bg-slate-100/80" : actual ? "border-emerald-300 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"}`}>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Paso 5</span>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">📄 Propuesta Comercial</h3>
                        <p className="mt-1 text-xs font-medium text-slate-600">{done ? "✓ Generado" : blocked ? "🔒 Bloqueado" : actual ? "Siguiente paso" : "○ Pendiente"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">Propuesta integral con narrativa y estructura económica (usa el Paso 4).</p>
                        {commercialDocUrls.proposal ? (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Propuesta comercial generada</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => window.open(commercialDocUrls.proposal!, "_blank")} className="inline-flex rounded-lg border-2 border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-700">Abrir propuesta</button>
                              <button type="button" onClick={() => generateCommercialDoc("proposal")} disabled={!id || commercialDocLoading !== null || !hasStrategyGenerated} className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Regenerar propuesta</button>
                            </div>
                          </div>
                        ) : (
                          <Tooltip content="Genera la propuesta comercial final con servicios, inversión y condiciones para presentar al cliente." maxWidth="300px">
                            <span className="block mt-3 w-full">
                              <button type="button" onClick={() => generateCommercialDoc("proposal")} disabled={!id || commercialDocLoading !== null || blocked} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                {commercialDocLoading === "proposal" ? "Generando…" : "Generar Propuesta Comercial"}
                              </button>
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })()}
                  {/* Paso 6 — Presentación para el Cliente */}
                  {(() => {
                    const done = allDocsGenerated;
                    const actual = nextCommercialStep === 6;
                    const blocked = !hasProposalGenerated;
                    return (
                      <div className={`rounded-xl border-2 p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-slate-100 bg-slate-100/80" : actual ? "border-emerald-300 bg-white ring-2 ring-emerald-200" : "border-slate-200 bg-slate-50/50"}`}>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Paso 6</span>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">🎬 Presentación para el Cliente</h3>
                        <p className="mt-1 text-xs font-medium text-slate-600">{done ? "✓ Listo" : blocked ? "🔒 Bloqueado" : actual ? "Siguiente paso" : "○ Pendiente"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">Salida final cliente-ready para compartir con el lead.</p>
                        {done && id ? (
                          <div className="mt-3">
                            <Link href={`/admin/leads/${id}/presentacion`} className="inline-flex w-full items-center justify-center rounded-lg border-2 border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-700">
                              Presentar al cliente
                            </Link>
                          </div>
                        ) : (
                          <Tooltip content="Cuando los tres documentos (diagnóstico, estrategia, propuesta) estén generados, podrás abrir la vista de presentación." maxWidth="300px">
                            <span className="block mt-3 w-full">
                              <button type="button" disabled className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed">
                                Presentar al cliente
                              </button>
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Herramientas por paso (colapsables) */}
                <div className="mt-6 space-y-4">
                  <details id="ia-report-block" className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      ▼ Herramientas del Paso 1 — Análisis del Lead (IA)
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
                  <details className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      ▼ Herramientas del Paso 2 y 3 — Diagnóstico y Estrategia
                    </summary>
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                      <p className="mb-2 text-xs text-slate-500">El documento de visión estratégica se genera con el botón de arriba.</p>
                      {hasStrategyGenerated && commercialDocUrls.strategy && (
                        <a href={commercialDocUrls.strategy} target="_blank" rel="noreferrer" className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          Abrir documento generado
                        </a>
                      )}
                    </div>
                  </details>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">Herramientas del Paso 4, 5 y 6 — Estructura, Propuesta y Presentación</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {(lead as { proposal_confirmed_at?: string | null } | undefined)?.proposal_confirmed_at && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Propuesta confirmada</span>
                      )}
                      {(presentationSignals?.gammaUrl ?? presentationSignals?.pdfUrl ?? presentationSignals?.lastGeneratedPdf ?? presentationSignals?.exportReady) && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Material final generado</span>
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
                      <button type="button" onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=ia-report-block`)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Descargar PDF propuesta
                      </button>
                      <button type="button" onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=ia-report-block`)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Copiar versión texto
                      </button>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <ProposalClientActions showPrint={false} proposalDocumentUrl={commercialDocUrls.proposal ?? null} />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === "tecnico" && (
            <div className="mt-5 grid grid-cols-1 gap-4">
              {allowedProfiles.includes("tecnico") ? (
                <details className="rounded-2xl border bg-white" open>
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
                {/* BLOQUE B — Informe comercial (respaldo analítico) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Informe comercial</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Documento de respaldo con análisis comercial, investigación digital, FODA, oportunidades, acciones y plan de avance.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Incluye: investigación digital, redes, posicionamiento, competencia, FODA, oportunidades, acciones 72h, plan 30–90 días.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=ia-report-block`)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Descargar PDF informe comercial
                    </button>
                    <button
                      type="button"
                      onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=ia-report-block`)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Copiar informe comercial
                    </button>
                  </div>
                </div>

                {/* BLOQUE C — Visión estratégica (documento ejecutivo complementario) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Visión estratégica</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Documento ejecutivo complementario para presentar una lectura más global del negocio, sus oportunidades y la dirección estratégica recomendada.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Incluye: lectura global, oportunidades de crecimiento, foco estratégico, riesgos, dirección recomendada.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=ia-report-block`)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Descargar PDF visión estratégica
                    </button>
                    <button
                      type="button"
                      onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=ia-report-block`)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Copiar visión estratégica
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => id && router.push(`/admin/leads/${id}?tab=comercial&section=proceso-comercial`)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Ir a proceso comercial (tab Comercial)
                  </button>
                </div>
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
                    <div className="mt-4 space-y-3">
                      {suggested.map((s) => (
                        <div key={s.service.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-900">{s.service.nombre}</span>
                                <span className="text-sm text-slate-500">{s.service.codigo}</span>
                                {s.service.categoria && (
                                  <span className="text-xs text-slate-500">{s.service.categoria}</span>
                                )}
                                <span className={getPriorityBadgeClasses(s.priority)}>{s.priority}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-600">{s.reason}</p>
                              <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Enfoque comercial sugerido</p>
                                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                                  <li><strong>Por qué recomendarlo:</strong> {getServiceSalesCopy(s.service, signals).why}</li>
                                  <li><strong>Qué resultado busca:</strong> {getServiceSalesCopy(s.service, signals).outcome}</li>
                                  <li><strong>Cómo venderlo:</strong> {getServiceSalesCopy(s.service, signals).howToSell}</li>
                                </ul>
                                <p className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                                  {getSuggestedPriorityText(s.priority)} · {getServicePhaseLabel(s.service.billing_type)}
                                </p>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                {s.service.precio_base != null && (
                                  <span>{formatMoney(s.service.moneda, s.service.precio_base)}</span>
                                )}
                                <span>
                                  {s.service.billing_type === "monthly" ? "Mensual" : s.service.billing_type === "one_time" ? "Única vez" : "—"}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddSuggestedService(s)}
                              disabled={servicesSaving}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Agregar sugerencia
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Sección 4: Propuesta Comercial Inteligente */}
              <div id="services-proposal" className="rounded-2xl border bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Propuesta Comercial Inteligente</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selecciona servicios EASY, organízalos por mes y prepara una propuesta comercial editable para este lead.
                </p>

                {servicesLoading && (
                  <p className="mt-3 text-sm text-slate-600">Cargando catálogo y propuesta del lead...</p>
                )}
                {servicesError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-800">{servicesError}</p>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Agregar servicio a la propuesta</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Servicio</label>
                      <select
                        value={selectedServiceId}
                        onChange={(e) => setSelectedServiceId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="">— Seleccionar —</option>
                        {servicesCatalog.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.codigo} — {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Mes</label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={selectedMes}
                        onChange={(e) => setSelectedMes(Number(e.target.value) || 1)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Precio</label>
                      <input
                        type="number"
                        step={0.01}
                        value={selectedPrecio}
                        onChange={(e) => setSelectedPrecio(e.target.value)}
                        placeholder={selectedService?.precio_base != null ? String(selectedService.precio_base) : undefined}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Alcance editable</label>
                      <textarea
                        value={selectedAlcance}
                        onChange={(e) => setSelectedAlcance(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
                      <textarea
                        value={selectedObservaciones}
                        onChange={(e) => setSelectedObservaciones(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleAddProposalService}
                      disabled={servicesSaving || servicesLoading}
                      className="rounded-xl px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {servicesSaving ? "Agregando…" : "Agregar a propuesta"}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Luego podrás usar esta base para exportar la propuesta comercial a PDF y Gamma.
                    </p>
                  </div>
                </div>

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
                        <Link
                          href={`/admin/leads/${id}/presentacion`}
                          className="inline-block rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Ir a generar propuesta para el cliente
                        </Link>
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
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Servicios propuestos para este lead</h3>
                  {leadServices.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún no hay servicios cargados en la propuesta.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600 font-medium">
                            <th className="py-2 pr-3">Mes</th>
                            <th className="py-2 pr-3">Servicio</th>
                            <th className="py-2 pr-3">Tipo</th>
                            <th className="py-2 pr-3">Precio</th>
                            <th className="py-2 pr-3">Alcance</th>
                            <th className="py-2 pr-3">Observaciones</th>
                            <th className="py-2">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadServices.map((row) => {
                            const isEditing = editingServiceId === row.id;
                            return (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="py-2 pr-3 text-slate-900 align-top">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={1}
                                      max={24}
                                      value={editingValues.mes}
                                      onChange={(e) => setEditingValues((v) => ({ ...v, mes: Number(e.target.value) || 1 }))}
                                      className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                                    />
                                  ) : (
                                    row.mes
                                  )}
                                </td>
                                <td className="py-2 pr-3 text-slate-900 align-top">
                                  {[row.codigo, row.nombre].filter(Boolean).join(" — ") || "—"}
                                </td>
                                <td className="py-2 pr-3 text-slate-700 align-top">{formatBillingType(row.billing_type)}</td>
                                <td className="py-2 pr-3 text-slate-700 align-top">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step={0.01}
                                      value={editingValues.precio}
                                      onChange={(e) => setEditingValues((v) => ({ ...v, precio: e.target.value }))}
                                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                                    />
                                  ) : (
                                    formatMoney(row.moneda, row.precio)
                                  )}
                                </td>
                                <td className="py-2 pr-3 text-slate-700 align-top max-w-[200px]">
                                  {isEditing ? (
                                    <textarea
                                      value={editingValues.alcance_editado}
                                      onChange={(e) => setEditingValues((v) => ({ ...v, alcance_editado: e.target.value }))}
                                      rows={2}
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm min-w-[140px]"
                                    />
                                  ) : (
                                    <span className="truncate block" title={row.alcance_editado ?? undefined}>
                                      {row.alcance_editado?.trim() || "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pr-3 text-slate-700 align-top max-w-[180px]">
                                  {isEditing ? (
                                    <textarea
                                      value={editingValues.observaciones}
                                      onChange={(e) => setEditingValues((v) => ({ ...v, observaciones: e.target.value }))}
                                      rows={2}
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm min-w-[120px]"
                                    />
                                  ) : (
                                    <span className="truncate block" title={row.observaciones ?? undefined}>
                                      {row.observaciones?.trim() || "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 align-top">
                                  {isEditing ? (
                                    <div className="flex flex-wrap gap-1 items-start">
                                      <button
                                        type="button"
                                        onClick={handleSaveProposalEdit}
                                        disabled={servicesSaving}
                                        className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {servicesSaving ? "Guardando…" : "Guardar"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingServiceId(null);
                                          setEditingValues({ mes: 1, precio: "", alcance_editado: "", observaciones: "" });
                                        }}
                                        disabled={servicesSaving}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProposal(row.id)}
                                        disabled={deletingServiceId !== null}
                                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {deletingServiceId === row.id ? "Eliminando…" : "Eliminar"}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingServiceId(row.id);
                                          setEditingValues({
                                            mes: row.mes,
                                            precio: row.precio != null ? String(row.precio) : "",
                                            alcance_editado: row.alcance_editado?.trim() ?? "",
                                            observaciones: row.observaciones?.trim() ?? "",
                                          });
                                        }}
                                        className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProposal(row.id)}
                                        disabled={deletingServiceId !== null}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {deletingServiceId === row.id ? "Eliminando…" : "Eliminar"}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
                        const catalogService = servicesCatalog.find((c) => c.id === row.service_id);
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
          )}

          {activeTab === "acciones" && id && (
            <Acciones leadId={id} />
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