-- =========================================================
-- BOOTSTRAP BASE - NUEVA INSTANCIA SUMMER87
-- Uso: EASY / PERU / COLOMBIA / cualquier nuevo entorno
-- Objetivo: dejar el sistema operativo sin datos de negocio
-- =========================================================

-- ---------------------------------------------------------
-- 1) ROLES
-- ---------------------------------------------------------
INSERT INTO roles (name, label, description, is_system)
SELECT *
FROM (
  VALUES
    ('admin', 'Administrador', 'Acceso total', true),
    ('comercial', 'Comercial', 'Opera leads/agenda/IA, sin configuración.', true),
    ('viewer', 'Viewer', 'Solo lectura.', true),
    ('tecnico', 'Técnico', 'Acceso técnico', false),
    ('consultor', 'Consultor', 'Acceso consultivo', false)
) AS v(name, label, description, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.name = v.name
);

-- ---------------------------------------------------------
-- 2) PERMISSIONS
-- ---------------------------------------------------------
INSERT INTO permissions (key, module, action, description)
SELECT *
FROM (
  VALUES
    ('agenda.read', 'agenda', 'read', 'Ver agenda'),
    ('agenda.write', 'agenda', 'write', 'Editar agenda'),
    ('config.admin', 'config', 'admin', 'Administración'),
    ('config.read', 'config', 'read', 'Ver configuración'),
    ('empresas.read', 'empresas', 'read', 'Ver empresas'),
    ('empresas.write', 'empresas', 'write', 'Editar empresas'),
    ('empresas.delete', 'empresas', 'delete', 'Eliminar empresas'),
    ('ia.generate', 'ia', 'generate', 'Usar generación IA'),
    ('leads.read', 'leads', 'read', 'Ver leads'),
    ('leads.write', 'leads', 'write', 'Editar leads'),
    ('leads.delete', 'leads', 'delete', 'Eliminar leads'),
    ('reportes.read', 'reportes', 'read', 'Ver reportes'),
    ('socios.read', 'socios', 'read', 'Ver socios'),
    ('socios.write', 'socios', 'write', 'Editar socios')
) AS v(key, module, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p WHERE p.key = v.key
);

-- ---------------------------------------------------------
-- 3) ROLE_PERMISSIONS
-- admin = todos los permisos
-- comercial = permisos operativos
-- viewer = solo lectura
-- tecnico = leads + IA
-- consultor = lectura + IA
-- ---------------------------------------------------------

-- admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

-- comercial
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'agenda.read',
  'agenda.write',
  'empresas.read',
  'empresas.write',
  'ia.generate',
  'leads.read',
  'leads.write',
  'reportes.read',
  'socios.read',
  'socios.write'
)
WHERE r.name = 'comercial'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

-- viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'agenda.read',
  'empresas.read',
  'leads.read',
  'reportes.read',
  'socios.read',
  'config.read'
)
WHERE r.name = 'viewer'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

-- tecnico
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'leads.read',
  'leads.write',
  'ia.generate',
  'config.read'
)
WHERE r.name = 'tecnico'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

-- consultor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'leads.read',
  'empresas.read',
  'reportes.read',
  'socios.read',
  'ia.generate'
)
WHERE r.name = 'consultor'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------
-- 4) CONFIG
-- Ajustar según país/cliente
-- ---------------------------------------------------------
INSERT INTO config (key, value, updated_at)
SELECT *
FROM (
  VALUES
    ('site_name', 'Summer87 Intelligence', now()),
    ('primary_module', 'Summer87 Leads', now()),
    ('instance_country', 'BASE', now()),
    ('instance_label', 'Nueva instancia', now()),
    ('ia_enabled', 'true', now()),
    ('crm_enabled', 'true', now()),
    ('helpdesk_enabled', 'true', now())
) AS v(key, value, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM config c WHERE c.key = v.key
);

-- ---------------------------------------------------------
-- 5) RUBROS
-- seed mínimo para que formularios no queden vacíos
-- ---------------------------------------------------------
INSERT INTO rubros (nombre)
SELECT *
FROM (
  VALUES
    ('Tecnología'),
    ('Educación'),
    ('Salud'),
    ('Servicios profesionales'),
    ('Comercio'),
    ('Industria'),
    ('Construcción'),
    ('Turismo'),
    ('Gastronomía'),
    ('Inmobiliaria')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM rubros r WHERE r.nombre = v.nombre
);

-- ---------------------------------------------------------
-- 6) EASY_SERVICES
-- seed mínimo
-- ---------------------------------------------------------
INSERT INTO easy_services (nombre)
SELECT *
FROM (
  VALUES
    ('Consultoría comercial'),
    ('Diagnóstico estratégico'),
    ('Automatización'),
    ('Landing page'),
    ('Gestión de redes'),
    ('Pauta digital'),
    ('Motor de inteligencia'),
    ('CRM / Implementación')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM easy_services s WHERE s.nombre = v.nombre
);

-- ---------------------------------------------------------
-- 7) PIPELINES / PICKLISTS
-- solo si existen estas tablas en el schema
-- ---------------------------------------------------------

-- lead_pipelines
INSERT INTO lead_pipelines (nombre, posicion, color)
SELECT *
FROM (
  VALUES
    ('LEADS87', 1, '#0f172a')
) AS v(nombre, posicion, color)
WHERE NOT EXISTS (
  SELECT 1 FROM lead_pipelines lp WHERE lp.nombre = v.nombre
);

-- leads_pipelines
INSERT INTO leads_pipelines (nombre, posicion, color)
SELECT *
FROM (
  VALUES
    ('Nuevas', 1, '#f59e0b'),
    ('Activas', 2, '#3b82f6'),
    ('En propuesta', 3, '#8b5cf6'),
    ('En seguimiento', 4, '#06b6d4'),
    ('Cerradas', 5, '#22c55e')
) AS v(nombre, posicion, color)
WHERE NOT EXISTS (
  SELECT 1 FROM leads_pipelines lp WHERE lp.nombre = v.nombre
);

-- lead_picklist_items
INSERT INTO lead_picklist_items (group_key, label, sort_order, is_active)
SELECT *
FROM (
  VALUES
    ('origen', 'LinkedIn', 1, true),
    ('origen', 'Web', 2, true),
    ('origen', 'Referido', 3, true),
    ('origen', 'Instagram', 4, true),
    ('estado', 'nuevo', 1, true),
    ('estado', 'en_revision', 2, true),
    ('estado', 'descartada', 3, true),
    ('estado', 'convertida_a_lead', 4, true)
) AS v(group_key, label, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM lead_picklist_items lpi
  WHERE lpi.group_key = v.group_key
    AND lpi.label = v.label
);

-- ---------------------------------------------------------
-- 8) IA - tablas mínimas
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  category_id uuid NULL REFERENCES ai_categories(id) ON DELETE SET NULL,
  description text,
  prompt_content text NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_analysis_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_profile_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES ai_analysis_profiles(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE
);

-- categorías IA
INSERT INTO ai_categories (name, description)
SELECT *
FROM (
  VALUES
    ('Diagnóstico', 'Prompts para análisis y diagnóstico'),
    ('Estrategia', 'Prompts para estrategia comercial'),
    ('Oportunidades', 'Prompts para detección de oportunidades'),
    ('Planes', 'Prompts para planes de acción')
) AS v(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM ai_categories c WHERE c.name = v.name
);

-- perfil IA base
INSERT INTO ai_analysis_profiles (name, description, is_active)
SELECT *
FROM (
  VALUES
    ('Perfil base', 'Perfil inicial de prompts para nueva instancia', true)
) AS v(name, description, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM ai_analysis_profiles p WHERE p.name = v.name
);

-- prompts base IA
INSERT INTO ai_prompts (name, type, category_id, description, prompt_content, status)
SELECT
  v.name,
  v.type,
  c.id,
  v.description,
  v.prompt_content,
  v.status
FROM (
  VALUES
    (
      'FODA básico',
      'analysis',
      'Diagnóstico',
      'Análisis FODA general',
      'Realiza un análisis FODA de la organización usando la información disponible.',
      'active'
    ),
    (
      'Oportunidades visibles y ocultas',
      'analysis',
      'Oportunidades',
      'Detección de oportunidades',
      'Detecta oportunidades visibles y ocultas de crecimiento, posicionamiento y mejora comercial.',
      'active'
    ),
    (
      'Plan 72 horas',
      'plan',
      'Planes',
      'Plan de acción inmediato',
      'Construye un plan práctico de acciones prioritarias para las próximas 72 horas.',
      'active'
    ),
    (
      'Plan 30-90 días',
      'plan',
      'Planes',
      'Plan de mediano plazo',
      'Construye un plan estratégico de 30, 60 y 90 días para crecimiento comercial.',
      'active'
    )
) AS v(name, type, category_name, description, prompt_content, status)
JOIN ai_categories c ON c.name = v.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM ai_prompts ap WHERE ap.name = v.name
);

-- asociar prompts al perfil base
INSERT INTO ai_profile_prompts (profile_id, prompt_id)
SELECT p.id, ap.id
FROM ai_analysis_profiles p
JOIN ai_prompts ap ON true
WHERE p.name = 'Perfil base'
  AND NOT EXISTS (
    SELECT 1
    FROM ai_profile_prompts pp
    WHERE pp.profile_id = p.id
      AND pp.prompt_id = ap.id
  );

-- ---------------------------------------------------------
-- 9) COLUMNAS QUE EL FRONTEND ACTUAL ESPERA EN LEADS
-- ---------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_personal text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS commercial_strategy_json jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS strategy_approved_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS iniciativa_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS initiative_kind text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_description text;

-- ---------------------------------------------------------
-- 10) RECARGAR SCHEMA CACHE DE SUPABASE
-- ---------------------------------------------------------
NOTIFY pgrst, 'reload schema';