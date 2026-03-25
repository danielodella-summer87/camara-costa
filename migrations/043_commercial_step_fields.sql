-- Campos persistidos para paso comercial LEADS87 (propuesta / presentación / cierre).
-- + tipo presentation en lead_documents

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS proposal_doc_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS presentation_doc_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS proposal_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS commercial_stage TEXT NULL;

COMMENT ON COLUMN public.leads.proposal_doc_url IS 'URL vigente del documento de propuesta comercial (espejo de lead_documents.proposal).';
COMMENT ON COLUMN public.leads.presentation_doc_url IS 'URL vigente de la presentación comercial para el cliente (espejo de lead_documents.presentation).';
COMMENT ON COLUMN public.leads.proposal_reviewed IS 'True cuando el comercial confirmó la revisión de la propuesta en LEADS87.';
COMMENT ON COLUMN public.leads.commercial_stage IS 'Sub-etapa comercial: closing = avanzó a cierre desde presentación.';

ALTER TABLE public.lead_documents DROP CONSTRAINT IF EXISTS lead_documents_type_check;
ALTER TABLE public.lead_documents ADD CONSTRAINT lead_documents_type_check
  CHECK (type IN ('diagnostic', 'strategy', 'proposal', 'presentation'));

COMMENT ON COLUMN public.lead_documents.type IS 'diagnostic | strategy | proposal | presentation';

-- Leads que ya estaban en Presentación o más allá con propuesta guardada: asumir revisión confirmada.
UPDATE public.leads l
SET proposal_reviewed = TRUE
WHERE COALESCE(l.proposal_reviewed, FALSE) = FALSE
  AND EXISTS (
    SELECT 1
    FROM public.lead_documents d
    WHERE d.lead_id = l.id
      AND d.type = 'proposal'
      AND length(trim(d.url)) > 0
  )
  AND lower(trim(COALESCE(l.pipeline, ''))) IN (
    'presentación',
    'presentacion',
    'seguimiento',
    'ganado',
    'cierre'
  );
