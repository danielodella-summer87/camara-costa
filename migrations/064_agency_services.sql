-- Catálogo maestro de servicios de agencia + vínculo en propuestas de lead

CREATE TABLE IF NOT EXISTS public.agency_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  description text,
  price_base numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  unit text NOT NULL,
  default_quantity numeric(10,2) NOT NULL DEFAULT 1,
  internal_notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_services_currency_check CHECK (currency IN ('USD', 'UYU')),
  CONSTRAINT agency_services_unit_check CHECK (unit IN ('hour', 'monthly', 'project', 'one_time'))
);

CREATE INDEX IF NOT EXISTS agency_services_is_active_idx ON public.agency_services (is_active);
CREATE INDEX IF NOT EXISTS agency_services_sort_order_idx ON public.agency_services (sort_order);
CREATE INDEX IF NOT EXISTS agency_services_category_idx ON public.agency_services (category);

DROP TRIGGER IF EXISTS trg_agency_services_updated_at ON public.agency_services;
CREATE TRIGGER trg_agency_services_updated_at
  BEFORE UPDATE ON public.agency_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lead_service_proposals DROP CONSTRAINT IF EXISTS lead_service_proposals_service_id_fkey;

ALTER TABLE public.lead_service_proposals
  ALTER COLUMN service_id DROP NOT NULL;

ALTER TABLE public.lead_service_proposals
  ADD COLUMN IF NOT EXISTS agency_service_id uuid REFERENCES public.agency_services (id) ON DELETE RESTRICT;

ALTER TABLE public.lead_service_proposals
  ADD COLUMN IF NOT EXISTS proposal_line_snapshot jsonb;

ALTER TABLE public.lead_service_proposals
  ADD CONSTRAINT lead_service_proposals_service_or_agency_check
  CHECK (service_id IS NOT NULL OR agency_service_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS lead_service_proposals_agency_service_id_idx
  ON public.lead_service_proposals (agency_service_id);

ALTER TABLE public.lead_service_proposals
  ADD CONSTRAINT lead_service_proposals_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.easy_services (id) ON DELETE RESTRICT;
