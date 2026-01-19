-- Agregar columna ai_custom_prompt a leads
-- Permite guardar la personalización del prompt IA que el usuario ingresa

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS ai_custom_prompt TEXT NULL;

COMMENT ON COLUMN public.leads.ai_custom_prompt IS 'Texto opcional que el usuario agrega para personalizar el informe IA del lead.';
