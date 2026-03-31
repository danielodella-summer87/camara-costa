-- =============================================================================
-- Alineación schema public.empresas: EASY → PROTOTIPO
-- =============================================================================
--
-- CONTEXTO
--   PROTOTIPO = definición en estructura_base.sql más columnas añadidas por:
--     • 20260327140000_iniciativas_empresas_leads.sql (ciclo iniciativa / conversión)
--     • 20260328120000_linkedin_iniciativa_lead.sql (LinkedIn en iniciativa)
--     • 20260328180000_empresas_leads_initiative_startup.sql (startup / proyecto)
--   EASY u otras instancias nuevas pueden no tener esas migraciones aplicadas; el
--   frontend y las APIs (lista empresas, ficha, convert-to-lead, IA) esperan estas
--   columnas y fallan o degradan si Supabase/PostgREST no las expone.
--
-- GARANTÍAS
--   • Solo ADD COLUMN IF NOT EXISTS (no DROP, no ALTER de columnas existentes).
--   • Restricciones y FK se agregan solo si aún no existen (bloques DO …), sin
--     DROP CONSTRAINT.
--   • Backfill mínimo: initiative_kind NULL → 'standard' (solo filas nuevas sin
--     valor; no reescribe estado_revision ni converted_lead_id).
--
-- NO EJECUTAR AQUÍ: aplicar con supabase db push / SQL editor en el proyecto EASY.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Columnas: PROTOTIPO vs núcleo típico de empresas (estructura_base)
-- ---------------------------------------------------------------------------

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS estado_revision text DEFAULT 'nueva';

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS fuente_remota text;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS score_preliminar smallint;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS converted_lead_id uuid;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS linkedin_empresa text;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS linkedin_personal text;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard';

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS project_description text;

-- ---------------------------------------------------------------------------
-- CHECK constraints (idempotente sin DROP)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'empresas'
      AND c.conname = 'empresas_score_preliminar_range'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_score_preliminar_range
      CHECK (score_preliminar IS NULL OR (score_preliminar >= 0 AND score_preliminar <= 10));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'empresas'
      AND c.conname = 'empresas_estado_revision_check'
  ) THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'empresas'
      AND c.conname = 'empresas_initiative_kind_check'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_initiative_kind_check
      CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- FK converted_lead_id → leads (tabla leads debe existir)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'empresas'
      AND c.conname = 'empresas_converted_lead_id_fkey'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_converted_lead_id_fkey
      FOREIGN KEY (converted_lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill seguro (solo NULL en initiative_kind)
-- ---------------------------------------------------------------------------

UPDATE public.empresas
SET initiative_kind = 'standard'
WHERE initiative_kind IS NULL;

-- ---------------------------------------------------------------------------
-- Comentarios (documentación en catálogo)
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.empresas.estado_revision IS 'Ciclo de vida de la iniciativa (ingreso preliminar antes del lead comercial).';
COMMENT ON COLUMN public.empresas.fuente_remota IS 'Origen externo (ej. LinkedIn, integración).';
COMMENT ON COLUMN public.empresas.score_preliminar IS 'Score 0–10 antes de convertir a lead; nullable.';
COMMENT ON COLUMN public.empresas.converted_lead_id IS 'Lead creado por conversión explícita; idempotencia.';
COMMENT ON COLUMN public.empresas.linkedin_empresa IS 'LinkedIn de la organización (ingreso en iniciativa).';
COMMENT ON COLUMN public.empresas.linkedin_personal IS 'LinkedIn del contacto (ingreso en iniciativa).';
