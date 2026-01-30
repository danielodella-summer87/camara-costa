-- ============================================
-- Crear tabla comerciales
-- ============================================
-- Tabla para gestionar los comerciales (vendedores) del sistema

CREATE TABLE IF NOT EXISTS public.comerciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NULL,
  telefono TEXT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comerciales_activo ON public.comerciales(activo);
CREATE INDEX IF NOT EXISTS idx_comerciales_nombre ON public.comerciales(nombre);

-- Comentarios
COMMENT ON TABLE public.comerciales IS 'Comerciales (vendedores) del sistema que pueden ser asignados a leads y actividades';
COMMENT ON COLUMN public.comerciales.nombre IS 'Nombre del comercial';
COMMENT ON COLUMN public.comerciales.email IS 'Email del comercial (opcional)';
COMMENT ON COLUMN public.comerciales.telefono IS 'Teléfono del comercial (opcional)';
COMMENT ON COLUMN public.comerciales.activo IS 'Indica si el comercial está activo en el sistema';
