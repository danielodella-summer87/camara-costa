-- ============================================
-- Versionado por (lead_id, type): historial completo + una fila is_current por par.
-- Elimina UNIQUE(lead_id, type); añade índice único parcial (solo is_current = true).
-- ============================================

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS notes text NULL;

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS created_by text NULL;

ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

ALTER TABLE public.lead_documents
  DROP CONSTRAINT IF EXISTS lead_documents_lead_id_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS lead_documents_lead_type_one_current_idx
  ON public.lead_documents (lead_id, type)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_lead_documents_lead_type_version
  ON public.lead_documents (lead_id, type, version_number DESC);

COMMENT ON COLUMN public.lead_documents.version_number IS 'Número secuencial por (lead_id, type); primera versión = 1.';
COMMENT ON COLUMN public.lead_documents.is_current IS 'Solo una fila true por (lead_id, type): versión vigente para espejos en leads y UI.';
COMMENT ON COLUMN public.lead_documents.notes IS 'Notas opcionales de la versión (revisión, motivo de regeneración, etc.).';
COMMENT ON COLUMN public.lead_documents.created_by IS 'Identificador opcional del usuario que creó la versión (texto o UUID serializado).';
COMMENT ON COLUMN public.lead_documents.archived_at IS 'Marca temporal opcional de archivado lógico de la fila.';

-- Inserción atómica: desmarca current, calcula max(version)+1, inserta nueva vigente
CREATE OR REPLACE FUNCTION public.insert_lead_document_version(
  p_lead_id uuid,
  p_type text,
  p_url text,
  p_generation_id text DEFAULT NULL,
  p_source text DEFAULT 'crm',
  p_gamma_url text DEFAULT NULL,
  p_file_url text DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_notes text DEFAULT NULL,
  p_created_by text DEFAULT NULL,
  p_archived_at timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_next int;
  v_new_id uuid;
  gid text;
  st text;
BEGIN
  IF p_type IS NULL OR p_type NOT IN ('diagnostic', 'strategy', 'proposal', 'presentation') THEN
    RAISE EXCEPTION 'invalid lead_document type: %', p_type USING ERRCODE = '23514';
  END IF;
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RAISE EXCEPTION 'url is required' USING ERRCODE = '23502';
  END IF;

  UPDATE public.lead_documents
  SET is_current = false
  WHERE lead_id = p_lead_id AND type = p_type AND is_current = true;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM public.lead_documents
  WHERE lead_id = p_lead_id AND type = p_type;

  gid := NULLIF(btrim(COALESCE(p_generation_id, '')), '');

  st := lower(btrim(COALESCE(p_status, '')));
  IF st = '' THEN
    st := 'pending';
  END IF;
  IF st NOT IN ('pending', 'archived', 'failed') THEN
    RAISE EXCEPTION 'invalid status: %', st USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.lead_documents (
    lead_id,
    type,
    url,
    generation_id,
    source,
    gamma_url,
    file_url,
    status,
    version_number,
    is_current,
    notes,
    created_by,
    archived_at,
    created_at,
    updated_at
  ) VALUES (
    p_lead_id,
    p_type,
    btrim(p_url),
    gid,
    COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), 'crm'),
    NULLIF(btrim(COALESCE(p_gamma_url, '')), ''),
    NULLIF(btrim(COALESCE(p_file_url, '')), ''),
    st,
    v_next,
    true,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NULLIF(btrim(COALESCE(p_created_by, '')), ''),
    p_archived_at,
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.insert_lead_document_version IS
  'Inserta una nueva versión de documento comercial: desmarca is_current en versiones previas del mismo (lead_id, type), asigna version_number = max+1.';

GRANT EXECUTE ON FUNCTION public.insert_lead_document_version(
  uuid, text, text, text, text, text, text, text, text, text, timestamptz
) TO service_role;

GRANT EXECUTE ON FUNCTION public.insert_lead_document_version(
  uuid, text, text, text, text, text, text, text, text, text, timestamptz
) TO authenticated;
