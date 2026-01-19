-- ============================================
-- Agregar columnas score y score_categoria a leads
-- ============================================
-- Versión simple: solo agrega las columnas si no existen

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS score INTEGER NULL,
ADD COLUMN IF NOT EXISTS score_categoria TEXT NULL;

-- Comentarios
COMMENT ON COLUMN public.leads.score IS 'Score de calidad del lead (0-10). NULL si no tiene score. Puede ser extraído del informe IA.';
COMMENT ON COLUMN public.leads.score_categoria IS 'Categoría del score extraída del informe IA (ej: "Prioridad Alta", "Prioridad Media", "Prioridad Baja"). NULL si no está disponible.';
