-- Roles de agencia (tarifas) y perfiles de esfuerzo por servicio

CREATE TABLE IF NOT EXISTS public.agency_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hourly_rate numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_roles_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS agency_roles_name_idx ON public.agency_roles (name);

DROP TRIGGER IF EXISTS trg_agency_roles_updated_at ON public.agency_roles;
CREATE TRIGGER trg_agency_roles_updated_at
  BEFORE UPDATE ON public.agency_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.agency_service_effort_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_service_id uuid NOT NULL REFERENCES public.agency_services (id) ON DELETE CASCADE,
  agency_role_id uuid NOT NULL REFERENCES public.agency_roles (id) ON DELETE RESTRICT,
  hours numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_service_effort_profiles_service_role_unique UNIQUE (agency_service_id, agency_role_id)
);

CREATE INDEX IF NOT EXISTS agency_service_effort_profiles_service_idx
  ON public.agency_service_effort_profiles (agency_service_id);
CREATE INDEX IF NOT EXISTS agency_service_effort_profiles_role_idx
  ON public.agency_service_effort_profiles (agency_role_id);

DROP TRIGGER IF EXISTS trg_agency_service_effort_profiles_updated_at ON public.agency_service_effort_profiles;
CREATE TRIGGER trg_agency_service_effort_profiles_updated_at
  BEFORE UPDATE ON public.agency_service_effort_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
