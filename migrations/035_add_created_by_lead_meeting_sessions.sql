-- Agregar created_by a lead_meeting_sessions (app_user que creó la sesión)
ALTER TABLE public.lead_meeting_sessions
  ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.app_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lead_meeting_sessions.created_by IS 'Usuario app que guardó el cierre (app_users.id)';
