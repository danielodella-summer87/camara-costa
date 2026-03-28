-- Variables comerciales explícitas para el módulo Cierre de Venta (sustitución en runtime)

ALTER TABLE public.ai_analysis_profiles
  ADD COLUMN IF NOT EXISTS cierre_oferta_principal TEXT NULL,
  ADD COLUMN IF NOT EXISTS tipo_organizacion_vendedora TEXT NULL;

COMMENT ON COLUMN public.ai_analysis_profiles.cierre_oferta_principal IS 'Oferta principal de nuestra organización (placeholder {{oferta_principal_nuestra_organizacion}} en prompts de cierre).';
COMMENT ON COLUMN public.ai_analysis_profiles.tipo_organizacion_vendedora IS 'Tipo de organización vendedora (placeholder {{tipo_organizacion_vendedora}}).';
