-- ============================================
-- Extender socio_acciones para soportar leads
-- ============================================
-- Permite que las acciones pertenezcan a un lead o a un socio

-- 1. Agregar columna lead_id (opcional, puede ser NULL)
ALTER TABLE public.socio_acciones
ADD COLUMN IF NOT EXISTS lead_id UUID NULL;

-- 2. Agregar Foreign Key a leads(id)
ALTER TABLE public.socio_acciones
DROP CONSTRAINT IF EXISTS socio_acciones_lead_id_fkey;

ALTER TABLE public.socio_acciones
ADD CONSTRAINT socio_acciones_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES public.leads(id)
ON DELETE CASCADE;

-- 3. Agregar constraint: debe tener socio_id O lead_id (pero no ambos)
ALTER TABLE public.socio_acciones
DROP CONSTRAINT IF EXISTS socio_acciones_socio_or_lead_check;

ALTER TABLE public.socio_acciones
ADD CONSTRAINT socio_acciones_socio_or_lead_check
CHECK (
  (socio_id IS NOT NULL AND lead_id IS NULL) OR
  (socio_id IS NULL AND lead_id IS NOT NULL)
);

-- 4. Crear índice para performance de queries por lead
CREATE INDEX IF NOT EXISTS idx_socio_acciones_lead_id ON public.socio_acciones(lead_id);
CREATE INDEX IF NOT EXISTS idx_socio_acciones_lead_created ON public.socio_acciones(lead_id, created_at DESC);

-- 5. Comentarios
COMMENT ON COLUMN public.socio_acciones.lead_id IS 'Referencia al lead asociado. NULL si la acción pertenece a un socio.';
COMMENT ON CONSTRAINT socio_acciones_socio_or_lead_check ON public.socio_acciones IS 'Una acción debe pertenecer a un socio O a un lead, pero no a ambos.';
