-- ============================================
-- Crear tabla lead_contacts para contactos de leads
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  celular TEXT NULL,
  email TEXT NULL,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  notas TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead_id ON public.lead_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_es_principal ON public.lead_contacts(lead_id, es_principal) WHERE es_principal = true;

-- Constraint único parcial: solo un contacto principal por lead
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_contacts_unique_principal 
ON public.lead_contacts(lead_id) 
WHERE es_principal = true;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_lead_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_contacts_updated_at
BEFORE UPDATE ON public.lead_contacts
FOR EACH ROW
EXECUTE FUNCTION update_lead_contacts_updated_at();

-- Comentarios
COMMENT ON TABLE public.lead_contacts IS 'Contactos asociados a un lead';
COMMENT ON COLUMN public.lead_contacts.lead_id IS 'Referencia al lead';
COMMENT ON COLUMN public.lead_contacts.nombre IS 'Nombre completo del contacto';
COMMENT ON COLUMN public.lead_contacts.cargo IS 'Cargo del contacto (CEO, Director, Gerente, etc.)';
COMMENT ON COLUMN public.lead_contacts.celular IS 'Número de celular del contacto';
COMMENT ON COLUMN public.lead_contacts.email IS 'Email del contacto';
COMMENT ON COLUMN public.lead_contacts.es_principal IS 'Indica si es el contacto principal del lead';
COMMENT ON COLUMN public.lead_contacts.notas IS 'Notas adicionales sobre el contacto';
