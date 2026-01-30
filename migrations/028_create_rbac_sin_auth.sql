-- ============================================
-- Sistema RBAC sin Supabase Auth
-- ============================================
-- Tablas para gestionar roles, permisos y usuarios con PIN

-- 1. Tabla roles (mantener si existe, sino crear)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla permissions (NUEVA ESTRUCTURA: id TEXT)
-- Eliminar tabla anterior si existe
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;

CREATE TABLE public.permissions (
  id TEXT PRIMARY KEY, -- IDs exactos: "leads.read", "leads.create", etc.
  label TEXT NOT NULL,
  category TEXT NOT NULL, -- Ej: "leads", "empresas", "agenda", "socios", "reportes", "config", "system"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla role_permissions (relación muchos a muchos)
CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Tabla usuarios (reemplaza profiles, sin auth.users)
-- Eliminar tabla profiles si existe
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL, -- Hash del PIN (usar bcrypt o similar)
  role_id UUID NOT NULL REFERENCES public.roles(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role_id ON public.usuarios(role_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON public.usuarios(activo);

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

-- Trigger para actualizar updated_at en usuarios
CREATE OR REPLACE FUNCTION update_usuarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION update_usuarios_updated_at();

-- Comentarios
COMMENT ON TABLE public.roles IS 'Roles del sistema para RBAC';
COMMENT ON COLUMN public.roles.name IS 'Nombre único del rol (snake_case)';
COMMENT ON COLUMN public.roles.label IS 'Etiqueta legible del rol';
COMMENT ON COLUMN public.roles.is_system IS 'Indica si es un rol del sistema (no se puede eliminar)';

COMMENT ON TABLE public.permissions IS 'Permisos disponibles en el sistema (id TEXT como clave)';
COMMENT ON COLUMN public.permissions.id IS 'ID único del permiso (ej: leads.read, leads.create)';
COMMENT ON COLUMN public.permissions.label IS 'Etiqueta legible del permiso';
COMMENT ON COLUMN public.permissions.category IS 'Categoría del permiso (módulo)';

COMMENT ON TABLE public.role_permissions IS 'Relación muchos a muchos entre roles y permisos';
COMMENT ON TABLE public.usuarios IS 'Usuarios del sistema con autenticación por PIN (sin Supabase Auth)';
