-- ============================================
-- Roles: tecnico, consultor (idempotente)
-- ============================================
-- Ejecutar en Supabase SQL Editor.
-- No crea usuarios; solo roles y asignación de permisos.

-- --------------------------------------------
-- 1) SQL para crear los roles
-- --------------------------------------------
-- Tabla roles (según migrations 026 / 028): id UUID, name TEXT NOT NULL UNIQUE,
-- label TEXT NOT NULL, description NULL, is_system DEFAULT false, created_at, updated_at.
-- Columnas obligatorias en INSERT: name, label.

INSERT INTO public.roles (name, label, description, is_system)
SELECT 'tecnico', 'Técnico', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'tecnico'
);

INSERT INTO public.roles (name, label, description, is_system)
SELECT 'consultor', 'Consultor', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'consultor'
);


-- --------------------------------------------
-- 2) SQL para asignar permisos (leads.read, leads.write)
-- --------------------------------------------
-- Opción A: Si tu tabla permissions tiene columna KEY (schema 026, id UUID)
-- y existen filas con key = 'leads.read' y key = 'leads.write':

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'tecnico'
  AND p.key IN ('leads.read', 'leads.write')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'consultor'
  AND p.key IN ('leads.read', 'leads.write')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );


-- --------------------------------------------
-- Opción B: Si tu tabla permissions tiene ID de tipo TEXT (schema 028),
-- sin columna key (id es la clave: 'leads.read', 'leads.write'):
-- --------------------------------------------

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'tecnico'
  AND p.id IN ('leads.read', 'leads.write')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'consultor'
  AND p.id IN ('leads.read', 'leads.write')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- --------------------------------------------
-- NOTAS
-- --------------------------------------------
-- • roles: columnas obligatorias = name, label. description e is_system pueden NULL/false.
-- • role_permissions: solo role_id (UUID) y permission_id (UUID en 026, TEXT en 028).
--   No hay columnas extra obligatorias; PRIMARY KEY (role_id, permission_id).
-- • Si en permissions no existe 'leads.write', hay que crearlo antes o asignar
--   en su lugar 'leads.create' y 'leads.update' (según tu convención).
-- • Comprobar permisos: SELECT id, key FROM permissions WHERE key IN ('leads.read','leads.write')
--   (026) o SELECT id FROM permissions WHERE id IN ('leads.read','leads.write') (028).
