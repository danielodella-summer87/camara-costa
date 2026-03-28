-- Política: varios leads activos por iniciativa (misma fila empresa/iniciativa).
-- El proyecto persiste settings en public.config (key/value). Si preferís el nombre "app_settings",
-- es el mismo concepto: una fila por clave.

INSERT INTO public.config (key, value)
VALUES ('allow_multiple_leads_per_initiative', 'false')
ON CONFLICT (key) DO NOTHING;
