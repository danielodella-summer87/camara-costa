-- ============================================
-- Seed inicial para RBAC sin Auth
-- ============================================
-- Permisos y asignaciones por rol

-- 1. Insertar roles del sistema (si no existen)
INSERT INTO public.roles (name, label, description, is_system) VALUES
  ('admin', 'Administrador', 'Acceso completo al sistema', true),
  ('gerencia', 'Gerencia', 'Acceso a reportes y gestión estratégica', true),
  ('comercial', 'Comercial', 'Gestión de leads y ventas', true),
  ('operaciones', 'Operaciones', 'Gestión operativa del día a día', true),
  ('solo_lectura', 'Solo Lectura', 'Solo puede ver información, no modificar', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Insertar catálogo de permisos (IDs exactos)
-- Módulo: leads
INSERT INTO public.permissions (id, label, category) VALUES
  ('leads.read', 'Ver leads', 'leads'),
  ('leads.create', 'Crear leads', 'leads'),
  ('leads.update', 'Editar leads', 'leads'),
  ('leads.delete', 'Eliminar leads', 'leads'),
  ('leads.assign', 'Asignar leads', 'leads'),
  ('leads.export', 'Exportar leads', 'leads')
ON CONFLICT (id) DO NOTHING;

-- Módulo: empresas
INSERT INTO public.permissions (id, label, category) VALUES
  ('empresas.read', 'Ver empresas', 'empresas'),
  ('empresas.create', 'Crear empresas', 'empresas'),
  ('empresas.update', 'Editar empresas', 'empresas'),
  ('empresas.delete', 'Eliminar empresas', 'empresas')
ON CONFLICT (id) DO NOTHING;

-- Módulo: agenda
INSERT INTO public.permissions (id, label, category) VALUES
  ('agenda.read', 'Ver agenda', 'agenda'),
  ('agenda.create', 'Crear eventos', 'agenda'),
  ('agenda.update', 'Editar eventos', 'agenda'),
  ('agenda.delete', 'Eliminar eventos', 'agenda')
ON CONFLICT (id) DO NOTHING;

-- Módulo: socios
INSERT INTO public.permissions (id, label, category) VALUES
  ('socios.read', 'Ver socios', 'socios'),
  ('socios.create', 'Crear socios', 'socios'),
  ('socios.update', 'Editar socios', 'socios'),
  ('socios.delete', 'Eliminar socios', 'socios')
ON CONFLICT (id) DO NOTHING;

-- Módulo: reportes
INSERT INTO public.permissions (id, label, category) VALUES
  ('reportes.read', 'Ver reportes', 'reportes'),
  ('reportes.export', 'Exportar reportes', 'reportes')
ON CONFLICT (id) DO NOTHING;

-- Módulo: config
INSERT INTO public.permissions (id, label, category) VALUES
  ('config.read', 'Ver configuración', 'config'),
  ('config.update', 'Editar configuración', 'config')
ON CONFLICT (id) DO NOTHING;

-- Módulo: system
INSERT INTO public.permissions (id, label, category) VALUES
  ('system.danger', 'Operaciones peligrosas', 'system')
ON CONFLICT (id) DO NOTHING;

-- 3. Asignar permisos a roles según mapa v1
-- Admin: todos los permisos + system.danger
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Gerencia: todos los permisos menos system.danger
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'gerencia'
  AND p.id != 'system.danger'
ON CONFLICT DO NOTHING;

-- Comercial: leads.* menos delete + agenda.* + reportes.read/export
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'comercial'
  AND (
    (p.category = 'leads' AND p.id != 'leads.delete') OR
    p.category = 'agenda' OR
    p.id IN ('reportes.read', 'reportes.export')
  )
ON CONFLICT DO NOTHING;

-- Operaciones: socios.* + agenda.* + leads.read + empresas.read
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'operaciones'
  AND (
    p.category = 'socios' OR
    p.category = 'agenda' OR
    p.id = 'leads.read' OR
    p.id = 'empresas.read'
  )
ON CONFLICT DO NOTHING;

-- Solo Lectura: *.read + (opcional) reportes.export
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'solo_lectura'
  AND (
    p.id LIKE '%.read' OR
    p.id = 'reportes.export'
  )
ON CONFLICT DO NOTHING;
