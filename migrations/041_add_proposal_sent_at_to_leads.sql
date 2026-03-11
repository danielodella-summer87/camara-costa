-- Registro de envío de propuesta al cliente (cierre del proceso comercial)

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.leads.proposal_sent_at IS 'Fecha en que se marcó la propuesta como enviada al cliente; null = aún no enviada.';
