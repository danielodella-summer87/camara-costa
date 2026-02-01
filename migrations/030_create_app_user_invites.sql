-- 030_create_app_user_invites.sql

create table if not exists public.app_user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  invited_by uuid null
);

-- email único case-insensitive
create unique index if not exists app_user_invites_email_lower_uniq
on public.app_user_invites (lower(email));

-- opcional: rol validado (si querés estricta)
-- alter table public.app_user_invites
--   add constraint app_user_invites_role_chk
--   check (role in ('admin','comercial','viewer'));
