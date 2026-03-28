create table if not exists public.ai_prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.ai_prompts(id) on delete cascade,
  suggested_content text not null,
  suggestion_type text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'discarded')),
  created_at timestamptz not null default now(),
  applied_at timestamptz null,
  discarded_at timestamptz null
);

create index if not exists ai_prompt_suggestions_prompt_id_idx
  on public.ai_prompt_suggestions(prompt_id);

create index if not exists ai_prompt_suggestions_status_idx
  on public.ai_prompt_suggestions(status);

