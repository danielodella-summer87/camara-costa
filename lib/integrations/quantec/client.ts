import type {
  QuantecFetchFailure,
  QuantecFetchResult,
  QuantecFetchSuccess,
  QuantecRawLeadPayload,
  QuantecWorkflowStartedPayload,
} from "./types";

const QUANTEC_WEBHOOK_URL =
  "https://n8n.srv1268314.hstgr.cloud/webhook/f9fd5fd9-a3ee-4f0a-9e64-f0eb2cc39c3a";

const DEFAULT_TIMEOUT_MS = 15_000;

const LEAD_SIGNAL_KEYS = [
  "empresa",
  "email",
  "linkedin_persona",
  "linkedin_empresa",
] as const;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function hasLeadSignal(obj: Record<string, unknown>): boolean {
  return LEAD_SIGNAL_KEYS.some((k) => isNonEmptyString(obj[k]));
}

function pickLeadPayload(obj: Record<string, unknown>): QuantecRawLeadPayload {
  return {
    empresa: isNonEmptyString(obj.empresa) ? obj.empresa : undefined,
    sitio_web: isNonEmptyString(obj.sitio_web) ? obj.sitio_web : undefined,
    tamano_empresa: isNonEmptyString(obj.tamano_empresa) ? obj.tamano_empresa : undefined,
    contacto_nombre: isNonEmptyString(obj.contacto_nombre) ? obj.contacto_nombre : undefined,
    contacto_cargo: isNonEmptyString(obj.contacto_cargo) ? obj.contacto_cargo : undefined,
    linkedin_persona: isNonEmptyString(obj.linkedin_persona)
      ? obj.linkedin_persona
      : undefined,
    linkedin_empresa: isNonEmptyString(obj.linkedin_empresa)
      ? obj.linkedin_empresa
      : undefined,
    email: isNonEmptyString(obj.email) ? obj.email : undefined,
    telefono: isNonEmptyString(obj.telefono) ? obj.telefono : undefined,
  };
}

function classifyQuantecBody(
  raw: unknown
): Pick<QuantecFetchSuccess, "isLeadPayload" | "payload"> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      isLeadPayload: false,
      payload: {},
    };
  }

  const obj = raw as Record<string, unknown>;

  if (hasLeadSignal(obj)) {
    return { isLeadPayload: true, payload: pickLeadPayload(obj) };
  }

  if (isNonEmptyString(obj.message)) {
    const workflow: QuantecWorkflowStartedPayload = {
      message: obj.message.trim(),
    };
    return { isLeadPayload: false, payload: workflow };
  }

  return { isLeadPayload: false, payload: { ...obj } as Record<string, unknown> };
}

/**
 * POST al webhook externo de Quantec desde el backend.
 * - AbortController para timeout
 * - Clasifica respuesta: lead enriquecido vs acuse de workflow (message-only)
 */
export async function postQuantecWebhook(params?: {
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<QuantecFetchResult> {
  const timeoutMs = params?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();

  try {
    const response = await fetch(QUANTEC_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params?.body ?? {}),
      cache: "no-store",
      signal: controller.signal,
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const failure: QuantecFetchFailure = {
        ok: false,
        status: response.status,
        durationMs,
        error: `Quantec respondió con HTTP ${response.status}`,
      };
      return failure;
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      const failure: QuantecFetchFailure = {
        ok: false,
        status: response.status,
        durationMs,
        error: "Quantec devolvió un cuerpo que no es JSON válido",
      };
      return failure;
    }

    const { isLeadPayload, payload } = classifyQuantecBody(parsed);

    const success: QuantecFetchSuccess = {
      ok: true,
      status: response.status,
      durationMs,
      accepted: true,
      isLeadPayload,
      payload,
    };
    return success;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido al llamar a Quantec";

    const failure: QuantecFetchFailure = {
      ok: false,
      status: 500,
      durationMs,
      error: message,
    };
    return failure;
  } finally {
    clearTimeout(timeoutId);
  }
}
