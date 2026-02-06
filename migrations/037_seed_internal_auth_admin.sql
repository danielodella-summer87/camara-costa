-- Seed admin para auth interno (usuario daniel / Cambiar123!)
-- Ejecutar una vez. Si ya existe app_users con ese email, se usa su id.

-- 1) Crear app_users para daniel.odella@gmail.com si no existe
INSERT INTO public.app_users (email, nombre, is_active, role_id)
SELECT
  'daniel.odella@gmail.com',
  'Daniel',
  true,
  (SELECT id FROM public.roles WHERE name ILIKE 'admin' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_users WHERE LOWER(TRIM(email)) = 'daniel.odella@gmail.com'
);

-- 2) Insertar credenciales (username 'daniel', password hash de 'Cambiar123!')
-- Si ya existe user_id (por email), ON CONFLICT en user_id actualiza el hash.
INSERT INTO public.app_credentials (user_id, username, password_hash, must_change_password)
SELECT
  u.id,
  'daniel',
  '$2b$10$V1ORxg8rH0qSkQDLHEPeTOwHpbuftksEI0hAexJLYEsOksf5Dk9bu',
  true
FROM public.app_users u
WHERE LOWER(TRIM(u.email)) = 'daniel.odella@gmail.com'
LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  must_change_password = EXCLUDED.must_change_password;
