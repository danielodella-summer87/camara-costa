-- ============================================
-- Agregar columna activo a rubros
-- ============================================

-- 1. Agregar columna activo si no existe
ALTER TABLE public.rubros
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- 2. Comentario
COMMENT ON COLUMN public.rubros.activo IS 'Indica si el rubro está activo y disponible para usar.';
