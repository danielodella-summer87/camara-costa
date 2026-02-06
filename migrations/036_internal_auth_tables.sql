-- Auth interno (v1): usuario + contraseña sin Supabase Auth

-- A) Credenciales por app_user (username único)
CREATE TABLE IF NOT EXISTS public.app_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_credentials IS 'Credenciales para login interno (username + password hash)';

-- B) Sesiones activas (token hasheado)
CREATE TABLE IF NOT EXISTS public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON public.app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_token_hash ON public.app_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON public.app_sessions(expires_at);

COMMENT ON TABLE public.app_sessions IS 'Sesiones de auth interno (token_hash = SHA-256 del token en cookie)';
