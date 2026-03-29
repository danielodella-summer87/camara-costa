-- =============================================================================
-- IA EASY — Datos iniciales / réplica de cambios manuales en Supabase
-- =============================================================================
-- Archivo versionable para documentar y reaplicar ajustes hechos a mano en EASY.
--
-- IMPORTANTE
-- - No se ejecuta nada automáticamente al commitear este repo.
-- - Revisar nombres de perfil, categorías y entorno (staging/prod) antes de correr.
-- - Ajustar bloques comentados (/* ... */) o placeholders según tu instancia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Categorías (public.ai_categories)
-- -----------------------------------------------------------------------------
-- Categorías base frecuentes + extensiones alineadas con la UI (paleta / flujo).
-- Idempotente: no inserta si ya existe el mismo nombre (case-insensitive).

INSERT INTO public.ai_categories (name, description, is_active)
SELECT v.name, v.description, true
FROM (
  VALUES
    ('Diagnóstico', 'Prompts para análisis y diagnóstico'),
    ('Estrategia', 'Prompts para estrategia comercial'),
    ('Oportunidades', 'Prompts para detección de oportunidades'),
    ('Planes', 'Prompts para planes de acción'),
    ('Investigación', 'Prompts de investigación y descubrimiento'),
    ('Canales', 'Prompts de canales y distribución'),
    ('Ejecución', 'Prompts de ejecución operativa'),
    ('Cierre', 'Prompts de cierre comercial')
) AS v(name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ai_categories c
  WHERE lower(trim(c.name)) = lower(trim(v.name))
);

-- -----------------------------------------------------------------------------
-- 2) Orden de ejecución
-- -----------------------------------------------------------------------------
-- ACLARACIÓN DE ESQUEMA: en este proyecto el orden por perfil está en
--   public.ai_profile_prompts.execution_order
-- La tabla public.ai_prompts NO incluye execution_order en las migraciones IA.
--
-- Plantilla: actualizar orden por prompt_id para el perfil "Easy".
-- Descomentar y completar UUIDs o usar subconsultas por nombre de prompt.

/*
UPDATE public.ai_profile_prompts AS pp
SET execution_order = v.ord,
    enabled_by_default = COALESCE(v.enabled, pp.enabled_by_default)
FROM (
  VALUES
    -- (nombre_prompt, execution_order, enabled_by_default opcional)
    ('Investigación del negocio', 10, true),
    ('Investigación Digital', 20, true)
) AS v(prompt_name, ord, enabled)
JOIN public.ai_prompts p ON lower(trim(p.name)) = lower(trim(v.prompt_name))
WHERE pp.prompt_id = p.id
  AND pp.profile_id = (
    SELECT id FROM public.ai_analysis_profiles
    WHERE lower(trim(name)) = lower(trim('Easy'))
    LIMIT 1
  );
*/

-- Alternativa por id explícito de fila en ai_profile_prompts (copiado del Table Editor):
/*
UPDATE public.ai_profile_prompts
SET execution_order = 10
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
*/

-- -----------------------------------------------------------------------------
-- 3) Perfil de análisis "Easy" (public.ai_analysis_profiles)
-- -----------------------------------------------------------------------------
-- Crear perfil si no existe. Ajustar descripción / base_instructions según negocio.

INSERT INTO public.ai_analysis_profiles (
  name,
  description,
  is_active,
  base_instructions,
  target_client_type,
  target_industries
)
SELECT
  'Easy',
  'Perfil EASY — motor IA comercial',
  false,
  '',
  NULL,
  '{}'::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_analysis_profiles
  WHERE lower(trim(name)) = lower(trim('Easy'))
);

-- Opcional: activar solo este perfil (desactivar el resto). MUY sensible en prod.
/*
UPDATE public.ai_analysis_profiles SET is_active = (lower(trim(name)) = lower(trim('Easy')));
*/

-- -----------------------------------------------------------------------------
-- 4) Asociación perfil Easy ↔ prompts (public.ai_profile_prompts)
-- -----------------------------------------------------------------------------
-- Enlaza todos los prompts validados al perfil Easy si aún no hay fila.
-- Ajustar el filtro (p.status, lista de nombres, etc.) según política EASY.

/*
INSERT INTO public.ai_profile_prompts (profile_id, prompt_id, enabled_by_default, execution_order)
SELECT
  prof.id,
  p.id,
  true,
  ROW_NUMBER() OVER (ORDER BY p.name) * 10
FROM public.ai_analysis_profiles prof
CROSS JOIN public.ai_prompts p
WHERE lower(trim(prof.name)) = lower(trim('Easy'))
  AND p.status = 'validated'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_profile_prompts pp
    WHERE pp.profile_id = prof.id AND pp.prompt_id = p.id
  );
*/

-- Variante: solo una lista de nombres de prompt (orden explícito con ORDINALITY):
/*
INSERT INTO public.ai_profile_prompts (profile_id, prompt_id, enabled_by_default, execution_order)
SELECT
  prof.id,
  p.id,
  true,
  t.ord
FROM public.ai_analysis_profiles prof
CROSS JOIN LATERAL (
  VALUES
    ('Nombre exacto prompt 1', 10),
    ('Nombre exacto prompt 2', 20)
) AS t(prompt_name, ord)
JOIN public.ai_prompts p ON p.name = t.prompt_name
WHERE lower(trim(prof.name)) = lower(trim('Easy'))
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_profile_prompts pp
    WHERE pp.profile_id = prof.id AND pp.prompt_id = p.id
  );
*/

-- -----------------------------------------------------------------------------
-- 5) Otros datos manuales relevantes (plantillas)
-- -----------------------------------------------------------------------------

-- Reasignar categoría de un prompt por nombre (category_id → ai_categories):
/*
UPDATE public.ai_prompts p
SET category_id = c.id
FROM public.ai_categories c
WHERE lower(trim(c.name)) = lower(trim('Diagnóstico'))
  AND lower(trim(p.name)) = lower(trim('Nombre del prompt'));
*/

-- Campos comerciales del perfil (migración 054 en repo):
/*
UPDATE public.ai_analysis_profiles
SET
  cierre_oferta_principal = 'Texto de oferta principal para prompts de cierre',
  tipo_organizacion_vendedora = 'agencia'
WHERE lower(trim(name)) = lower(trim('Easy'));
*/

-- -----------------------------------------------------------------------------
-- Notas
-- -----------------------------------------------------------------------------
-- - Este archivo replica / documenta estado manual típico de Supabase EASY.
-- - Tras ejecutar en un entorno, conviene volcar diferencias reales aquí o en
--   docs/ia-easy-db-notes.md para mantener una sola fuente de verdad operativa.
-- - Las migraciones numeradas existentes en supabase/migrations/ continúan
--   siendo el esquema estructural; este script es orientado a datos / ajustes.
