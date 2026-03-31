-- Recalibración comercial EASY: tarifas de roles, precios de referencia y esfuerzo (horas) por servicio.
-- Aplicar manualmente en Supabase. Si la columna de horas se llama "hours" en vez de "estimated_hours",
-- sustituí "estimated_hours" por "hours" en la sección 3) o renombrá la columna antes.

-- =============================================================================
-- 1) agency_roles — tarifas horarias (USD)
-- =============================================================================
UPDATE public.agency_roles SET hourly_rate = 35 WHERE name = 'STRAT';
UPDATE public.agency_roles SET hourly_rate = 18 WHERE name = 'PM';
UPDATE public.agency_roles SET hourly_rate = 20 WHERE name = 'WEB_DES';
UPDATE public.agency_roles SET hourly_rate = 25 WHERE name = 'DEV';
UPDATE public.agency_roles SET hourly_rate = 15 WHERE name = 'COPY';
UPDATE public.agency_roles SET hourly_rate = 12 WHERE name = 'SOCIAL';
UPDATE public.agency_roles SET hourly_rate = 14 WHERE name = 'DESIGN';
UPDATE public.agency_roles SET hourly_rate = 18 WHERE name = 'ADS';
UPDATE public.agency_roles SET hourly_rate = 30 WHERE name = 'AUTO_IA';
UPDATE public.agency_roles SET hourly_rate = 20 WHERE name = 'DATA';

-- =============================================================================
-- 2) agency_services — precios de venta de referencia (USD)
--    Ajustá los patrones si tus nombres no coinciden (ej. códigos sin prefijo).
-- =============================================================================
UPDATE public.agency_services
SET price_base = 300, currency = 'USD', updated_at = now()
WHERE is_active IS NOT FALSE
  AND (
    name ~* '(WEB01|WEB 01|rediseño.*básico|rediseno.*basico|web básica|web basica)'
    OR name ILIKE '%rediseño web básico%'
    OR name ILIKE '%rediseno web basico%'
  );

UPDATE public.agency_services
SET price_base = 600, currency = 'USD', updated_at = now()
WHERE is_active IS NOT FALSE
  AND (name ~* '(WEB02|WEB 02|web standard|web estándar|web estandar)' OR name ILIKE '%web standard%');

UPDATE public.agency_services
SET price_base = 800, currency = 'USD', updated_at = now()
WHERE is_active IS NOT FALSE
  AND (name ~* '(WEB05|WEB 05|e-?commerce|ecommerce|tienda online)' OR name ILIKE '%ecommerce%');

UPDATE public.agency_services
SET price_base = 400, currency = 'USD', updated_at = now()
WHERE is_active IS NOT FALSE
  AND (name ~* '(WEB06|WEB 06|landing|web intermedia)' OR name ILIKE '%WEB06%');

UPDATE public.agency_services
SET price_base = 250, currency = 'USD', updated_at = now()
WHERE is_active IS NOT FALSE
  AND (
    name ~* '(SOC02|SOC 02)'
    OR (name ILIKE '%8%' AND name ILIKE '%post%')
    OR name ILIKE '%redes%8%post%'
  );

UPDATE public.agency_services
SET price_base = 150, currency = 'USD', updated_at = now()
WHERE is_active IS NOT FALSE
  AND (
    name ~* '(ADS01|ADS 01)'
    OR name ILIKE '%gestión de pauta%'
    OR name ILIKE '%gestion de pauta%'
  );

-- Prioridad visual en listados (servicios principales primero)
UPDATE public.agency_services SET sort_order = 10, updated_at = now() WHERE name ~* 'WEB01' OR name ILIKE '%WEB01%';
UPDATE public.agency_services SET sort_order = 20, updated_at = now() WHERE name ~* 'WEB02' OR name ILIKE '%WEB02%';
UPDATE public.agency_services SET sort_order = 30, updated_at = now() WHERE name ~* 'WEB05' OR name ILIKE '%WEB05%';
UPDATE public.agency_services SET sort_order = 40, updated_at = now() WHERE name ~* 'WEB06' OR name ILIKE '%WEB06%';
UPDATE public.agency_services SET sort_order = 50, updated_at = now() WHERE name ~* 'SOC02' OR name ILIKE '%SOC02%';
UPDATE public.agency_services SET sort_order = 60, updated_at = now() WHERE name ~* 'ADS01' OR name ILIKE '%ADS01%';

-- =============================================================================
-- 3) agency_service_effort_profiles — estimated_hours por combinación servicio × rol
--    Solo actualiza filas existentes; roles no listados para un patrón conservan su valor.
-- =============================================================================
UPDATE public.agency_service_effort_profiles p
SET estimated_hours = COALESCE(
  CASE
    -- WEB01 / rediseño básico (~300 USD venta)
    WHEN s.name ~* '(WEB01|WEB 01|rediseño.*básico|rediseno.*basico|web básica|web basica)'
         OR s.name ILIKE '%rediseño web básico%'
         OR s.name ILIKE '%rediseno web basico%'
      THEN CASE r.name
        WHEN 'STRAT' THEN 0.5
        WHEN 'PM' THEN 2
        WHEN 'WEB_DES' THEN 2
        WHEN 'DESIGN' THEN 1
        WHEN 'COPY' THEN 0.5
        ELSE NULL
      END

    -- WEB02 / web standard (~600 USD)
    WHEN s.name ~* '(WEB02|WEB 02|web standard|web estándar|web estandar)' OR s.name ILIKE '%web standard%'
      THEN CASE r.name
        WHEN 'STRAT' THEN 1
        WHEN 'PM' THEN 4
        WHEN 'WEB_DES' THEN 6
        WHEN 'DEV' THEN 3
        WHEN 'DESIGN' THEN 2
        WHEN 'COPY' THEN 2
        ELSE NULL
      END

    -- WEB05 / ecommerce (~800 USD)
    WHEN s.name ~* '(WEB05|WEB 05|e-?commerce|ecommerce|tienda online)' OR s.name ILIKE '%ecommerce%'
      THEN CASE r.name
        WHEN 'STRAT' THEN 2
        WHEN 'PM' THEN 2
        WHEN 'WEB_DES' THEN 2
        WHEN 'DEV' THEN 3
        WHEN 'DESIGN' THEN 2
        WHEN 'DATA' THEN 1
        WHEN 'COPY' THEN 1
        ELSE NULL
      END

    -- WEB06 (~400 USD referencia)
    WHEN s.name ~* '(WEB06|WEB 06|landing|web intermedia)' OR s.name ILIKE '%WEB06%'
      THEN CASE r.name
        WHEN 'PM' THEN 2
        WHEN 'WEB_DES' THEN 2
        WHEN 'DEV' THEN 2
        WHEN 'COPY' THEN 1
        WHEN 'DESIGN' THEN 1
        ELSE NULL
      END

    -- SOC02 / redes 8 posteos (~250 USD)
    WHEN s.name ~* '(SOC02|SOC 02|8 post|redes sociales)' OR s.name ILIKE '%8 post%' OR (s.name ILIKE '%redes%' AND s.name ILIKE '%post%')
      THEN CASE r.name
        WHEN 'PM' THEN 1
        WHEN 'SOCIAL' THEN 8
        WHEN 'COPY' THEN 2
        WHEN 'DESIGN' THEN 1
        ELSE NULL
      END

    -- ADS01 / gestión pauta (~150 USD)
    WHEN s.name ~* '(ADS01|ADS 01|gestión de pauta|gestion de pauta)' OR (s.name ILIKE '%pauta%' AND s.name ILIKE '%gest%')
      THEN CASE r.name
        WHEN 'PM' THEN 1
        WHEN 'ADS' THEN 4
        WHEN 'WEB_DES' THEN 0.5
        ELSE NULL
      END

    ELSE NULL
  END,
  p.estimated_hours
)
FROM public.agency_services s
JOIN public.agency_roles r ON r.id = p.agency_role_id
WHERE p.agency_service_id = s.id;

-- Si tu tabla aún usa la columna "hours" en lugar de "estimated_hours", ejecutá el bloque equivalente:
-- UPDATE ... SET hours = COALESCE(...) ... (misma expresión)
