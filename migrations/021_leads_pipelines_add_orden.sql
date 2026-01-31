-- 021_leads_pipelines_add_orden.sql
ALTER TABLE public.leads_pipelines
ADD COLUMN IF NOT EXISTS orden integer;

-- Inicializar orden para registros existentes (si hay created_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.leads_pipelines
)
UPDATE public.leads_pipelines p
SET orden = ranked.rn
FROM ranked
WHERE p.id = ranked.id
  AND p.orden IS NULL;

CREATE INDEX IF NOT EXISTS leads_pipelines_orden_idx
ON public.leads_pipelines (orden);
