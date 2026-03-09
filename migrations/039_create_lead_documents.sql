-- ============================================
-- Tabla lead_documents: documentos comerciales generados por Gamma por lead
-- (diagnóstico, estrategia, propuesta). Persistencia de URLs cuando Gamma completa.
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  generation_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lead_documents_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT lead_documents_type_check
    CHECK (type IN ('diagnostic', 'strategy', 'proposal'))
);

CREATE INDEX IF NOT EXISTS idx_lead_documents_lead_id
  ON public.lead_documents(lead_id);

COMMENT ON TABLE public.lead_documents IS 'Documentos comerciales generados por Gamma: diagnóstico, estrategia, propuesta. Una fila por generación completada.';
COMMENT ON COLUMN public.lead_documents.type IS 'diagnostic | strategy | proposal';
COMMENT ON COLUMN public.lead_documents.url IS 'URL del documento (pdfUrl o gammaUrl de Gamma).';
COMMENT ON COLUMN public.lead_documents.generation_id IS 'ID de generación de Gamma.';
