-- Fase 1: Iniciativas (tabla física empresas sin renombrar).
-- Columnas de revisión, fuente remota, score preliminar, vínculo lead convertido.
-- leads.iniciativa_id = snapshot de origen (FK empresas).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS estado_revision text DEFAULT 'nueva',
  ADD COLUMN IF NOT EXISTS fuente_remota text,
  ADD COLUMN IF NOT EXISTS score_preliminar smallint,
  ADD COLUMN IF NOT EXISTS converted_lead_id uuid;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS iniciativa_id uuid;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_score_preliminar_range;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_score_preliminar_range
  CHECK (score_preliminar IS NULL OR (score_preliminar >= 0 AND score_preliminar <= 10));

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_estado_revision_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_estado_revision_check
  CHECK (
    estado_revision IS NULL
    OR estado_revision IN (
      'nueva',
      'importada',
      'en_revision',
      'validada',
      'descartada',
      'convertida_a_lead'
    )
  );

COMMENT ON COLUMN public.empresas.estado_revision IS 'Ciclo de vida de la iniciativa (ingreso preliminar antes del lead comercial).';
COMMENT ON COLUMN public.empresas.fuente_remota IS 'Origen externo (ej. LinkedIn, integración).';
COMMENT ON COLUMN public.empresas.score_preliminar IS 'Score 0–10 antes de convertir a lead; nullable.';
COMMENT ON COLUMN public.empresas.converted_lead_id IS 'Lead creado por conversión explícita; idempotencia.';
COMMENT ON COLUMN public.leads.iniciativa_id IS 'Iniciativa (empresa) de origen al convertir; snapshot en columnas del lead, no lectura en vivo obligatoria.';

-- Primer lead por empresa (cronológico) para backfill de conversión canónica
UPDATE public.empresas e
SET converted_lead_id = l.first_id
FROM (
  SELECT DISTINCT ON (empresa_id)
    empresa_id AS eid,
    id AS first_id
  FROM public.leads
  WHERE empresa_id IS NOT NULL
  ORDER BY empresa_id, created_at ASC NULLS LAST, id ASC
) l
WHERE e.id = l.eid
  AND e.converted_lead_id IS NULL;

UPDATE public.leads
SET iniciativa_id = empresa_id
WHERE empresa_id IS NOT NULL
  AND iniciativa_id IS NULL;

UPDATE public.empresas
SET estado_revision = CASE
  WHEN converted_lead_id IS NOT NULL THEN 'convertida_a_lead'
  WHEN lower(trim(coalesce(estado, ''))) ~* '(rechaz|descart)' THEN 'descartada'
  WHEN aprobada IS TRUE THEN 'validada'
  WHEN import_batch_id IS NOT NULL THEN 'importada'
  ELSE 'en_revision'
END;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_iniciativa_id_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_iniciativa_id_fkey
  FOREIGN KEY (iniciativa_id) REFERENCES public.empresas (id) ON DELETE SET NULL;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_converted_lead_id_fkey;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_converted_lead_id_fkey
  FOREIGN KEY (converted_lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
