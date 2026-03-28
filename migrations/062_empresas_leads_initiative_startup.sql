-- Modo iniciativa: estándar (huella digital) vs startup (proyecto temprano, descripción como fuente principal).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS project_description text;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_initiative_kind_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_initiative_kind_check
  CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));

COMMENT ON COLUMN public.empresas.initiative_kind IS 'standard: negocio con presencia digital esperada; startup: proyecto temprano sin web/redes obligatorias.';
COMMENT ON COLUMN public.empresas.project_description IS 'Descripción del proyecto (obligatoria en modo startup al crear/editar desde UI).';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS initiative_kind text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS project_description text;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_initiative_kind_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_initiative_kind_check
  CHECK (initiative_kind IS NULL OR initiative_kind IN ('standard', 'startup'));

COMMENT ON COLUMN public.leads.initiative_kind IS 'Copia desde iniciativa al convertir; guía IA y LEADS87.';
COMMENT ON COLUMN public.leads.project_description IS 'Copia desde iniciativa al convertir; fuente principal en startups.';

UPDATE public.empresas SET initiative_kind = 'standard' WHERE initiative_kind IS NULL;
UPDATE public.leads SET initiative_kind = 'standard' WHERE initiative_kind IS NULL;
