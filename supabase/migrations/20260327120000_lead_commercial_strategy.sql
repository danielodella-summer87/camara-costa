-- Equivalente a migrations/057_lead_commercial_strategy.sql (LEADS87 estrategia comercial).
-- Idempotente: seguro si la columna ya existe en DB.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS commercial_strategy_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS strategy_approved_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.leads.commercial_strategy_json IS 'Estado de estrategia: { generated, edited, userInputs } (LEADS87).';
COMMENT ON COLUMN public.leads.strategy_approved_at IS 'Confirmación explícita de estrategia; requerida para avanzar a estructura de servicios.';
