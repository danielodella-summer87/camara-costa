-- 022_helpdesk_mesa_de_ayuda.sql
-- Módulo: Mesa de ayuda (tickets + comentarios + adjuntos)
-- Usuarios: app_users
-- Capturas: storage bucket "helpdesk" (múltiples por ticket)

-- EXTENSION (por si falta, en algunos setups)
-- create extension if not exists pgcrypto;

-- =========================
-- 1) TABLAS
-- =========================

create table if not exists public.helpdesk_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),

  created_by uuid not null references public.app_users(id) on delete restrict,
  admin_assignee uuid null references public.app_users(id) on delete set null,

  title text not null,
  description text not null,

  type text not null default 'bug'
    check (type in ('bug','improvement','suggestion')),

  priority text not null default 'medium'
    check (priority in ('low','medium','high','critical')),

  status text not null default 'new'
    check (status in ('new','triage','in_progress','resolved','closed')),

  closed_at timestamptz null
);

create index if not exists helpdesk_tickets_created_by_idx
  on public.helpdesk_tickets(created_by);

create index if not exists helpdesk_tickets_status_idx
  on public.helpdesk_tickets(status);

create index if not exists helpdesk_tickets_priority_idx
  on public.helpdesk_tickets(priority);

create index if not exists helpdesk_tickets_last_activity_idx
  on public.helpdesk_tickets(last_activity_at desc);


create table if not exists public.helpdesk_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  created_by uuid not null references public.app_users(id) on delete restrict,

  body text not null,
  is_internal boolean not null default false
);

create index if not exists helpdesk_comments_ticket_id_idx
  on public.helpdesk_comments(ticket_id, created_at asc);


create table if not exists public.helpdesk_attachments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  created_by uuid not null references public.app_users(id) on delete restrict,

  file_path text not null,     -- storage path: ticket/<ticket_id>/<uuid>.<ext>
  file_name text not null,
  mime_type text null,
  size_bytes int null
);

create index if not exists helpdesk_attachments_ticket_id_idx
  on public.helpdesk_attachments(ticket_id, created_at asc);


-- =========================
-- 2) TRIGGERS: updated_at + last_activity_at
-- =========================

create or replace function public.helpdesk_touch_ticket()
returns trigger
language plpgsql
as $$
begin
  update public.helpdesk_tickets
    set updated_at = now(),
        last_activity_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_helpdesk_comments_touch on public.helpdesk_comments;
create trigger trg_helpdesk_comments_touch
after insert on public.helpdesk_comments
for each row execute function public.helpdesk_touch_ticket();

drop trigger if exists trg_helpdesk_attachments_touch on public.helpdesk_attachments;
create trigger trg_helpdesk_attachments_touch
after insert on public.helpdesk_attachments
for each row execute function public.helpdesk_touch_ticket();

create or replace function public.helpdesk_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_helpdesk_tickets_updated_at on public.helpdesk_tickets;
create trigger trg_helpdesk_tickets_updated_at
before update on public.helpdesk_tickets
for each row execute function public.helpdesk_set_updated_at();


-- =========================
-- 3) STORAGE: bucket "helpdesk"
-- (si ya existe, no pasa nada)
-- =========================

insert into storage.buckets (id, name, public)
values ('helpdesk', 'helpdesk', false)
on conflict (id) do nothing;


-- =========================
-- 4) (Opcional) RLS básico
-- Si aún no tenés RBAC de admin definido en DB,
-- podés dejar RLS apagado y controlar desde API.
-- =========================

-- alter table public.helpdesk_tickets enable row level security;
-- alter table public.helpdesk_comments enable row level security;
-- alter table public.helpdesk_attachments enable row level security;

-- Ejemplo de policy "solo dueño":
-- create policy "tickets_select_own" on public.helpdesk_tickets
-- for select using (created_by = auth.uid());

-- create policy "tickets_insert_own" on public.helpdesk_tickets
-- for insert with check (created_by = auth.uid());

-- create policy "comments_select_own_ticket" on public.helpdesk_comments
-- for select using (
--   exists (
--     select 1 from public.helpdesk_tickets t
--     where t.id = ticket_id and t.created_by = auth.uid()
--   )
-- );

-- create policy "comments_insert_own_ticket" on public.helpdesk_comments
-- for insert with check (
--   exists (
--     select 1 from public.helpdesk_tickets t
--     where t.id = ticket_id and t.created_by = auth.uid()
--   )
-- );

-- Storage policies (depende de tu enfoque de auth).
-- Para MVP, lo más simple: subida desde cliente autenticado via API o client supabase.
