-- ============================================
-- Crear tabla entity_import_rows para persistir filas validadas
-- ============================================

CREATE TABLE IF NOT EXISTS public.entity_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.entity_import_batches(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  data JSONB NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, row_number)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_entity_import_rows_batch_id ON public.entity_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_entity_import_rows_batch_id_is_valid ON public.entity_import_rows(batch_id, is_valid);
CREATE INDEX IF NOT EXISTS idx_entity_import_rows_row_number ON public.entity_import_rows(batch_id, row_number);

-- Comentarios
COMMENT ON TABLE public.entity_import_rows IS 'Filas validadas de importaciones de entidades';
COMMENT ON COLUMN public.entity_import_rows.batch_id IS 'ID del batch de importación';
COMMENT ON COLUMN public.entity_import_rows.row_number IS 'Número de fila en el Excel (1-based)';
COMMENT ON COLUMN public.entity_import_rows.data IS 'Datos de la fila en formato JSONB (nombre, tipo, rubro, telefono, email, direccion, web, instagram)';
COMMENT ON COLUMN public.entity_import_rows.is_valid IS 'Indica si la fila pasó todas las validaciones';
COMMENT ON COLUMN public.entity_import_rows.errors IS 'Array JSONB con errores de validación de la fila';
