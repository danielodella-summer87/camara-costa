-- Motor IA escalable: categorías + prompts configurables/validados

CREATE TABLE IF NOT EXISTS public.ai_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_categories_name ON public.ai_categories (lower(name));
CREATE INDEX IF NOT EXISTS idx_ai_categories_active ON public.ai_categories (is_active);

CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.ai_categories(id),
  description TEXT NULL,
  prompt_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_type ON public.ai_prompts (type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_status ON public.ai_prompts (status);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category_id ON public.ai_prompts (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompts_type_name ON public.ai_prompts (type, lower(name));

CREATE OR REPLACE FUNCTION public.update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_prompts_updated_at ON public.ai_prompts;
CREATE TRIGGER trg_ai_prompts_updated_at
BEFORE UPDATE ON public.ai_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_prompts_updated_at();

COMMENT ON TABLE public.ai_categories IS 'Categorías para clasificar prompts del motor IA';
COMMENT ON TABLE public.ai_prompts IS 'Prompts configurables por tipo (draft/validated)';
