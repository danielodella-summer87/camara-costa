-- ============================================
-- Crear tabla lead_docs para documentación de leads
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_bucket TEXT NOT NULL DEFAULT 'lead-docs',
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NULL,
  
  CONSTRAINT lead_docs_lead_id_fkey 
    FOREIGN KEY (lead_id) 
    REFERENCES public.leads(id) 
    ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_docs_lead_id ON public.lead_docs(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_docs_created_at ON public.lead_docs(created_at DESC);

-- Comentarios
COMMENT ON TABLE public.lead_docs IS 'Documentación PDF asociada a leads';
COMMENT ON COLUMN public.lead_docs.file_bucket IS 'Bucket de Supabase Storage donde se guarda el archivo';
COMMENT ON COLUMN public.lead_docs.file_path IS 'Ruta del archivo en el bucket';
