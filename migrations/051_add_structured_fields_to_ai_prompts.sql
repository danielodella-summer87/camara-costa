alter table if exists public.ai_prompts
  add column if not exists role_persona text,
  add column if not exists context_environment text,
  add column if not exists objective text,
  add column if not exists specific_task text,
  add column if not exists constraints text,
  add column if not exists output_format text,
  add column if not exists target_audience text;

