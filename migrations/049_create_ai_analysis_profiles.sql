-- Perfiles de análisis IA (orientación por tipo de cliente/rubro)

CREATE TABLE IF NOT EXISTS public.ai_analysis_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  target_client_type TEXT NULL,
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  base_instructions TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analysis_profiles_name ON public.ai_analysis_profiles (lower(name));
CREATE INDEX IF NOT EXISTS idx_ai_analysis_profiles_active ON public.ai_analysis_profiles (is_active);

CREATE TABLE IF NOT EXISTS public.ai_profile_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.ai_analysis_profiles(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  enabled_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  execution_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_profile_prompts_profile_order ON public.ai_profile_prompts (profile_id, execution_order);

CREATE OR REPLACE FUNCTION public.update_ai_analysis_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_analysis_profiles_updated_at ON public.ai_analysis_profiles;
CREATE TRIGGER trg_ai_analysis_profiles_updated_at
BEFORE UPDATE ON public.ai_analysis_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_analysis_profiles_updated_at();

