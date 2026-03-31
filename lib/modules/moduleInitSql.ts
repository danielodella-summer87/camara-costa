/**
 * DDL idempotente para inicializar módulos cuando Supabase REST no permite ejecutar SQL.
 * Pegar en SQL Editor del proyecto destino si `initializeModule` devuelve needsSqlInDashboard.
 */

export const INIT_SQL_IA_CATEGORIES = `
CREATE TABLE IF NOT EXISTS public.ai_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_categories_name ON public.ai_categories (lower(name));
CREATE INDEX IF NOT EXISTS idx_ai_categories_active ON public.ai_categories (is_active);
`.trim();

export const INIT_SQL_LEADS_LINKEDIN_PERSONAL = `
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_personal text;
`.trim();
