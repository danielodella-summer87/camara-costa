-- =============================================================================
-- CONSOLIDADO IDEMPOTENTE — empresas, leads, config
-- =============================================================================
--
-- A. PROPÓSITO
--    Alinear la base con el código actual cuando solo existe migración inicial
--    o el esquema está a medias. Equivalente lógico (en orden) a:
--      • 20260327120000_lead_commercial_strategy.sql
--      • 20260327140000_iniciativas_empresas_leads.sql
--      • 20260328120000_linkedin_iniciativa_lead.sql
--      • 20260328180000_empresas_leads_initiative_startup.sql
--      • 20260329120000_leads_linkedin_canonical.sql
--      • 20260329140000_allow_multiple_leads_per_initiative.sql
--
-- B. TABLAS AFECTADAS
--    • public.config (creación si no existe + 1 fila de configuración)
--    • public.empresas (columnas + CHECK + FK + comentarios)
--    • public.leads (columnas + CHECK + FK + comentarios)
--
-- C. ERRORES QUE CUBRE (columnas faltantes típicas)
--    • empresas.linkedin_empresa / linkedin_personal
--    • leads.initiative_kind / project_description
--    • leads.linkedin_empresa / linkedin_personal
--    • empresas.estado_revision, fuente_remota, score_preliminar, converted_lead_id
--    • leads.iniciativa_id, commercial_strategy_json, strategy_approved_at
--    • Falta de fila allow_multiple_leads_per_initiative en config
--
-- D. SEGURIDAD
--    • No DROP de columnas ni tablas.
--    • Backfills: solo rellenan NULL / cadenas vacías donde se indica.
--    • El bloque de estado_revision (sección 5) recalcula TODAS las filas de
--      empresas según reglas de negocio. Si necesitás preservar valores
--      manuales en estado_revision, comentá esa sección antes de ejecutar.
--
-- E. VALIDACIÓN POST-EJECUCIÓN (ejecutar aparte)
--    Ver final del archivo (comentarios).
--
-- F. SUPABASE CLI (alternativa a pegar este archivo)
--    Desde la raíz del repo (con proyecto linkeado):
--      supabase db push
--    Aplica en orden todos los .sql de supabase/migrations/ (idempotente).
--    Si ya aplicaste este script a mano, db push seguirá siendo seguro (IF NOT EXISTS).
--    Para sincronizar el historial de migraciones: supabase migration repair
--
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. config (requerida por allow_multiple_leads_per_initiative)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_key ON public.config (key);

-- ---------------------------------------------------------------------------
-- 1. public.empresas — columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS import_batch_id UUID NULL;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS estado_revision text DEFAULT 'nueva',
  ADD COLUMN IF NOT EXISTS fuente_remota text,
  ADD COLUMN IF NOT EXISTS score_preliminar smallint,
  ADD COLUMN IF NOT EXISTS converted_lead_id uuid;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS linkedin_empresa text,
  ADD COLUMN IF NOT EXISTS linkedin_personal text;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS project_description text;

-- ---------------------------------------------------------------------------
-- 2. public.leads — columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS iniciativa_id uuid;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS linkedin_empresa text,
  ADD COLUMN IF NOT EXISTS linkedin_personal text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS project_description text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS commercial_strategy_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS strategy_approved_at TIMESTAMPTZ NULL;

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints (recrear para idempotencia)
-- ---------------------------------------------------------------------------
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

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_initiative_kind_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_initiative_kind_check
  CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_initiative_kind_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_initiative_kind_check
  CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));

-- ---------------------------------------------------------------------------
-- 4. Backfills (sin borrar datos; solo completar vacíos)
-- ---------------------------------------------------------------------------

-- Primer lead por empresa (cronológico) → converted_lead_id
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
SET initiative_kind = 'standard'
WHERE initiative_kind IS NULL;

UPDATE public.leads
SET initiative_kind = 'standard'
WHERE initiative_kind IS NULL;

-- LinkedIn personal desde legacy linkedin_director (solo si la columna existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'linkedin_director'
  ) THEN
    UPDATE public.leads
    SET linkedin_personal = linkedin_director
    WHERE (linkedin_personal IS NULL OR btrim(linkedin_personal) = '')
      AND linkedin_director IS NOT NULL
      AND btrim(linkedin_director) <> '';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Inferencia de estado_revision (afecta todas las filas de empresas)
--    Ver nota en cabecera si necesitás no sobrescribir valores manuales.
-- ---------------------------------------------------------------------------
UPDATE public.empresas
SET estado_revision = CASE
  WHEN converted_lead_id IS NOT NULL THEN 'convertida_a_lead'
  WHEN lower(trim(coalesce(estado, ''))) ~* '(rechaz|descart)' THEN 'descartada'
  WHEN aprobada IS TRUE THEN 'validada'
  WHEN import_batch_id IS NOT NULL THEN 'importada'
  ELSE 'en_revision'
END;

-- ---------------------------------------------------------------------------
-- 6. Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_iniciativa_id_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_iniciativa_id_fkey
  FOREIGN KEY (iniciativa_id) REFERENCES public.empresas (id) ON DELETE SET NULL;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_converted_lead_id_fkey;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_converted_lead_id_fkey
  FOREIGN KEY (converted_lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 7. Configuración: varios leads por iniciativa (default conservador)
-- ---------------------------------------------------------------------------
INSERT INTO public.config (key, value)
VALUES ('allow_multiple_leads_per_initiative', 'false')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Comentarios
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.empresas.estado_revision IS 'Ciclo de vida de la iniciativa (ingreso preliminar antes del lead comercial).';
COMMENT ON COLUMN public.empresas.fuente_remota IS 'Origen externo (ej. LinkedIn, integración).';
COMMENT ON COLUMN public.empresas.score_preliminar IS 'Score 0–10 antes de convertir a lead; nullable.';
COMMENT ON COLUMN public.empresas.converted_lead_id IS 'Lead creado por conversión explícita; idempotencia.';
COMMENT ON COLUMN public.leads.iniciativa_id IS 'Iniciativa (empresa) de origen al convertir; snapshot en columnas del lead.';
COMMENT ON COLUMN public.empresas.linkedin_empresa IS 'LinkedIn de la organización (ingreso en iniciativa).';
COMMENT ON COLUMN public.empresas.linkedin_personal IS 'LinkedIn del contacto (ingreso en iniciativa).';
COMMENT ON COLUMN public.leads.linkedin_empresa IS 'URL o perfil LinkedIn de la organización.';
COMMENT ON COLUMN public.leads.linkedin_personal IS 'URL o perfil LinkedIn del contacto (campo canónico).';
COMMENT ON COLUMN public.leads.commercial_strategy_json IS 'Estado de estrategia: { generated, edited, userInputs } (LEADS87).';
COMMENT ON COLUMN public.leads.strategy_approved_at IS 'Confirmación explícita de estrategia; requerida para avanzar a estructura de servicios.';

COMMIT;

-- =============================================================================
-- VALIDACIÓN (ejecutar después, fuera de transacción si preferís)
-- =============================================================================
--
-- -- Columnas críticas empresas
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'empresas'
--   AND column_name IN (
--     'linkedin_empresa', 'linkedin_personal', 'initiative_kind', 'project_description',
--     'estado_revision', 'fuente_remota', 'score_preliminar', 'converted_lead_id', 'import_batch_id'
--   )
-- ORDER BY column_name;
--
-- -- Columnas críticas leads
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'leads'
--   AND column_name IN (
--     'linkedin_empresa', 'linkedin_personal', 'initiative_kind', 'project_description',
--     'iniciativa_id', 'commercial_strategy_json', 'strategy_approved_at'
--   )
-- ORDER BY column_name;
--
-- -- Config flag
-- SELECT key, value FROM public.config WHERE key = 'allow_multiple_leads_per_initiative';
--
-- -- Constraints (muestra en empresas)
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'public.empresas'::regclass
--   AND (
--     conname LIKE '%initiative%'
--     OR conname LIKE '%score_preliminar%'
--     OR conname LIKE '%estado_revision%'
--   );
--
-- Si falla el COMMIT por score_preliminar fuera de 0–10, corregir datos y re-ejecutar:
--   UPDATE public.empresas SET score_preliminar = NULL
--   WHERE score_preliminar IS NOT NULL AND (score_preliminar < 0 OR score_preliminar > 10);
--
