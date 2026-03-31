-- Progreso en tiempo real de generación de informe IA (sin colas externas)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_generation_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_progress integer NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_current_module text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_started_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_module_total integer;

COMMENT ON COLUMN leads.ai_status IS 'pending | running | completed | error';
COMMENT ON COLUMN leads.ai_generation_id IS 'UUID de la corrida aceptada (POST 202); polling por GET .../ai-report/status';
