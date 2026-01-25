-- ============================================
-- Asegurar que entity_import_batches tenga status y filename
-- ============================================

-- Agregar status si no existe
ALTER TABLE IF EXISTS public.entity_import_batches
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'validated';

-- Agregar filename si no existe
ALTER TABLE IF EXISTS public.entity_import_batches
  ADD COLUMN IF NOT EXISTS filename TEXT NULL;

-- Actualizar constraint de status si es necesario
DO $$
BEGIN
  -- Eliminar constraint anterior si existe y es diferente
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'entity_import_batches_status_check'
  ) THEN
    ALTER TABLE public.entity_import_batches
      DROP CONSTRAINT entity_import_batches_status_check;
  END IF;
  
  -- Agregar nuevo constraint con valores correctos
  ALTER TABLE public.entity_import_batches
    ADD CONSTRAINT entity_import_batches_status_check
    CHECK (status IN ('validated', 'imported', 'failed', 'committed'));
END $$;

-- Comentarios
COMMENT ON COLUMN public.entity_import_batches.status IS 'Estado del batch: validated, imported, failed, committed';
COMMENT ON COLUMN public.entity_import_batches.filename IS 'Nombre del archivo Excel importado';
