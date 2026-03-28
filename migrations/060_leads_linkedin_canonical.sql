-- Convención canónica en public.leads: linkedin_empresa + linkedin_personal.
-- linkedin_director puede seguir existiendo en esquemas viejos; se backfildea hacia linkedin_personal.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_empresa text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_personal text;

UPDATE public.leads
SET linkedin_personal = linkedin_director
WHERE (linkedin_personal IS NULL OR btrim(linkedin_personal) = '')
  AND linkedin_director IS NOT NULL
  AND btrim(linkedin_director) <> '';

COMMENT ON COLUMN public.leads.linkedin_empresa IS 'URL o perfil LinkedIn de la empresa.';
COMMENT ON COLUMN public.leads.linkedin_personal IS 'URL o perfil LinkedIn del contacto (campo canónico).';
