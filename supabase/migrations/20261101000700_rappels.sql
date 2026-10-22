-- ===========================================================================
-- Demandes de rappel — visibilite dans le tableau de bord
-- ===========================================================================
-- Le formulaire "Demander un rappel" (Contact, Nettoyage textile, Nettoyage
-- auto) n'ecrivait qu'un courriel : rien en base, donc invisible du tableau
-- de bord, sans historique, sans etape de suivi. Une vraie demande recue par
-- ce canal a d'abord ete traitee "a la main", uniquement retrouvable dans la
-- boite mail.
--
-- Ces demandes ne rejoignent pas `jobs` : elles n'ont ni surface, ni zone, ni
-- prix calcule — le modele de `jobs` suppose ces trois donnees pour tout,
-- de la RLS au calcul TVA. Une table separee, plus simple, evite de rendre
-- nullable la moitie des colonnes de `jobs` pour un besoin qui ne leur
-- ressemble pas.
-- ===========================================================================

create type public.rappel_source as enum ('contact', 'nettoyage-auto', 'nettoyage-textile', 'vitres');
create type public.rappel_stage  as enum ('nouveau', 'contacte', 'traite', 'perdu');

create table public.rappels (
  id          uuid primary key default gen_random_uuid(),

  nom         text not null,
  telephone   text not null,
  email       text,
  adresse     text,
  message     text,
  source      public.rappel_source not null,

  -- Ids de public.photos (memes uploads que le parcours de reservation).
  -- job_id y est nullable depuis la migration storage : ces photos restent
  -- simplement non rattachees a un chantier.
  photos      uuid[] not null default '{}',

  stage       public.rappel_stage not null default 'nouveau',
  perdu_motif text,

  ip          text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rappels_stage_idx on public.rappels (stage, created_at desc);

create trigger rappels_touch
  before update on public.rappels
  for each row execute function public.touch_updated_at();

alter table public.rappels enable row level security;

-- Meme regle que jobs_staff : le bureau et la direction voient et modifient
-- tout, personne d'autre n'a de raison d'y toucher.
create policy rappels_staff on public.rappels
  for all using (public.is_staff()) with check (public.is_staff());
