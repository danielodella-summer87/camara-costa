-- ============================================
-- Seed inicial para RBAC
-- ============================================
-- Roles y permisos iniciales del sistema

-- 1. Insertar roles del sistema
INSERT INTO public.roles (name, label, description, is_system) VALUES
  ('admin', 'Administrador', 'Acceso completo al sistema', true),
  ('gerencia', 'Gerencia', 'Acceso a reportes y gestión estratégica', true),
  ('comercial', 'Comercial', 'Gestión de leads y ventas', true),
  ('operaciones', 'Operaciones', 'Gestión operativa del día a día', true),
  ('solo_lectura', 'Solo Lectura', 'Solo puede ver información, no modificar', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Insertar permisos por módulo
-- Módulo: leads
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('leads.read', 'leads', 'read', 'Ver leads'),
  ('leads.create', 'leads', 'create', 'Crear nuevos leads'),
  ('leads.update', 'leads', 'update', 'Editar leads existentes'),
  ('leads.delete', 'leads', 'delete', 'Eliminar leads'),
  ('leads.admin', 'leads', 'admin', 'Acceso completo a leads (incluye IA)')
ON CONFLICT (key) DO NOTHING;

-- Módulo: socios
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('socios.read', 'socios', 'read', 'Ver socios'),
  ('socios.create', 'socios', 'create', 'Crear nuevos socios'),
  ('socios.update', 'socios', 'update', 'Editar socios existentes'),
  ('socios.delete', 'socios', 'delete', 'Eliminar socios'),
  ('socios.admin', 'socios', 'admin', 'Acceso completo a socios')
ON CONFLICT (key) DO NOTHING;

-- Módulo: empresas
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('empresas.read', 'empresas', 'read', 'Ver empresas/entidades'),
  ('empresas.create', 'empresas', 'create', 'Crear nuevas empresas'),
  ('empresas.update', 'empresas', 'update', 'Editar empresas existentes'),
  ('empresas.delete', 'empresas', 'delete', 'Eliminar empresas'),
  ('empresas.admin', 'empresas', 'admin', 'Acceso completo a empresas')
ON CONFLICT (key) DO NOTHING;

-- Módulo: agenda
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('agenda.read', 'agenda', 'read', 'Ver agenda'),
  ('agenda.create', 'agenda', 'create', 'Crear eventos en agenda'),
  ('agenda.update', 'agenda', 'update', 'Editar eventos de agenda'),
  ('agenda.delete', 'agenda', 'delete', 'Eliminar eventos de agenda'),
  ('agenda.admin', 'agenda', 'admin', 'Acceso completo a agenda')
ON CONFLICT (key) DO NOTHING;

-- Módulo: reportes
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('reportes.read', 'reportes', 'read', 'Ver reportes'),
  ('reportes.admin', 'reportes', 'admin', 'Acceso completo a reportes')
ON CONFLICT (key) DO NOTHING;

-- Módulo: config
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('config.read', 'config', 'read', 'Ver configuración'),
  ('config.update', 'config', 'update', 'Editar configuración'),
  ('config.admin', 'config', 'admin', 'Acceso completo a configuración'),
  ('system.danger', 'system', 'danger', 'Operaciones peligrosas (reset-db, etc.)')
ON CONFLICT (key) DO NOTHING;

-- 3. Asignar permisos a roles
-- Admin: todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Gerencia: lectura y reportes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'gerencia'
  AND (p.action = 'read' OR p.module = 'reportes')
ON CONFLICT DO NOTHING;

-- Comercial: leads completo + socios lectura
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'comercial'
  AND (
    p.module = 'leads' OR
    (p.module = 'socios' AND p.action = 'read') OR
    (p.module = 'empresas' AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

-- Operaciones: lectura y actualización de leads, socios, empresas
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'operaciones'
  AND p.module IN ('leads', 'socios', 'empresas')
  AND p.action IN ('read', 'update')
ON CONFLICT DO NOTHING;

-- Solo Lectura: solo lectura en todos los módulos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'solo_lectura'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;
