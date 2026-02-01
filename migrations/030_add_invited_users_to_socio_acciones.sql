-- Invitados por actividad (usuarios del CRM)
alter table public.socio_acciones
  add column if not exists invited_user_ids uuid[] not null default '{}';

create index if not exists idx_socio_acciones_invited_user_ids
  on public.socio_acciones using gin (invited_user_ids);
