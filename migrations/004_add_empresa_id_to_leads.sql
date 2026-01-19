-- ============================================
-- Agregar empresa_id a leads
-- ============================================
-- Permite que un Lead esté vinculado a una Empresa
-- Si la empresa se elimina, el lead.empresa_id se setea a NULL (ON DELETE SET NULL)

-- 1. Agregar columna empresa_id si no existe
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS empresa_id UUID NULL;

-- 2. Agregar Foreign Key a empresas(id) con ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_empresa_id_fkey'
  ) THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_empresa_id_fkey 
    FOREIGN KEY (empresa_id) 
    REFERENCES public.empresas(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Crear índice para performance
CREATE INDEX IF NOT EXISTS idx_leads_empresa_id ON public.leads(empresa_id);

-- 4. Comentarios
COMMENT ON COLUMN public.leads.empresa_id IS 'Referencia a la empresa desde la cual nace este lead. NULL si no está vinculado.';
