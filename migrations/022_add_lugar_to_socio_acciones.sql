-- ============================================
-- Agregar campo lugar a socio_acciones
-- ============================================

ALTER TABLE public.socio_acciones
ADD COLUMN IF NOT EXISTS lugar TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_socio_acciones_lugar ON public.socio_acciones(lugar);
