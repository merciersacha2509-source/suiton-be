-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Clients, partenaires, chantiers
-- ===========================================================================

-- --------------------------------------------------------------------------
-- clients : personnes physiques et contacts. Un partenaire (personne morale)
-- vit dans partners ; un chantier a toujours un client, eventuellement
-- rattache a un partenaire.
-- --------------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  kind          client_kind not null default 'particulier',
  nom           text        not null,
  email         text        not null,
  telephone     text        not null,
  adresse       text,
  commune       text,
  code_postal   text,
  tva           text,

  -- Score deterministe, borne 0-140 (socle 100 + comportement plafonne a 40).
  score         smallint    not null default 0,
  -- Bande calculee par la base : deux implementations divergeraient.
  score_band    text generated always as (
                  case
                    when score >= 110 then 'A+'
                    when score >=  85 then 'A'
                    when score >=  55 then 'B'
                    else 'C'
                  end
                ) stored,

  consent_photos      boolean     not null default false,
  consent_photos_at   timestamptz,
  no_contact          boolean     not null default false,
  notes               text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint clients_score_borne    check (score between 0 and 140),
  constraint clients_tva_format     check (tva is null or tva ~ '^BE[0-9]{10}$'),
  constraint clients_cp_format      check (code_postal is null or code_postal ~ '^[0-9]{4}$'),
  constraint clients_pro_a_une_tva  check (kind = 'particulier' or tva is not null),
  -- Un consentement sans date n'est pas prouvable en cas de controle.
  constraint clients_consent_date   check (not consent_photos or consent_photos_at is not null)
);

-- Unicite insensible a la casse sans dependre du type citext :
-- « Jean@Example.be » et « jean@example.be » sont le meme client.
create unique index clients_email_unique on public.clients (lower(email));

create index clients_score_idx   on public.clients (score desc);
create index clients_commune_idx on public.clients (commune);
create index clients_kind_idx    on public.clients (kind);

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- partners : entreprises generales, promoteurs, architectes, agences.
-- --------------------------------------------------------------------------
create table public.partners (
  id              uuid primary key default gen_random_uuid(),
  denomination    text        not null,
  tva             text        not null,
  peppol_id       text,
  segment         text        not null default 'entreprise_generale',
  adresse         text,
  commune         text,
  code_postal     text,
  remise_pct      numeric(5,2) not null default 0,
  conditions_paiement_jours smallint not null default 30,
  actif           boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint partners_tva_unique  unique (tva),
  constraint partners_tva_format  check (tva ~ '^BE[0-9]{10}$'),
  constraint partners_remise      check (remise_pct between 0 and 30),
  constraint partners_segment_connu check (
    segment in ('entreprise_generale', 'promoteur', 'architecte', 'agence', 'syndic', 'autre')
  )
);

create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();

-- Peppol se derive de la TVA en Belgique : 9925:BE + les 10 chiffres.
create or replace function public.set_peppol_id()
returns trigger
language plpgsql
as $$
begin
  if new.peppol_id is null and new.tva is not null then
    new.peppol_id := '9925:' || new.tva;
  end if;
  return new;
end;
$$;

create trigger partners_peppol before insert or update on public.partners
  for each row execute function public.set_peppol_id();

-- --------------------------------------------------------------------------
-- partner_users : qui, chez le partenaire, accede au portail B2B.
-- Un seul responsable : c'est lui qui voit les montants et gere les acces.
-- --------------------------------------------------------------------------
create table public.partner_users (
  partner_id  uuid    not null references public.partners (id) on delete cascade,
  profile_id  uuid    not null references public.profiles (id) on delete cascade,
  responsable boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (partner_id, profile_id)
);

create unique index partner_users_un_seul_responsable
  on public.partner_users (partner_id) where responsable;

create index partner_users_profile_idx on public.partner_users (profile_id);

-- --------------------------------------------------------------------------
-- counters + next_number() : numerotation continue et sans trou.
--
-- Compter les lignes existantes produirait des doublons en concurrence et
-- un trou apres un rollback. Les deux se voient en controle fiscal.
-- Le verrou de ligne serialise les emissions ; c'est volontaire.
-- --------------------------------------------------------------------------
create table public.counters (
  scope       text     not null,
  annee       smallint not null,
  valeur      integer  not null default 0,
  primary key (scope, annee)
);

create or replace function public.next_number(p_scope text, p_annee smallint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valeur integer;
begin
  insert into public.counters (scope, annee, valeur)
  values (p_scope, p_annee, 0)
  on conflict (scope, annee) do nothing;

  select valeur into v_valeur
  from public.counters
  where scope = p_scope and annee = p_annee
  for update;                                   -- serialisation explicite

  v_valeur := v_valeur + 1;

  update public.counters set valeur = v_valeur
  where scope = p_scope and annee = p_annee;

  return v_valeur;
end;
$$;

-- --------------------------------------------------------------------------
-- jobs : le chantier. Table centrale du systeme.
-- --------------------------------------------------------------------------
create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  reference       text        not null,

  client_id       uuid        not null references public.clients (id)  on delete restrict,
  partner_id      uuid        references public.partners (id)          on delete set null,
  assigned_to     uuid        references public.profiles (id)          on delete set null,

  stage           job_stage   not null default 'nouveau',
  service         service_type not null,
  property_type   property_type not null default 'autre',
  soil            soil_level  not null default 'standard',
  surface_m2      integer     not null,

  adresse         text,
  commune         text        not null,
  code_postal     text,
  zone            zone_tier   not null default 'principale',

  urgent          boolean     not null default false,
  date_souhaitee  date,

  -- Estimation issue de la grille tarifaire au moment de la demande.
  -- Figee : modifier la grille ne doit pas reecrire l'historique.
  estimation_min  numeric(10,2),
  estimation_max  numeric(10,2),

  duree_estimee_min integer,
  duree_reelle_min   integer,

  source          text        not null default 'site',
  notes           text,
  perdu_motif     text,

  published       boolean     not null default false,
  published_slug  text,
  published_at    timestamptz,
  resume_public   text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint jobs_reference_unique unique (reference),
  constraint jobs_slug_unique      unique (published_slug),
  constraint jobs_surface_plage    check (surface_m2 between 10 and 5000),
  constraint jobs_estimation_ordre check (
    estimation_min is null or estimation_max is null or estimation_min <= estimation_max
  ),
  constraint jobs_perdu_motif      check (stage <> 'perdu' or perdu_motif is not null),
  -- Une realisation publiee sans resume redige a la main est un doublon
  -- de gabarit : Google la traite comme tel (chapitre 26.3).
  constraint jobs_publie_a_un_resume check (
    not published or (published_slug is not null and length(btrim(coalesce(resume_public, ''))) >= 80)
  )
);

create index jobs_stage_idx     on public.jobs (stage);
create index jobs_client_idx    on public.jobs (client_id);
create index jobs_partner_idx   on public.jobs (partner_id) where partner_id is not null;
create index jobs_assigned_idx  on public.jobs (assigned_to) where assigned_to is not null;
create index jobs_commune_idx   on public.jobs (commune);
create index jobs_created_idx   on public.jobs (created_at desc);
create index jobs_publies_idx   on public.jobs (published_at desc) where published;

create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- Reference SUITON-2026-0148, attribuee par le compteur.
create or replace function public.set_job_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_annee smallint := extract(year from now())::smallint;
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := format('SUITON-%s-%s', v_annee,
                            lpad(public.next_number('job', v_annee)::text, 4, '0'));
  end if;
  return new;
end;
$$;

create trigger jobs_reference before insert on public.jobs
  for each row execute function public.set_job_reference();
