/**
 * Proposal Export Payload — fuente única de verdad para la propuesta económica.
 * Alimenta: PDF propuesta económica, Gamma propuesta económica, versión texto, vista web cliente.
 * No inventa datos; devuelve null o string vacío cuando no existe.
 */

export type ProposalExportLead = {
  id: string | null;
  nombre: string | null;
  empresa: string | null;
  rubro: string | null;
  website: string | null;
};

export type ProposalExportProposal = {
  title: string;
  subtitle: string;
  executiveSummary: string;
  confirmedAt: string | null;
};

export type ProposalExportMonth = { key: string; label: string };

export type ProposalExportRow = {
  proposalId: string;
  serviceId: string;
  codigo: string | null;
  nombre: string | null;
  monthlyValues: Record<string, number>;
  rowTotal: number;
};

export type ProposalExportMonthlyTable = {
  months: ProposalExportMonth[];
  rows: ProposalExportRow[];
  totalsByMonth: Record<string, number>;
  grandTotal: number;
};

export type ProposalExportService = {
  proposalId: string;
  serviceId: string;
  codigo: string | null;
  nombre: string | null;
  billingType: string | null;
  strategicReason: string;
  salesArgument: string;
  priceBaseText: string;
};

export type ProposalExportNarrative = {
  summary: string;
  objectives: string[];
  whyNow: string;
  nextStep: string;
};

export type ProposalExportEconomics = {
  oneTimeTotalText: string;
  monthlyTotalText: string;
  totalBaseText: string;
};

export type ProposalExportMeeting = {
  label: string;
  bookingUrl: string;
  location: string;
};

export type ProposalExportContact = {
  agencyName: string;
  website: string;
  whatsapp: string;
  whatsappUrl: string;
  ackMailTo: string;
  meeting: ProposalExportMeeting;
};

export type ProposalExportPayload = {
  lead: ProposalExportLead;
  proposal: ProposalExportProposal;
  monthlyTable: ProposalExportMonthlyTable | null;
  services: ProposalExportService[];
  narrative: ProposalExportNarrative;
  economics: ProposalExportEconomics;
  contact: ProposalExportContact;
};

/** URL única para agendar reunión con EASY (CTA principal en propuesta y PDF). */
export const MEETING_BOOKING_URL = "https://easydigitalagency.com/uruguay-2/";

const DEFAULT_MEETING: ProposalExportMeeting = {
  label: "Agendar Reunión con EASY",
  bookingUrl: MEETING_BOOKING_URL,
  location: "World Trade Center Torre 4, piso 40, Montevideo, Uruguay",
};

const DEFAULT_CONTACT: ProposalExportContact = {
  agencyName: "EASY Digital Agency",
  website: "https://www.easydigitalagency.com",
  whatsapp: "+59894735020",
  whatsappUrl: "https://wa.me/59894735020",
  ackMailTo: "comercial@easydigitalagency.com",
  meeting: DEFAULT_MEETING,
};

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toStr(v: string | null | undefined): string {
  return v ?? "";
}

/** Formatea monto con moneda para texto; si no hay moneda o hay varias, devuelve "—" o "Monedas mixtas". */
export function toMoneyText(
  amount: number,
  moneda: string | null | undefined,
  options?: { mixedLabel?: string }
): string {
  if (!Number.isFinite(amount)) return options?.mixedLabel ?? "—";
  const m = moneda?.trim();
  if (m) return `${m} ${amount.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return amount.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Parsea proposal_draft_json y devuelve months y rows (sin nombres; se completan con leadServices después). */
export function parseProposalDraft(draftJson: unknown): {
  months: ProposalExportMonth[];
  rows: Array<{ proposalId: string; serviceId: string; monthlyValues: Record<string, number> }>;
} {
  if (draftJson === null || draftJson === undefined) return { months: [], rows: [] };
  const raw = typeof draftJson === "string" ? draftJson.trim() : "";
  if (!raw) return { months: [], rows: [] };
  try {
    const parsed = JSON.parse(raw) as {
      months?: Array<{ key: string; label?: string }>;
      rows?: Array<{ proposalId: string; serviceId: string; valuesByMonth?: Record<string, number | ""> }>;
    };
    const months: ProposalExportMonth[] = Array.isArray(parsed?.months)
      ? parsed.months.map((m) => ({ key: m?.key ?? "", label: m?.label ?? m?.key ?? "" }))
      : [];
    const rows: Array<{ proposalId: string; serviceId: string; monthlyValues: Record<string, number> }> = [];
    if (Array.isArray(parsed?.rows)) {
      for (const r of parsed.rows) {
        if (!r?.proposalId || !r?.serviceId) continue;
        const valuesByMonth = r.valuesByMonth && typeof r.valuesByMonth === "object" ? r.valuesByMonth : {};
        const monthlyValues: Record<string, number> = {};
        for (const [k, v] of Object.entries(valuesByMonth)) {
          const n = typeof v === "number" && Number.isFinite(v) ? v : (typeof v === "string" && v !== "" ? Number(v) : 0);
          if (!Number.isNaN(n)) monthlyValues[k] = n;
        }
        rows.push({ proposalId: r.proposalId, serviceId: r.serviceId, monthlyValues });
      }
    }
    return { months, rows };
  } catch {
    return { months: [], rows: [] };
  }
}

/** Construye la tabla mensual desde el draft y enriquece filas con codigo/nombre desde leadServices; incluye rowTotal y totalsByMonth. */
export function buildMonthlyTableFromDraft(
  draft: { months: ProposalExportMonth[]; rows: Array<{ proposalId: string; serviceId: string; monthlyValues: Record<string, number> }> },
  leadServices: BuildProposalPayloadService[]
): ProposalExportMonthlyTable | null {
  if (draft.months.length === 0 || draft.rows.length === 0) return null;
  const totalsByMonth: Record<string, number> = {};
  for (const m of draft.months) {
    let sum = 0;
    for (const row of draft.rows) sum += row.monthlyValues[m.key] ?? 0;
    totalsByMonth[m.key] = sum;
  }
  const grandTotal = Object.values(totalsByMonth).reduce((a, b) => a + b, 0);
    const rows: ProposalExportRow[] = draft.rows.map((r) => {
    const svc = leadServices.find(
      (s) =>
        s.id === r.proposalId ||
        (s.service_id && s.service_id === r.serviceId) ||
        (s.agency_service_id && s.agency_service_id === r.serviceId)
    );
    const rowTotal = Object.values(r.monthlyValues).reduce((a, b) => a + b, 0);
    return {
      proposalId: r.proposalId,
      serviceId: r.serviceId,
      codigo: svc ? safeStr(svc.codigo) ?? null : null,
      nombre: svc ? safeStr(svc.nombre) ?? null : null,
      monthlyValues: r.monthlyValues,
      rowTotal,
    };
  });
  return { months: draft.months, rows, totalsByMonth, grandTotal };
}

/** Fallback: tabla simple desde leadServices (un mes, precio por servicio). */
export function buildMonthlyTableFromLeadServices(
  leadServices: BuildProposalPayloadService[]
): ProposalExportMonthlyTable | null {
  if (leadServices.length === 0) return null;
  const months: ProposalExportMonth[] = [{ key: "m1", label: "Mes 1" }];
  let grandTotal = 0;
  const rows: ProposalExportRow[] = leadServices.map((s) => {
    const precio = Number(s.precio) || 0;
    grandTotal += precio;
    const sid = safeStr(s.service_id) ?? safeStr(s.agency_service_id) ?? "";
    return {
      proposalId: s.id,
      serviceId: sid,
      codigo: safeStr(s.codigo) ?? null,
      nombre: safeStr(s.nombre) ?? null,
      monthlyValues: { m1: precio },
      rowTotal: precio,
    };
  });
  return { months, rows, totalsByMonth: { m1: grandTotal }, grandTotal };
}

/** Resumen económico: implementación única, inversión mensual, total base. */
export function buildProposalEconomics(leadServices: BuildProposalPayloadService[]): ProposalExportEconomics {
  const oneTime = leadServices.filter((s) => String(s.billing_type ?? "").toLowerCase() === "one_time");
  const monthly = leadServices.filter((s) => String(s.billing_type ?? "").toLowerCase() === "monthly");
  const totalOne = oneTime.reduce((a, s) => a + (Number(s.precio) || 0), 0);
  const totalMon = monthly.reduce((a, s) => a + (Number(s.precio) || 0), 0);
  const totalGen = totalOne + totalMon;
  const currenciesOne = [...new Set(oneTime.map((s) => s.moneda?.trim()).filter(Boolean))] as string[];
  const currenciesMon = [...new Set(monthly.map((s) => s.moneda?.trim()).filter(Boolean))] as string[];
  const currenciesAll = [...new Set(leadServices.map((s) => s.moneda?.trim()).filter(Boolean))] as string[];
  const oneTimeTotalText =
    currenciesOne.length > 1 ? "Monedas mixtas" : toMoneyText(totalOne, currenciesOne[0]);
  const monthlyTotalText =
    currenciesMon.length > 1 ? "Monedas mixtas" : toMoneyText(totalMon, currenciesMon[0]);
  const totalBaseText =
    currenciesAll.length > 1 ? "Monedas mixtas" : toMoneyText(totalGen, currenciesAll[0]);
  return { oneTimeTotalText, monthlyTotalText, totalBaseText };
}

/** Narrativa: normaliza a strings; objectives como array. */
export function buildProposalNarrative(input?: {
  summary?: string | null;
  objectives?: string | string[] | null;
  whyNow?: string | null;
  nextStep?: string | null;
} | null): ProposalExportNarrative {
  if (!input) {
    return { summary: "", objectives: [], whyNow: "", nextStep: "" };
  }
  const objectives = Array.isArray(input.objectives)
    ? input.objectives.map((o) => String(o ?? "").trim()).filter(Boolean)
    : input.objectives != null && input.objectives !== ""
    ? [String(input.objectives).trim()]
    : [];
  return {
    summary: toStr(safeStr(input.summary)),
    objectives,
    whyNow: toStr(safeStr(input.whyNow)),
    nextStep: toStr(safeStr(input.nextStep)),
  };
}

/** Servicios para export: codigo, nombre, billingType, strategicReason, salesArgument, priceBaseText. */
export function buildProposalServices(
  leadServices: BuildProposalPayloadService[],
  monthlyTable: ProposalExportMonthlyTable | null
): ProposalExportService[] {
  return leadServices.map((s) => {
    const salesArg = safeStr(s.alcance_editado) ?? safeStr(s.observaciones);
    const priceBase = s.precio != null && Number.isFinite(Number(s.precio))
      ? toMoneyText(Number(s.precio), s.moneda)
      : "—";
    return {
      proposalId: s.id,
      serviceId: safeStr(s.service_id) ?? safeStr(s.agency_service_id) ?? "",
      codigo: safeStr(s.codigo) ?? null,
      nombre: safeStr(s.nombre) ?? null,
      billingType: safeStr(s.billing_type) ?? null,
      strategicReason: "",
      salesArgument: salesArg ?? "",
      priceBaseText: priceBase,
    };
  });
}

/** Lead mínimo con empresa y propuesta (desde API o estado frontend). */
export type BuildProposalPayloadLead = {
  id?: string | null;
  nombre?: string | null;
  website?: string | null;
  proposal_draft_json?: string | null;
  proposal_confirmed_at?: string | null;
  empresas?: { nombre?: string | null; rubro_id?: string | null; rubros?: { nombre?: string | null } | null } | null;
};

/** Servicio de propuesta (lead_service_proposals + catálogo). */
export type BuildProposalPayloadService = {
  id: string;
  service_id?: string | null;
  agency_service_id?: string | null;
  codigo?: string | null;
  nombre?: string | null;
  mes?: number;
  precio?: number | null;
  moneda?: string | null;
  alcance_editado?: string | null;
  observaciones?: string | null;
  billing_type?: string | null;
};

export type BuildProposalPayloadInput = {
  lead: BuildProposalPayloadLead | null;
  leadServices: BuildProposalPayloadService[];
  /** Narrativa: summary, objectives (string o string[]), whyNow, nextStep. */
  narrative?: {
    summary?: string | null;
    objectives?: string | string[] | null;
    whyNow?: string | null;
    nextStep?: string | null;
  } | null;
  /** Contacto de la agencia (opcional). */
  contact?: Partial<ProposalExportContact> | null;
};

/**
 * Construye el payload unificado para la propuesta económica (fuente única de verdad).
 * Usa proposal_draft_json si existe; si no, fallback a leadServices para tabla simple.
 * Para: PDF propuesta económica, Gamma propuesta económica, texto copiable, vista web cliente.
 */
export function buildProposalExportPayload(input: BuildProposalPayloadInput): ProposalExportPayload {
  const { lead, leadServices, narrative, contact: contactOverride = null } = input;
  const contact: ProposalExportContact = {
    ...DEFAULT_CONTACT,
    ...contactOverride,
    ackMailTo: (contactOverride as any)?.ackMailTo ?? (contactOverride as any)?.emailAckTo ?? DEFAULT_CONTACT.ackMailTo,
    meeting: (contactOverride as any)?.meeting ?? DEFAULT_CONTACT.meeting,
  };

  const empresa = lead?.empresas;
  const rubroNombre = (empresa as { rubros?: { nombre?: string | null } | null })?.rubros?.nombre ?? null;

  const payloadLead: ProposalExportLead = {
    id: lead?.id ?? null,
    nombre: safeStr(lead?.nombre) ?? null,
    empresa: safeStr((empresa as { nombre?: string | null })?.nombre) ?? null,
    rubro: safeStr(rubroNombre) ?? null,
    website: safeStr(lead?.website ?? (empresa as { web?: string | null })?.web) ?? null,
  };

  const confirmedAt = safeStr(lead?.proposal_confirmed_at) ?? null;
  const subtitle = payloadLead.empresa || payloadLead.nombre ? `Propuesta para ${payloadLead.empresa || payloadLead.nombre}` : "Propuesta EASY";
  const payloadNarrative = buildProposalNarrative(narrative);
  const executiveSummary =
    payloadNarrative.summary ||
    (payloadLead.nombre || payloadLead.empresa ? `Propuesta comercial para ${payloadLead.empresa || payloadLead.nombre}. Servicios e inversión según detalle.` : "");

  const proposal: ProposalExportProposal = {
    title: "Propuesta comercial",
    subtitle,
    executiveSummary,
    confirmedAt,
  };

  const draft = parseProposalDraft(lead?.proposal_draft_json);
  let monthlyTable: ProposalExportMonthlyTable | null =
    buildMonthlyTableFromDraft(draft, leadServices) ?? buildMonthlyTableFromLeadServices(leadServices);

  const services = buildProposalServices(leadServices, monthlyTable);
  const economics = buildProposalEconomics(leadServices);

  return {
    lead: payloadLead,
    proposal,
    monthlyTable,
    services,
    narrative: payloadNarrative,
    economics,
    contact,
  };
}

/** URLs y textos para la capa de respuesta del cliente (CTA debajo del PDF/vista final). */
export const PROPOSAL_CLIENT_ACTIONS = {
  emailAck: {
    subject: "He leído la propuesta de EASY",
    body: "Hola,\n\nHe leído la propuesta comercial que me enviaron.\n\nSaludos.",
  },
  whatsappNumber: "59894735020",
  whatsappUrl: "https://wa.me/59894735020",
  websiteUrl: "https://www.easydigitalagency.com",
  meetingRequestText:
    "Hola, me gustaría agendar una reunión breve para revisar la propuesta comercial que me enviaron. ¿Qué horarios tienen disponibles?",
  meeting: {
    label: "Agendar Reunión con EASY",
    bookingUrl: MEETING_BOOKING_URL,
    location: "World Trade Center Torre 4, piso 40, Montevideo, Uruguay",
    supportText: "Podemos revisar esta propuesta juntos en una reunión breve.",
  },
} as const;
