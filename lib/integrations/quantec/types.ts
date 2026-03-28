/** Respuesta enriquecida posible del webhook (campos opcionales según lo que devuelva n8n). */
export type QuantecRawLeadPayload = {
  empresa?: string;
  sitio_web?: string;
  tamano_empresa?: string;
  contacto_nombre?: string;
  contacto_cargo?: string;
  linkedin_persona?: string;
  linkedin_empresa?: string;
  email?: string;
  telefono?: string;
};

/** Acuse típico cuando el workflow arranca pero aún no hay lead en la misma respuesta. */
export type QuantecWorkflowStartedPayload = {
  message: string;
};

/** Unión de formas conocidas de respuesta del webhook Quantec/n8n. */
export type QuantecWebhookResponse =
  | QuantecRawLeadPayload
  | QuantecWorkflowStartedPayload;

export type QuantecFetchSuccess = {
  ok: true;
  status: number;
  durationMs: number;
  accepted: true;
  isLeadPayload: boolean;
  payload: QuantecRawLeadPayload | QuantecWorkflowStartedPayload | Record<string, unknown>;
};

export type QuantecFetchFailure = {
  ok: false;
  status: number;
  durationMs: number;
  error: string;
};

export type QuantecFetchResult = QuantecFetchSuccess | QuantecFetchFailure;
