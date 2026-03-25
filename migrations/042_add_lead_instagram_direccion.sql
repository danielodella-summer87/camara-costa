-- Snapshot operativo en leads (ej. copiado al crear desde entidad; editable en CRM sin depender solo de empresas)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS direccion text;

COMMENT ON COLUMN public.leads.instagram IS 'Perfil o URL de Instagram del negocio en contexto comercial del lead.';
COMMENT ON COLUMN public.leads.direccion IS 'Dirección física u operativa asociada al lead (snapshot).';

-- Tras aplicar esta migración en Supabase, podés volver a incluir en los SELECT de
-- app/api/admin/leads/route.ts y app/api/admin/leads/[id]/route.ts los campos
-- instagram y direccion a nivel tabla leads (además del join empresas).
