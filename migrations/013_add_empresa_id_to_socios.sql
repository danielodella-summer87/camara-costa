-- Agregar columna empresa_id a socios
-- Permite vincular un socio directamente con una empresa

ALTER TABLE public.socios
ADD COLUMN IF NOT EXISTS empresa_id UUID NULL;

-- Agregar Foreign Key a empresas(id)
ALTER TABLE public.socios
DROP CONSTRAINT IF EXISTS socios_empresa_id_fkey;

ALTER TABLE public.socios
ADD CONSTRAINT socios_empresa_id_fkey
FOREIGN KEY (empresa_id)
REFERENCES public.empresas(id)
ON DELETE SET NULL;

-- Agregar índice para mejorar performance de queries
CREATE INDEX IF NOT EXISTS idx_socios_empresa_id
ON public.socios(empresa_id);

-- Comentario
COMMENT ON COLUMN public.socios.empresa_id IS 'Referencia a la empresa asociada al socio. NULL si no está vinculado.';
