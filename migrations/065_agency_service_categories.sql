-- Categorías normalizadas para agency_services
-- IMPORTANTE: aplicar esta migración manualmente en Supabase (SQL editor o CLI), igual que el resto del proyecto.

CREATE TABLE IF NOT EXISTS public.agency_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_service_categories_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS agency_service_categories_is_active_idx ON public.agency_service_categories (is_active);
CREATE INDEX IF NOT EXISTS agency_service_categories_sort_order_idx ON public.agency_service_categories (sort_order);

DROP TRIGGER IF EXISTS trg_agency_service_categories_updated_at ON public.agency_service_categories;
CREATE TRIGGER trg_agency_service_categories_updated_at
  BEFORE UPDATE ON public.agency_service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agency_services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.agency_service_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS agency_services_category_id_idx ON public.agency_services (category_id);

-- Migrar valores existentes de category (texto) a filas reales y enlazar category_id
INSERT INTO public.agency_service_categories (name, sort_order, is_active)
SELECT DISTINCT TRIM(category), 0, true
FROM public.agency_services
WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.agency_services AS a
SET category_id = c.id
FROM public.agency_service_categories AS c
WHERE a.category IS NOT NULL
  AND TRIM(a.category) <> ''
  AND TRIM(a.category) = c.name
  AND a.category_id IS NULL;
