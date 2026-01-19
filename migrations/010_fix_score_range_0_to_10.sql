-- Ajustar el rango de score de leads a 0–10
-- BORRAR y CREAR constraint correctamente
-- Importante:
--   - Permitimos NULL
--   - Permitimos 0–10
--   - Esto evita romper generación futura

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_score_range;

ALTER TABLE leads
  ADD CONSTRAINT leads_score_range
  CHECK (score IS NULL OR (score >= 0 AND score <= 10));
