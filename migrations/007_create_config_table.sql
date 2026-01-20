-- ============================================
-- Crear tabla config para settings key/value
-- ============================================

-- 1. Crear tabla config si no existe
CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_config_key ON public.config(key);

-- 3. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_config_updated_at
BEFORE UPDATE ON public.config
FOR EACH ROW
EXECUTE FUNCTION update_config_updated_at();

-- 4. Comentarios
COMMENT ON TABLE public.config IS 'Tabla de configuración key/value para settings del sistema';
COMMENT ON COLUMN public.config.key IS 'Clave única del setting';
COMMENT ON COLUMN public.config.value IS 'Valor del setting (texto)';
