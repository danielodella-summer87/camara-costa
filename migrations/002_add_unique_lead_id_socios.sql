-- ============================================
-- Agregar constraint UNIQUE a socios.lead_id
-- ============================================
-- Permite usar upsert con onConflict:'lead_id'

ALTER TABLE public.socios 
ADD CONSTRAINT socios_lead_id_unique UNIQUE (lead_id);
