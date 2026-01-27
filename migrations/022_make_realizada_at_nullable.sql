-- ============================================
-- Hacer realizada_at nullable en socio_acciones
-- ============================================
-- Permite que las acciones se creen como pendientes (realizada_at = NULL)

-- 1. Eliminar constraint NOT NULL de realizada_at
ALTER TABLE public.socio_acciones
ALTER COLUMN realizada_at DROP NOT NULL;

-- 2. Eliminar default (si existe) de realizada_at
-- Esto permite que las acciones se creen con realizada_at = NULL (pendientes)
ALTER TABLE public.socio_acciones
ALTER COLUMN realizada_at DROP DEFAULT;

-- 3. Comentario
COMMENT ON COLUMN public.socio_acciones.realizada_at IS 'Timestamp de cuando se ejecutó la acción. NULL si está pendiente. Se setea cuando se marca como ejecutada.';
