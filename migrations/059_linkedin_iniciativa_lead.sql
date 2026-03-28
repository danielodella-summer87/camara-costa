-- LinkedIn organización + contacto: iniciativa (empresas) y lead (investigación / LEADS87).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS linkedin_empresa text,
  ADD COLUMN IF NOT EXISTS linkedin_personal text;

COMMENT ON COLUMN public.leads.linkedin_empresa IS 'URL o perfil LinkedIn de la organización.';
COMMENT ON COLUMN public.leads.linkedin_personal IS 'URL o perfil LinkedIn del contacto; se mantiene linkedin_director en sync por compatibilidad.';

-- Copiar histórico: director → personal cuando personal está vacío
UPDATE public.leads
SET linkedin_personal = linkedin_director
WHERE linkedin_personal IS NULL
  AND linkedin_director IS NOT NULL
  AND btrim(linkedin_director) <> '';

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS linkedin_empresa text,
  ADD COLUMN IF NOT EXISTS linkedin_personal text;

COMMENT ON COLUMN public.empresas.linkedin_empresa IS 'LinkedIn de la organización (ingreso en iniciativa).';
COMMENT ON COLUMN public.empresas.linkedin_personal IS 'LinkedIn del contacto (ingreso en iniciativa).';
