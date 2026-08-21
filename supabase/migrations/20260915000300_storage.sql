-- ===========================================================================
-- SUITON OS 1.0 — Sprint 2 — Stockage et ajustements
-- ===========================================================================

-- Les photos sont deposees AVANT que le chantier existe : le visiteur les
-- ajoute a l'etape 4, le chantier nait a l'etape 6. job_id devient donc
-- nullable, et un depot orphelin plus de 24 h est purge.
alter table public.photos alter column job_id drop not null;

create index photos_orphelines_idx on public.photos (created_at)
  where job_id is null;

create or replace function public.purge_photos_orphelines()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  delete from public.photos
  where job_id is null and created_at < now() - interval '24 hours';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Trace de l'envoi du devis et du lien de portail : sans elle, impossible de
-- savoir si un client a recu quoi que ce soit.
alter table public.quotes add column if not exists portal_sent_at timestamptz;

-- Motif d'echec d'une automatisation, pour diagnostic.
alter table public.automations add column if not exists derniere_erreur text;

-- ---------------------------------------------------------------------------
-- Buckets. Tous PRIVES.
--
-- Un bucket public de photos de chantier expose l'interieur du domicile de
-- vos clients a quiconque devine une URL. L'acces se fait exclusivement par
-- URL signee de courte duree.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chantiers', 'chantiers', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('documents', 'documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Aucune politique storage pour anon ni authenticated : tous les acces
-- passent par le serveur, qui signe les URL. C'est volontairement restrictif.
