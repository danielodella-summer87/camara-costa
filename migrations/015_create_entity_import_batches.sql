-- ============================================
-- Crear tabla entity_import_batches y agregar import_batch_id a empresas
-- ============================================
-- Permite rastrear lotes de importación de entidades
-- Si el batch se elimina, las empresas mantienen su import_batch_id (ON DELETE SET NULL)

-- 1. Crear tabla entity_import_batches
CREATE TABLE IF NOT EXISTS public.entity_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NULL,
  status TEXT NULL DEFAULT 'completed',
  metadata JSONB NULL,
  
  CONSTRAINT entity_import_batches_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- 2. Agregar columna import_batch_id a empresas si no existe
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS import_batch_id UUID NULL;

-- 3. Agregar Foreign Key a entity_import_batches(id) con ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'empresas_import_batch_id_fkey'
  ) THEN
    ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_import_batch_id_fkey 
    FOREIGN KEY (import_batch_id) 
    REFERENCES public.entity_import_batches(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Crear índice para performance
CREATE INDEX IF NOT EXISTS idx_empresas_import_batch_id ON public.empresas(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_entity_import_batches_created_at ON public.entity_import_batches(created_at DESC);

-- 5. Comentarios
COMMENT ON TABLE public.entity_import_batches IS 'Lotes de importación de entidades';
COMMENT ON COLUMN public.entity_import_batches.status IS 'Estado del batch: pending, processing, completed, failed';
COMMENT ON COLUMN public.entity_import_batches.metadata IS 'Metadatos adicionales del batch (JSON)';
COMMENT ON COLUMN public.empresas.import_batch_id IS 'Referencia al lote de importación desde el cual se creó esta entidad. NULL si no fue importada.';
