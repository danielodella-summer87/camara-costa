-- ============================================
-- Actualizar schema de entity_import_batches y agregar trazabilidad en empresas
-- ============================================

-- 1) Actualizar tabla entity_import_batches con campos adicionales
ALTER TABLE IF EXISTS public.entity_import_batches
  ADD COLUMN IF NOT EXISTS concepto TEXT NULL,
  ADD COLUMN IF NOT EXISTS filename TEXT NULL,
  ADD COLUMN IF NOT EXISTS total_rows INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inserted_rows INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_rows INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID NULL;

-- Actualizar status para que tenga valores correctos
DO $$
BEGIN
  -- Si la columna status existe pero no tiene el check constraint correcto, actualizarlo
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entity_import_batches'
      AND column_name = 'status'
  ) THEN
    -- Eliminar constraint anterior si existe
    ALTER TABLE public.entity_import_batches
      DROP CONSTRAINT IF EXISTS entity_import_batches_status_check;
    
    -- Agregar nuevo constraint
    ALTER TABLE public.entity_import_batches
      ADD CONSTRAINT entity_import_batches_status_check
      CHECK (status IN ('validated', 'imported', 'failed'));
    
    -- Actualizar valores existentes si es necesario
    UPDATE public.entity_import_batches
    SET status = CASE
      WHEN status = 'pending' THEN 'validated'
      WHEN status = 'processing' THEN 'validated'
      WHEN status = 'completed' THEN 'imported'
      ELSE status
    END
    WHERE status NOT IN ('validated', 'imported', 'failed');
  END IF;
END $$;

-- 2) Trazabilidad en entidades (tabla empresas)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS import_batch_id UUID NULL,
  ADD COLUMN IF NOT EXISTS import_row_number INT NULL;

-- 3) FK (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'empresas_import_batch_id_fkey'
      AND table_name = 'empresas'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_import_batch_id_fkey
      FOREIGN KEY (import_batch_id)
      REFERENCES public.entity_import_batches(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_empresas_import_batch_id ON public.empresas(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_empresas_import_row_number ON public.empresas(import_row_number);

-- Comentarios
COMMENT ON COLUMN public.entity_import_batches.concepto IS 'Concepto o descripción de la importación';
COMMENT ON COLUMN public.entity_import_batches.filename IS 'Nombre del archivo CSV importado';
COMMENT ON COLUMN public.entity_import_batches.total_rows IS 'Total de filas en el archivo';
COMMENT ON COLUMN public.entity_import_batches.inserted_rows IS 'Filas insertadas exitosamente';
COMMENT ON COLUMN public.entity_import_batches.error_rows IS 'Filas que fallaron al insertar';
COMMENT ON COLUMN public.entity_import_batches.status IS 'Estado del batch: validated, imported, failed';
COMMENT ON COLUMN public.empresas.import_batch_id IS 'Referencia al batch de importación que creó esta entidad';
COMMENT ON COLUMN public.empresas.import_row_number IS 'Número de fila en el CSV original (1-based)';
