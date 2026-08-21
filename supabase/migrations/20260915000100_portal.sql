-- ===========================================================================
-- SUITON OS 1.0 — Sprint 2 — Portail client, limitation de debit, stockage
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- portal_tokens
--
-- Le jeton n'est JAMAIS stocke en clair. On garde sha256(jeton || poivre) :
-- une fuite de la base ne donne alors acces a aucun dossier.
--
-- Consequence assumee : un jeton perdu ne se retrouve pas, il se regenere.
-- ---------------------------------------------------------------------------
create table public.portal_tokens (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  token_hash   text not null,
  expires_at   timestamptz not null default (now() + interval '12 months'),
  revoked_at   timestamptz,
  last_seen_at timestamptz,
  hits         integer not null default 0,
  created_at   timestamptz not null default now(),

  constraint portal_tokens_hash_unique unique (token_hash),
  constraint portal_tokens_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

create index portal_tokens_job_idx on public.portal_tokens (job_id)
  where revoked_at is null;

-- Un seul jeton actif par chantier : plusieurs liens valides en circulation
-- rendent la revocation illusoire.
create unique index portal_tokens_un_actif_par_job
  on public.portal_tokens (job_id) where revoked_at is null;

-- Enregistre un passage sur le portail. L'increment se fait en SQL : lire
-- puis reecrire depuis l'application ecraserait un acces concurrent.
create or replace function public.touch_portal_token(p_token_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.portal_tokens
  set last_seen_at = now(), hits = hits + 1
  where id = p_token_id;
$$;

-- ---------------------------------------------------------------------------
-- rate_limits
--
-- Limitation de debit en base et non en memoire : sur Vercel, chaque requete
-- peut atterrir sur une instance differente, un compteur en memoire ne
-- limite donc rien du tout.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket      text        not null,
  cle         text        not null,
  fenetre     timestamptz not null,
  compteur    integer     not null default 0,
  primary key (bucket, cle, fenetre)
);

create index rate_limits_purge_idx on public.rate_limits (fenetre);

create or replace function public.consume_rate_limit(
  p_bucket   text,
  p_cle      text,
  p_limite   integer,
  p_fenetre_secondes integer
)
returns table (autorise boolean, restant integer, reset_dans integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fenetre timestamptz;
  v_compteur integer;
begin
  -- Fenetre glissante par tranche fixe : simple, previsible, et suffisant
  -- pour arreter un robot.
  v_fenetre := to_timestamp(floor(extract(epoch from now()) / p_fenetre_secondes) * p_fenetre_secondes);

  insert into public.rate_limits (bucket, cle, fenetre, compteur)
  values (p_bucket, p_cle, v_fenetre, 1)
  on conflict (bucket, cle, fenetre)
  do update set compteur = public.rate_limits.compteur + 1
  returning compteur into v_compteur;

  return query select
    v_compteur <= p_limite,
    greatest(0, p_limite - v_compteur),
    ceil(extract(epoch from (v_fenetre + make_interval(secs => p_fenetre_secondes)) - now()))::integer;
end;
$$;

-- Purge des fenetres expirees. Appelee par la tache horaire.
create or replace function public.purge_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_supprimes integer;
begin
  delete from public.rate_limits where fenetre < now() - interval '2 hours';
  get diagnostics v_supprimes = row_count;
  return v_supprimes;
end;
$$;

-- ---------------------------------------------------------------------------
-- Brouillons de reservation
--
-- Le parcours fait six etapes. Un visiteur qui abandonne a l'etape 4 laisse
-- une trace exploitable : c'est la seule raison d'etre de cette table.
-- Elle ne contient AUCUNE donnee personnelle tant que l'etape coordonnees
-- n'est pas franchie.
-- ---------------------------------------------------------------------------
create table public.booking_drafts (
  id          uuid primary key default gen_random_uuid(),
  payload     jsonb not null default '{}'::jsonb,
  etape       smallint not null default 1,
  converti_en uuid references public.jobs (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint booking_drafts_etape check (etape between 1 and 6)
);

create index booking_drafts_abandon_idx on public.booking_drafts (created_at desc)
  where converti_en is null;

create trigger booking_drafts_touch before update on public.booking_drafts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.portal_tokens  enable row level security;
alter table public.rate_limits    enable row level security;
alter table public.booking_drafts enable row level security;

create policy portal_tokens_staff on public.portal_tokens
  for all using (public.is_staff()) with check (public.is_staff());

create policy booking_drafts_staff on public.booking_drafts
  for select using (public.is_staff());

-- rate_limits : aucune politique permissive. Seule la fonction SECURITY
-- DEFINER y touche. Un client capable de lire cette table saurait combien
-- de tentatives il lui reste.
