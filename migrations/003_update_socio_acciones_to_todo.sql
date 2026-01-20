-- ============================================
-- Actualizar socio_acciones a sistema de to-do
-- ============================================
-- Cambia de historial a acciones planificadas con fecha límite y estado ejecutada

-- 1. Agregar nuevas columnas
ALTER TABLE public.socio_acciones
ADD COLUMN IF NOT EXISTS due_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ NULL;

-- 2. Si realizada_at existe y tiene valor, migrar a done=true y done_at=realizada_at
UPDATE public.socio_acciones
SET done = true, done_at = realizada_at
WHERE realizada_at IS NOT NULL AND done = false;

-- 3. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_socio_acciones_socio_created ON public.socio_acciones(socio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socio_acciones_socio_done ON public.socio_acciones(socio_id, done);

-- 4. Comentarios
COMMENT ON COLUMN public.socio_acciones.due_date IS 'Fecha límite para ejecutar la acción';
COMMENT ON COLUMN public.socio_acciones.done IS 'Indica si la acción fue ejecutada';
COMMENT ON COLUMN public.socio_acciones.done_at IS 'Fecha y hora en que se marcó como ejecutada';
