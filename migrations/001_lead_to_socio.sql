-- ============================================
-- Migración: Lead → Socio
-- ============================================
-- Agrega campos is_member y member_since a leads
-- Crea tabla socios con relación a leads

-- 1. Agregar campos a tabla leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_member BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS member_since TIMESTAMPTZ NULL;

-- 2. Crear tabla socios
CREATE TABLE IF NOT EXISTS socios (
  id TEXT PRIMARY KEY,
  lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE RESTRICT,
  plan TEXT NULL,
  estado TEXT NOT NULL DEFAULT 'Activo',
  fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
  proxima_accion TEXT NULL,
  proxima_accion_color TEXT NULL CHECK (proxima_accion_color IN ('red', 'yellow', 'green')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_socios_lead_id ON socios(lead_id);
CREATE INDEX IF NOT EXISTS idx_socios_estado ON socios(estado);
CREATE INDEX IF NOT EXISTS idx_leads_is_member ON leads(is_member);

-- 4. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_socios_updated_at
BEFORE UPDATE ON socios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Comentarios
COMMENT ON TABLE socios IS 'Socios convertidos desde leads';
COMMENT ON COLUMN socios.lead_id IS 'Referencia única al lead original';
COMMENT ON COLUMN socios.proxima_accion_color IS 'Color del semáforo: red, yellow, green';
COMMENT ON COLUMN leads.is_member IS 'Indica si el lead fue convertido en socio';
COMMENT ON COLUMN leads.member_since IS 'Fecha de conversión a socio';
