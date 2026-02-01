-- Desactivar un comercial por ID (uso puntual / data fix)
-- La tabla comerciales (migración 023) usa la columna "activo".

UPDATE public.comerciales
SET activo = false
WHERE id = 'd00f4077-cb1e-4b7a-a694-fbc7a7e4f87a'::uuid;
