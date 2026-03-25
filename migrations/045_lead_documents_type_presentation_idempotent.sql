-- Asegura que lead_documents acepte type = 'presentation' (si 043 no corrió en este entorno).
-- Corrige el error: violates check constraint "lead_documents_type_check"

ALTER TABLE public.lead_documents DROP CONSTRAINT IF EXISTS lead_documents_type_check;
ALTER TABLE public.lead_documents ADD CONSTRAINT lead_documents_type_check
  CHECK (type IN ('diagnostic', 'strategy', 'proposal', 'presentation'));

COMMENT ON COLUMN public.lead_documents.type IS 'diagnostic | strategy | proposal | presentation';
