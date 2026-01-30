-- ============================================
-- Sistema RBAC (Role-Based Access Control)
-- ============================================
-- Tablas para gestionar roles, permisos y asignaciones

-- 1. Tabla roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false, -- Roles del sistema no se pueden eliminar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla permissions
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, -- Ej: "leads.create", "leads.update", "config.admin"
  module TEXT NOT NULL, -- Ej: "leads", "config", "socios"
  action TEXT NOT NULL, -- Ej: "create", "update", "delete", "read", "admin"
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla role_permissions (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Tabla profiles (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  role_id UUID NULL REFERENCES public.roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger para actualizar updated_at en roles
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION update_roles_updated_at();

-- Trigger para actualizar updated_at en profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_updated_at();

-- Comentarios
COMMENT ON TABLE public.roles IS 'Roles del sistema para RBAC';
COMMENT ON COLUMN public.roles.name IS 'Nombre único del rol (snake_case)';
COMMENT ON COLUMN public.roles.label IS 'Etiqueta legible del rol';
COMMENT ON COLUMN public.roles.is_system IS 'Indica si es un rol del sistema (no se puede eliminar)';

COMMENT ON TABLE public.permissions IS 'Permisos disponibles en el sistema';
COMMENT ON COLUMN public.permissions.key IS 'Clave única del permiso (ej: leads.create)';
COMMENT ON COLUMN public.permissions.module IS 'Módulo al que pertenece el permiso';
COMMENT ON COLUMN public.permissions.action IS 'Acción del permiso (create, update, delete, read, admin)';

COMMENT ON TABLE public.role_permissions IS 'Relación muchos a muchos entre roles y permisos';
COMMENT ON TABLE public.profiles IS 'Perfiles de usuario que extienden auth.users con role_id';
