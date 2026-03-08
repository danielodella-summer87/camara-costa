-- Draft de propuesta comercial (matriz servicio x mes) y marca de confirmación
-- Permite guardar/restaurar la tabla mensual sin cambiar lead_service_proposals

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS proposal_draft_json TEXT NULL;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS proposal_confirmed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.leads.proposal_draft_json IS 'JSON con months y rows de la matriz de propuesta (draft). Se persiste con debounce al editar.';
COMMENT ON COLUMN public.leads.proposal_confirmed_at IS 'Fecha en que el usuario confirmó la estructura de propuesta; null = en construcción.';
