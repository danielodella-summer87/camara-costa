-- ============================================
-- Agregar columna hora a socio_acciones
-- ============================================
-- La hora se guarda como texto "HH:MM" independiente de la fecha.

ALTER TABLE public.socio_acciones
ADD COLUMN IF NOT EXISTS hora text NOT NULL DEFAULT '00:00';

-- Backfill defensivo en caso de que existan NULLs (por cambios manuales previos)
UPDATE public.socio_acciones
SET hora = '00:00'
WHERE hora IS NULL;

