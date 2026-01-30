-- ============================================
-- Agregar campo comercial_id a socio_acciones
-- ============================================
-- Permite asignar un comercial a cada actividad

-- 1. Agregar columna comercial_id (opcional, puede ser NULL)
ALTER TABLE public.socio_acciones
ADD COLUMN IF NOT EXISTS comercial_id UUID NULL;

-- 2. Agregar Foreign Key a comerciales(id)
ALTER TABLE public.socio_acciones
DROP CONSTRAINT IF EXISTS socio_acciones_comercial_id_fkey;

ALTER TABLE public.socio_acciones
ADD CONSTRAINT socio_acciones_comercial_id_fkey
FOREIGN KEY (comercial_id)
REFERENCES public.comerciales(id)
ON DELETE SET NULL;

-- 3. Crear índice para performance de queries por comercial
CREATE INDEX IF NOT EXISTS idx_socio_acciones_comercial_id ON public.socio_acciones(comercial_id);

-- 4. Comentario
COMMENT ON COLUMN public.socio_acciones.comercial_id IS 'Referencia al comercial asignado a esta actividad. NULL si no hay comercial asignado.';
