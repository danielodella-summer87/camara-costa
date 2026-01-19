-- Agregar columnas codigo y empresa_id a socios
-- Permite identificar socios con código único y vincularlos con empresas

ALTER TABLE public.socios
ADD COLUMN IF NOT EXISTS codigo TEXT;

ALTER TABLE public.socios
ADD COLUMN IF NOT EXISTS empresa_id UUID;

-- Opcional: evitar códigos repetidos
CREATE UNIQUE INDEX IF NOT EXISTS socios_codigo_unique ON public.socios (codigo);

-- FK a empresas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'socios_empresa_id_fkey'
  ) THEN
    ALTER TABLE public.socios
    ADD CONSTRAINT socios_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON DELETE SET NULL;
  END IF;
END $$;
