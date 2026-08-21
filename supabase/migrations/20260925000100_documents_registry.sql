-- ===========================================================================
-- SUITON OS 1.0 — Sprint 4 — Registre documentaire
-- ===========================================================================
-- Tout document produit par SUITON OS est inscrit ici. C'est ce registre qui
-- permet de repondre a « quelle version du devis le client a-t-il recue ? »
-- six mois plus tard — question qui n'a pas de reponse si on se contente
-- d'ecraser un fichier dans le stockage.
-- ===========================================================================

create type document_type as enum (
  'devis',
  'facture',
  'rapport',
  'attestation',
  'bon_intervention',
  'fiche_chantier',
  'rapport_qualite'
);

create type document_destinataire as enum ('client', 'equipe', 'interne');

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,

  type          document_type not null,
  destinataire  document_destinataire not null,

  numero        text not null,
  version       smallint not null default 1,

  storage_path  text not null,
  octets        integer,
  pages         smallint,

  -- Empreinte du PDF. Deux generations avec les memes donnees produisent le
  -- meme fichier : un hash identique signale une regeneration inutile, un
  -- hash different prouve que quelque chose a change.
  hash          text,

  -- Donnees ayant servi a la generation. Permet de rejouer un document a
  -- l'identique meme si la grille tarifaire a change depuis.
  snapshot      jsonb not null default '{}'::jsonb,

  -- Lien vers l'entite metier (quote_id, invoice_id, report_id…)
  entity_id     uuid,

  sent_at       timestamptz,
  sent_to       text,

  superseded_by uuid references public.documents (id) on delete set null,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint documents_version_positive check (version >= 1),
  constraint documents_hash_format check (hash is null or hash ~ '^[0-9a-f]{64}$')
);

create index documents_job_idx on public.documents (job_id, type, version desc);
create index documents_type_idx on public.documents (type, created_at desc);
create index documents_entity_idx on public.documents (entity_id) where entity_id is not null;

-- Une seule version courante par (chantier, type, numero).
create unique index documents_version_unique
  on public.documents (job_id, type, numero, version);

/**
 * Prochaine version d'un document.
 *
 * Regenerer un devis ne remplace pas l'ancien : il en cree la version 2 et
 * marque la version 1 comme remplacee. Le client qui produit un PDF « qu'on
 * lui aurait envoye » peut ainsi etre confronte a ce qui a reellement ete
 * transmis, et quand.
 */
create or replace function public.prochaine_version_document(
  p_job_id uuid,
  p_type   document_type,
  p_numero text
)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(max(version), 0)::smallint + 1
  from public.documents
  where job_id = p_job_id and type = p_type and numero = p_numero
$$;

-- Marque automatiquement la version precedente comme remplacee.
create or replace function public.remplacer_version_precedente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.version > 1 then
    update public.documents
    set superseded_by = new.id
    where job_id = new.job_id
      and type = new.type
      and numero = new.numero
      and version < new.version
      and superseded_by is null;
  end if;
  return new;
end;
$$;

create trigger documents_supersede
  after insert on public.documents
  for each row execute function public.remplacer_version_precedente();

-- ---------------------------------------------------------------------------
-- Archive de chantier
--
-- Un chantier archive est clos : plus de generation, plus de modification.
-- L'archive fige la liste des documents et les chiffres cles, pour que la
-- suppression ulterieure d'un client (RGPD) n'efface pas la trace comptable.
-- ---------------------------------------------------------------------------
create table public.job_archives (
  job_id        uuid primary key references public.jobs (id) on delete cascade,
  reference     text not null,

  archive_at    timestamptz not null default now(),
  archive_par   uuid references public.profiles (id) on delete set null,

  -- Instantane complet : client, chantier, montants, documents, chronologie.
  -- Volontairement denormalise : une archive qui depend de six jointures
  -- n'est plus une archive.
  contenu       jsonb not null,

  documents_count smallint not null default 0,
  montant_ttc     numeric(10,2),

  constraint archives_contenu_non_vide check (jsonb_typeof(contenu) = 'object')
);

create index job_archives_date_idx on public.job_archives (archive_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.documents     enable row level security;
alter table public.job_archives  enable row level security;

create policy documents_staff on public.documents
  for all using (public.is_staff()) with check (public.is_staff());

-- Le technicien voit les documents de terrain de ses chantiers, jamais les
-- documents commerciaux.
create policy documents_technicien_read on public.documents
  for select using (
    destinataire = 'equipe'
    and exists (
      select 1 from public.interventions i
      where i.job_id = documents.job_id
        and i.team_id in (select public.my_team_ids())
    )
  );

create policy documents_partenaire_read on public.documents
  for select using (
    destinataire = 'client'
    and exists (
      select 1
      from public.jobs j
      join public.partner_users pu on pu.partner_id = j.partner_id
      where j.id = documents.job_id and pu.profile_id = auth.uid()
    )
  );

create policy archives_staff on public.job_archives
  for all using (public.is_staff()) with check (public.is_staff());
