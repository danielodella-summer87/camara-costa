-- Ver supabase/migrations/20260329180000_leads_ai_generation_progress.sql (misma definición)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_generation_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_progress integer NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_current_module text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_started_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_module_total integer;
