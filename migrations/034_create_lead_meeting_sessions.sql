-- ============================================
-- Crear tabla lead_meeting_sessions (sesiones de reunión por lead/tipo)
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_meeting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  meeting_type TEXT NOT NULL,
  emotional_state TEXT NULL,
  conviction TEXT NULL,
  next_objective TEXT NULL,
  checklist_state JSONB NULL,
  log JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lead_meeting_sessions_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT lead_meeting_sessions_meeting_type_check
    CHECK (meeting_type IN ('descubrimiento', 'propuesta', 'cierre'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_meeting_sessions_lead_id
  ON public.lead_meeting_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_meeting_sessions_meeting_type
  ON public.lead_meeting_sessions(meeting_type);
CREATE INDEX IF NOT EXISTS idx_lead_meeting_sessions_created_at
  ON public.lead_meeting_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_meeting_sessions_lead_type
  ON public.lead_meeting_sessions(lead_id, meeting_type);

COMMENT ON TABLE public.lead_meeting_sessions IS 'Sesiones de reunión por lead (checklist, log, cierre). Cada "Guardar cierre" crea una fila nueva.';
COMMENT ON COLUMN public.lead_meeting_sessions.meeting_type IS 'Tipo: descubrimiento | propuesta | cierre';
COMMENT ON COLUMN public.lead_meeting_sessions.checklist_state IS 'Estado del checklist (itemId -> boolean) al cerrar';
COMMENT ON COLUMN public.lead_meeting_sessions.log IS 'Bitácora (array de { at, text })';
