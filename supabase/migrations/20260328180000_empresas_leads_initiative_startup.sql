-- Ver migrations/062_empresas_leads_initiative_startup.sql (misma definición).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS project_description text;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_initiative_kind_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_initiative_kind_check
  CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS project_description text;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_initiative_kind_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_initiative_kind_check
  CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));

UPDATE public.empresas SET initiative_kind = 'standard' WHERE initiative_kind IS NULL;
UPDATE public.leads SET initiative_kind = 'standard' WHERE initiative_kind IS NULL;
