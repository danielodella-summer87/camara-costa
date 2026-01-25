-- Migración: Agregar columna 'tipo' y constraint unique en 'nombre' a leads_pipelines
-- Fecha: 2026-01-25

-- 1. Agregar columna 'tipo' si no existe (default 'normal')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads_pipelines' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE public.leads_pipelines 
    ADD COLUMN tipo text DEFAULT 'normal' NOT NULL;
    
    -- Actualizar pipelines existentes según su nombre
    UPDATE public.leads_pipelines 
    SET tipo = 'ganado' 
    WHERE LOWER(TRIM(nombre)) = 'ganado';
    
    UPDATE public.leads_pipelines 
    SET tipo = 'perdido' 
    WHERE LOWER(TRIM(nombre)) = 'perdido';
    
    -- El resto queda como 'normal'
  END IF;
END $$;

-- 2. Agregar constraint unique en 'nombre' si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_pipelines_nombre_key'
  ) THEN
    -- Primero, eliminar duplicados si existen (mantener el más antiguo)
    DELETE FROM public.leads_pipelines p1
    WHERE p1.id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY LOWER(TRIM(nombre)) 
          ORDER BY created_at ASC
        ) as rn
        FROM public.leads_pipelines
      ) t WHERE t.rn > 1
    );
    
    -- Luego agregar el constraint
    ALTER TABLE public.leads_pipelines 
    ADD CONSTRAINT leads_pipelines_nombre_key UNIQUE (nombre);
  END IF;
END $$;

-- 3. Asegurar que existe pipeline "Nuevo"
INSERT INTO public.leads_pipelines (nombre, posicion, tipo, color, created_at, updated_at)
SELECT 'Nuevo', 0, 'normal', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads_pipelines WHERE LOWER(TRIM(nombre)) = 'nuevo'
);

-- 4. Asegurar que existe pipeline "Ganado"
INSERT INTO public.leads_pipelines (nombre, posicion, tipo, color, created_at, updated_at)
SELECT 'Ganado', 1000, 'ganado', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads_pipelines WHERE LOWER(TRIM(nombre)) = 'ganado'
);

-- 5. Asegurar que existe pipeline "Perdido"
INSERT INTO public.leads_pipelines (nombre, posicion, tipo, color, created_at, updated_at)
SELECT 'Perdido', 999, 'perdido', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads_pipelines WHERE LOWER(TRIM(nombre)) = 'perdido'
);

-- 6. Agregar check constraint para tipo válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_pipelines_tipo_check'
  ) THEN
    ALTER TABLE public.leads_pipelines 
    ADD CONSTRAINT leads_pipelines_tipo_check 
    CHECK (tipo IN ('normal', 'ganado', 'perdido'));
  END IF;
END $$;
