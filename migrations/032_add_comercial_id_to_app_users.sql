-- Vincular usuario del CRM con un Comercial (para "mis leads" / "mi agenda")
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS comercial_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_comercial_id
  ON public.app_users (comercial_id);
