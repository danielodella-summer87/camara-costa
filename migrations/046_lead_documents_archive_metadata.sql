-- Metadatos de archivado: Gamma como origen, CRM como repositorio oficial (url + file_url + status).

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'gamma';

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS gamma_url text NULL;

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS file_url text NULL;

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.lead_documents DROP CONSTRAINT IF EXISTS lead_documents_status_check;
ALTER TABLE public.lead_documents ADD CONSTRAINT lead_documents_status_check
  CHECK (status IS NULL OR status IN ('pending', 'archived', 'failed'));

COMMENT ON COLUMN public.lead_documents.source IS 'Origen: gamma, crm, leads87, etc.';
COMMENT ON COLUMN public.lead_documents.gamma_url IS 'URL Gamma efímera (export PDF) conocida, si aplica.';
COMMENT ON COLUMN public.lead_documents.file_url IS 'URL estable en storage propio; alineada con url cuando está archivado.';
COMMENT ON COLUMN public.lead_documents.status IS 'pending | archived | failed';

CREATE OR REPLACE FUNCTION public.lead_documents_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_documents_updated_at ON public.lead_documents;
CREATE TRIGGER trg_lead_documents_updated_at
  BEFORE UPDATE ON public.lead_documents
  FOR EACH ROW
  EXECUTE PROCEDURE public.lead_documents_touch_updated_at();

-- Backfill conservador (no pisa valores ya cargados).
UPDATE public.lead_documents
SET
  file_url = COALESCE(
    NULLIF(trim(file_url), ''),
    CASE
      WHEN trim(url) LIKE '%/storage/v1/object/public/documents/%' THEN trim(url)
      WHEN trim(url) LIKE '%/storage/v1/object/public/lead-docs/%' THEN trim(url)
      WHEN trim(url) LIKE '%/storage/v1/object/public/lead-proposals/%' THEN trim(url)
      ELSE NULL
    END
  ),
  gamma_url = COALESCE(
    NULLIF(trim(gamma_url), ''),
    CASE
      WHEN trim(url) ~* 'assets\.api\.gamma\.app' AND lower(trim(url)) LIKE '%/export/pdf/%' THEN trim(url)
      ELSE NULL
    END
  ),
  status = CASE
    WHEN trim(url) LIKE '%/storage/v1/object/public/documents/%'
      OR trim(url) LIKE '%/storage/v1/object/public/lead-docs/%'
      OR trim(url) LIKE '%/storage/v1/object/public/lead-proposals/%'
      OR lower(trim(url)) LIKE 'data:text/%' THEN 'archived'
    WHEN trim(url) ~* 'assets\.api\.gamma\.app' AND lower(trim(url)) LIKE '%/export/pdf/%' THEN 'pending'
    WHEN trim(url) ~ '^https?://' THEN 'archived'
    ELSE COALESCE(status, 'pending')
  END,
  source = COALESCE(NULLIF(trim(source), ''), 'gamma'),
  updated_at = COALESCE(updated_at, now())
WHERE true;
