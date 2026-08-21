-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Identite, equipes, helpers RLS
-- ===========================================================================

-- --------------------------------------------------------------------------
-- profiles : extension de auth.users. Un utilisateur SUITON = un profil.
-- --------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        app_role    not null default 'technicien',
  nom         text        not null,
  telephone   text,
  actif       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint nom_non_vide check (length(btrim(nom)) >= 2)
);

comment on table public.profiles is
  'Utilisateurs internes et partenaires. Les clients n''ont pas de compte.';

create index profiles_role_idx on public.profiles (role) where actif;

-- --------------------------------------------------------------------------
-- teams / team_members : une intervention est affectee a une equipe,
-- jamais directement a une personne. Une personne peut changer d''equipe.
-- --------------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  nom         text        not null unique,
  couleur     text        not null default '#14415F',
  actif       boolean     not null default true,
  created_at  timestamptz not null default now(),
  constraint couleur_hex check (couleur ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.team_members (
  team_id    uuid not null references public.teams (id)    on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chef       boolean not null default false,
  primary key (team_id, profile_id)
);

create index team_members_profile_idx on public.team_members (profile_id);

-- --------------------------------------------------------------------------
-- Helpers RLS.
--
-- SECURITY DEFINER + search_path fige : sans cela, une politique RLS sur
-- profiles qui appelle une fonction lisant profiles boucle a l'infini.
-- STABLE : le resultat ne change pas dans une meme requete, Postgres peut
-- le mettre en cache.
-- --------------------------------------------------------------------------
create or replace function public.current_role_of()
returns app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.actif
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_of() in ('admin', 'staff'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_of() = 'admin', false)
$$;

create or replace function public.my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tm.team_id from public.team_members tm where tm.profile_id = auth.uid()
$$;

-- --------------------------------------------------------------------------
-- Horodatage automatique. Applique a toute table portant updated_at.
-- --------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- Creation automatique du profil a l'inscription.
-- Le role par defaut est le moins privilegie : promouvoir est un acte
-- deliberé, pas un effet de bord.
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nom, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nom'), ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'technicien')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
