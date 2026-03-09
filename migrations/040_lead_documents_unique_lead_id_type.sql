-- ============================================
-- Un solo documento vigente por (lead_id, type).
-- Elimina duplicados conservando el más reciente por created_at.
-- Añade UNIQUE(lead_id, type) para upsert.
-- ============================================

-- Eliminar duplicados: conservar una fila por (lead_id, type) con created_at más reciente
DELETE FROM public.lead_documents a
USING public.lead_documents b
WHERE a.lead_id = b.lead_id
  AND a.type = b.type
  AND a.created_at < b.created_at;

-- Añadir constraint único (idempotente: elimina si existía)
ALTER TABLE public.lead_documents
  DROP CONSTRAINT IF EXISTS lead_documents_lead_id_type_key;

ALTER TABLE public.lead_documents
  ADD CONSTRAINT lead_documents_lead_id_type_key UNIQUE (lead_id, type);

COMMENT ON CONSTRAINT lead_documents_lead_id_type_key ON public.lead_documents
  IS 'Un solo documento vigente por lead y tipo (diagnostic, strategy, proposal).';
