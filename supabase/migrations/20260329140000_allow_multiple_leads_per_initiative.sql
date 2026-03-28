-- Política: varios leads activos por iniciativa (misma fila empresa/iniciativa).
-- Settings en public.config (key/value).

INSERT INTO public.config (key, value)
VALUES ('allow_multiple_leads_per_initiative', 'false')
ON CONFLICT (key) DO NOTHING;
