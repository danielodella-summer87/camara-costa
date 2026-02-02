-- ============================================
-- Crear tabla lead_reunion_sessions para sesiones de reuniones (checklist + log por lead/tipo)
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_reunion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('descubrimiento', 'propuesta', 'cierre')),
  emotional_state TEXT NULL,
  conviction TEXT NULL,
  next_objective TEXT NULL,
  checklist_state JSONB NULL,
  log JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_reunion_sessions_lead_id ON public.lead_reunion_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reunion_sessions_meeting_type ON public.lead_reunion_sessions(meeting_type);
CREATE INDEX IF NOT EXISTS idx_lead_reunion_sessions_created_at ON public.lead_reunion_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_reunion_sessions_lead_type ON public.lead_reunion_sessions(lead_id, meeting_type);

COMMENT ON TABLE public.lead_reunion_sessions IS 'Sesiones de reuniones por lead (checklist, log, cierre). Cada "Guardar cierre" crea una fila nueva.';
COMMENT ON COLUMN public.lead_reunion_sessions.meeting_type IS 'Tipo: descubrimiento | propuesta | cierre';
COMMENT ON COLUMN public.lead_reunion_sessions.checklist_state IS 'Estado del checklist (itemId -> boolean) guardado en el cierre';
COMMENT ON COLUMN public.lead_reunion_sessions.log IS 'Bitácora de la reunión (array de { at, text })';
