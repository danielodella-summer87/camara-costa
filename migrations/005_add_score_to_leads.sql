-- ============================================
-- Agregar score (1-5 estrellas) a leads
-- ============================================
-- Permite calificar la calidad del lead con un score de 1 a 5

-- 1. Agregar columna score si no existe
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS score SMALLINT NULL;

-- 2. Agregar constraint para validar que score esté entre 1 y 5
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_score_check'
  ) THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_score_check 
    CHECK (score IS NULL OR (score >= 1 AND score <= 5));
  END IF;
END $$;

-- 3. Comentarios
COMMENT ON COLUMN public.leads.score IS 'Score de calidad del lead (1-5 estrellas). NULL si no tiene score.';
