-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Interventions, photos, rapports, avis, messages
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- interventions
--
-- La contrainte EXCLUDE empeche physiquement deux interventions de se
-- chevaucher pour une meme equipe, TRAJET COMPRIS. Une verification faite
-- dans le code avant insertion laisserait passer deux acceptations de devis
-- simultanees : la base, elle, ne se trompe pas.
--
-- ends_at_buffered est maintenu par trigger et non par colonne generee :
-- l'addition timestamptz + interval est STABLE, pas IMMUTABLE, et ne peut
-- donc pas entrer dans une expression d'index.
-- ---------------------------------------------------------------------------
create table public.interventions (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id)  on delete cascade,
  team_id       uuid not null references public.teams (id) on delete restrict,

  status        intervention_status not null default 'provisoire',

  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  travel_buffer_min smallint    not null default 30,
  ends_at_buffered  timestamptz not null,

  google_event_id text,

  en_route_at   timestamptz,
  sur_place_at  timestamptz,
  termine_at    timestamptz,

  acces_notes   text,
  annule_motif  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint interventions_ordre   check (ends_at > starts_at),
  constraint interventions_tampon  check (travel_buffer_min between 0 and 240),
  constraint interventions_annule_motif check (status <> 'annule' or annule_motif is not null),

  constraint pas_de_chevauchement exclude using gist (
    team_id with =,
    tstzrange(starts_at, ends_at_buffered, '[)') with &&
  ) where (status <> 'annule')
);

create index interventions_job_idx    on public.interventions (job_id);
create index interventions_team_idx   on public.interventions (team_id, starts_at);
create index interventions_jour_idx   on public.interventions (starts_at)
  where status in ('confirme', 'en_route', 'sur_place');

create or replace function public.set_ends_at_buffered()
returns trigger
language plpgsql
as $$
begin
  new.ends_at_buffered := new.ends_at + make_interval(mins => new.travel_buffer_min);
  return new;
end;
$$;

create trigger interventions_buffer before insert or update on public.interventions
  for each row execute function public.set_ends_at_buffered();

create trigger interventions_touch before update on public.interventions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- photos
--
-- La contrainte pas_de_publication_avec_exif empeche de publier une image
-- dont les metadonnees n'ont pas ete purgees. Sans elle, le rapport PDF
-- transmis au client de votre client contient les coordonnees GPS du
-- domicile du premier.
-- ---------------------------------------------------------------------------
create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,
  intervention_id uuid references public.interventions (id) on delete set null,

  phase         photo_phase not null,
  piece         text        not null default 'general',
  paire         smallint,

  storage_path  text not null,
  thumb_path    text,
  largeur       integer,
  hauteur       integer,
  poids_octets  integer,

  exif_stripped boolean not null default false,
  is_published  boolean not null default false,
  legende       text,

  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint photos_path_unique unique (storage_path),
  constraint photos_paire_plage check (paire is null or paire between 1 and 40),
  constraint pas_de_publication_avec_exif check (not is_published or exif_stripped)
);

create index photos_job_idx   on public.photos (job_id, phase);
create index photos_paire_idx on public.photos (job_id, paire) where paire is not null;

-- ---------------------------------------------------------------------------
-- reports : le rapport de fin de chantier. Les observations sont obligatoires
-- parce que c'est ce champ qui protege SUITON : un degat preexistant
-- photographie et signale le jour meme ne peut plus lui etre impute
-- trois semaines plus tard.
-- ---------------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null,
  job_id        uuid not null references public.jobs (id) on delete cascade,
  intervention_id uuid references public.interventions (id) on delete set null,

  checklist     jsonb not null default '[]'::jsonb,
  observations  text  not null,
  duree_reelle_min integer,

  garantie_jusqu_au timestamptz not null default (now() + interval '48 hours'),

  pdf_path      text,
  sent_at       timestamptz,

  validated_by  uuid references public.profiles (id) on delete set null,
  validated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  constraint reports_numero_unique unique (numero),
  constraint reports_un_par_intervention unique (intervention_id),
  constraint reports_observations_non_vides check (length(btrim(observations)) >= 1),
  constraint reports_checklist_complete check (jsonb_array_length(checklist) = 6)
);

create index reports_job_idx on public.reports (job_id);

create or replace function public.set_report_numero()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_annee smallint := extract(year from now())::smallint;
begin
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := format('SUITON-R-%s-%s', v_annee,
                         lpad(public.next_number('report', v_annee)::text, 4, '0'));
  end if;
  return new;
end;
$$;

create trigger reports_numero before insert on public.reports
  for each row execute function public.set_report_numero();

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references public.jobs (id)    on delete set null,
  client_id     uuid references public.clients (id) on delete set null,

  note          smallint not null,
  texte         text,
  auteur        text,
  google_review_id text,
  publiee_le    date,

  sollicitee_le timestamptz,
  refus_avis    boolean not null default false,

  created_at    timestamptz not null default now(),

  constraint reviews_note_plage check (note between 1 and 5),
  constraint reviews_google_unique unique (google_review_id)
);

create index reviews_job_idx on public.reviews (job_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,
  channel       message_channel not null default 'portail',
  sortant       boolean not null default false,
  corps         text    not null,
  auteur_id     uuid references public.profiles (id) on delete set null,
  auteur_label  text,
  lu_at         timestamptz,
  created_at    timestamptz not null default now(),

  constraint messages_corps_non_vide check (length(btrim(corps)) >= 1)
);

create index messages_job_idx on public.messages (job_id, created_at desc);
create index messages_non_lus_idx on public.messages (job_id)
  where lu_at is null and not sortant;
