-- ============================================
-- Actualizar score a 0-10 y agregar score_categoria
-- ============================================
-- Permite calificar la calidad del lead con un score de 0 a 10
-- y almacenar la categoría extraída del informe IA

-- 1. Eliminar constraint anterior si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_score_check'
  ) THEN
    ALTER TABLE public.leads
    DROP CONSTRAINT leads_score_check;
  END IF;
END $$;

-- 2. Cambiar tipo de score a INT (para soportar 0-10)
ALTER TABLE public.leads
ALTER COLUMN score TYPE INT USING score::INT;

-- 3. Agregar nuevo constraint para validar que score esté entre 0 y 10
ALTER TABLE public.leads
ADD CONSTRAINT leads_score_check 
CHECK (score IS NULL OR (score >= 0 AND score <= 10));

-- 4. Agregar columna score_categoria si no existe
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS score_categoria TEXT NULL;

-- 5. Comentarios
COMMENT ON COLUMN public.leads.score IS 'Score de calidad del lead (0-10). NULL si no tiene score. Puede ser extraído del informe IA.';
COMMENT ON COLUMN public.leads.score_categoria IS 'Categoría del score extraída del informe IA (ej: "Prioridad Alta", "Prioridad Media", "Prioridad Baja"). NULL si no está disponible.';
