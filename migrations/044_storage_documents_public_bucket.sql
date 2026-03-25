-- Bucket público para PDFs archivados desde Gamma (URL estable vía getPublicUrl).
-- La app sube con service role; la lectura es pública (rutas con UUID/timestamp).

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

-- Lectura anónima de objetos en este bucket (URL pública estable).
drop policy if exists "documents_public_read" on storage.objects;
create policy "documents_public_read"
on storage.objects for select
to public
using (bucket_id = 'documents');
