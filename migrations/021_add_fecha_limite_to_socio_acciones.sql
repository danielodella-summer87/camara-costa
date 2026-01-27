-- ============================================
-- Agregar fecha_limite a socio_acciones
-- ============================================
-- Campo DATE para fecha límite real de la acción (deadline)

-- 1. Agregar columna fecha_limite (DATE, nullable por compatibilidad)
ALTER TABLE public.socio_acciones
ADD COLUMN IF NOT EXISTS fecha_limite DATE NULL;

-- 2. Crear índices para performance de queries por fecha_limite
CREATE INDEX IF NOT EXISTS idx_socio_acciones_fecha_limite 
ON public.socio_acciones(fecha_limite);

-- 3. Índice compuesto para agenda (fecha_limite + realizada_at)
CREATE INDEX IF NOT EXISTS idx_socio_acciones_fecha_limite_pendientes 
ON public.socio_acciones(fecha_limite, realizada_at) 
WHERE realizada_at IS NULL;

-- 4. Índices compuestos para queries por lead_id/socio_id + fecha_limite
CREATE INDEX IF NOT EXISTS idx_socio_acciones_lead_fecha_limite 
ON public.socio_acciones(lead_id, fecha_limite) 
WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_socio_acciones_socio_fecha_limite 
ON public.socio_acciones(socio_id, fecha_limite) 
WHERE socio_id IS NOT NULL;

-- 5. Backfill opcional: si hay registros viejos donde realizada_at parece ser una fecha futura usada como "fecha limite",
--    copiar fecha_limite = (realizada_at::date) SOLO si:
--    - realizada_at::date > current_date (futuro)
--    - realizada_at::date >= created_at::date (lógica)
--    - fecha_limite IS NULL (no sobrescribir si ya tiene valor)
--    Esto NO toca los casos donde realizada_at sea "ejecutada" (timestamp ISO con 'T')
UPDATE public.socio_acciones
SET fecha_limite = (realizada_at::date)
WHERE fecha_limite IS NULL
  AND realizada_at IS NOT NULL
  AND realizada_at::date > CURRENT_DATE
  AND realizada_at::date >= (created_at::date)
  AND realizada_at::text NOT LIKE '%T%'; -- Excluir timestamps ISO (ejecutadas)

-- 6. Comentario
COMMENT ON COLUMN public.socio_acciones.fecha_limite IS 'Fecha límite (deadline) para ejecutar la acción. NULL si no está definida.';
