-- ===========================================================================
-- SUITON OS 1.0 — Sprint 7 — SUITON Intelligence
-- ===========================================================================
-- Le systeme ne modifie JAMAIS la grille tarifaire de lui-meme.
--
-- Il propose, le dirigeant valide, le resultat est mesure, le systeme
-- apprend. Une recommandation appliquee sans mesure du resultat n'apprend
-- rien : c'est une opinion executee.
-- ===========================================================================

create type recommandation_famille as enum (
  'tarification', 'planning', 'prospection', 'qualite', 'productivite'
);

create type recommandation_statut as enum (
  'proposee',    -- produite par le moteur, pas encore vue
  'acceptee',    -- le dirigeant l'applique
  'rejetee',     -- ecartee, avec un motif
  'experimentee',-- transformee en experience controlee
  'obsolete'     -- les donnees ont change, elle ne tient plus
);

/**
 * Recommandations tracees.
 *
 * Le moteur les recalcule a chaque affichage — elles sont deterministes.
 * Cette table ne stocke donc pas les recommandations elles-memes, mais les
 * DECISIONS prises a leur sujet : ce qui a ete accepte, rejete, et pourquoi.
 *
 * C'est cette trace qui permet, six mois plus tard, de repondre a « on avait
 * proposé d'augmenter les maisons, qu'est-ce qu'on en a fait ? ».
 */
create table public.recommandations (
  id            uuid primary key default gen_random_uuid(),
  -- Code deterministe : meme situation, meme code. Permet de relier une
  -- decision passee a une recommandation reapparue.
  code          text not null,
  famille       recommandation_famille not null,
  statut        recommandation_statut not null default 'proposee',

  titre         text not null,
  action        text not null,

  -- Instantane du raisonnement au moment de la decision. Sans lui, on ne
  -- peut pas juger apres coup si la decision etait raisonnable AVEC LES
  -- DONNEES DE L'EPOQUE — ce qui est la seule facon honnete de la juger.
  contexte      jsonb not null default '{}'::jsonb,

  gain_min      numeric(10,2),
  gain_max      numeric(10,2),
  chantiers_concernes smallint not null default 0,
  confiance     niveau_confiance not null default 'aucune',

  decide_par    uuid references public.profiles (id) on delete set null,
  decide_le     timestamptz,
  motif_rejet   text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint recommandations_gain_ordre check (
    gain_min is null or gain_max is null or gain_min <= gain_max
  ),
  constraint recommandations_rejet_motive check (
    statut <> 'rejetee' or motif_rejet is not null
  ),
  constraint recommandations_decidee_datee check (
    statut in ('proposee', 'obsolete') or decide_le is not null
  )
);

create index recommandations_statut_idx on public.recommandations (statut, created_at desc);
create unique index recommandations_active_unique
  on public.recommandations (code) where statut in ('proposee', 'acceptee', 'experimentee');

create trigger recommandations_touch before update on public.recommandations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Experiences controlees
--
-- C'est la partie honnete du systeme. Plutot que d'affirmer qu'une hausse de
-- 8 % passera, on la TESTE sur une periode donnee et un perimetre donne, et
-- on compare avec la meme rigueur statistique que partout ailleurs : au
-- moins 5 chantiers de chaque cote, medianes, et refus de conclure sinon.
-- ---------------------------------------------------------------------------
create type experience_statut as enum ('brouillon', 'en_cours', 'terminee', 'abandonnee');

create table public.experiences (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null,
  hypothese     text not null,
  famille       recommandation_famille not null,
  statut        experience_statut not null default 'brouillon',

  -- Perimetre : quels chantiers en font partie. Colonnes nullables = « tous ».
  service       service_type,
  property_type property_type,
  bande         text,
  soil          soil_level,
  commune       text,

  -- Periode de reference (avant) et periode de test (apres).
  reference_debut date not null,
  reference_fin   date not null,
  test_debut      date not null,
  test_fin        date,

  -- Indicateur observe.
  indicateur    text not null default 'ca_horaire',

  -- Rempli a la cloture. Null tant que l'experience court.
  verdict       text,
  conclusion    text,

  cree_par      uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint experiences_periodes check (
    reference_fin > reference_debut and (test_fin is null or test_fin > test_debut)
  ),
  constraint experiences_ordre check (test_debut >= reference_fin),
  constraint experiences_bande check (bande is null or bande in ('xs','s','m','l','xl')),
  constraint experiences_indicateur check (
    indicateur in ('ca_horaire', 'minutes_par_m2', 'facture_htva', 'couverture_photo')
  ),
  constraint experiences_conclusion check (statut <> 'terminee' or conclusion is not null)
);

create index experiences_statut_idx on public.experiences (statut, test_debut desc);

create trigger experiences_touch before update on public.experiences
  for each row execute function public.touch_updated_at();

/**
 * Mesure d'une experience.
 *
 * Renvoie les deux echantillons avec leurs medianes. Le VERDICT n'est pas
 * calcule ici : il depend d'un seuil metier qui vit dans le code applicatif,
 * ou il est testable. La base fournit les faits, pas l'interpretation.
 */
create or replace function public.mesurer_experience(p_experience_id uuid)
returns table (
  periode      text,
  n            integer,
  mediane      numeric,
  q1           numeric,
  q3           numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  e record;
begin
  select * into e from public.experiences where id = p_experience_id;
  if not found then return; end if;

  return query
  with perimetre as (
    select
      m.*,
      case
        when m.realise_le::date >= e.reference_debut and m.realise_le::date < e.reference_fin
          then 'reference'
        when m.realise_le::date >= e.test_debut
             and (e.test_fin is null or m.realise_le::date <= e.test_fin)
          then 'test'
      end as bucket,
      case e.indicateur
        when 'ca_horaire'       then m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
        when 'minutes_par_m2'   then m.minutes_par_m2
        when 'facture_htva'     then m.facture_htva
        when 'couverture_photo' then m.couverture_photo
      end as valeur
    from public.job_metrics m
    where m.complet
      and m.realise_le is not null
      and not m.checklist_suspecte
      and (e.service       is null or m.service = e.service)
      and (e.property_type is null or m.property_type = e.property_type)
      and (e.bande         is null or public.bande_surface(m.surface_m2) = e.bande)
      and (e.soil          is null or m.soil = e.soil)
      and (e.commune       is null or m.commune = e.commune)
  )
  select
    p.bucket::text,
    count(*)::integer,
    percentile_cont(0.5)  within group (order by p.valeur)::numeric(10,2),
    percentile_cont(0.25) within group (order by p.valeur)::numeric(10,2),
    percentile_cont(0.75) within group (order by p.valeur)::numeric(10,2)
  from perimetre p
  where p.bucket is not null and p.valeur is not null
  group by p.bucket;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saisonnalite
--
-- Par mois calendaire, tous millesimes confondus : ce qui compte est de
-- savoir si mars est structurellement plus charge que novembre, pas de
-- comparer mars 2026 a mars 2027.
-- ---------------------------------------------------------------------------
create or replace view public.saisonnalite
with (security_invoker = true) as
select
  extract(month from m.realise_le)::smallint                                 as mois,
  count(*)::integer                                                          as chantiers,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2) as panier,
  percentile_cont(0.5) within group (
    order by m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
  )::numeric(10,2)                                                           as ca_horaire,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
where m.complet and m.realise_le is not null
group by extract(month from m.realise_le)
order by mois;

/**
 * Volume annuel par segment.
 *
 * Sert a estimer le gain d'une recommandation : un ajustement tarifaire ne
 * vaut que multiplie par le nombre de chantiers concernes SUR UNE ANNEE.
 * Extrapoler un volume annuel depuis trois mois d'activite est deja
 * hasardeux — la vue renvoie donc aussi la profondeur d'historique, pour que
 * l'appelant sache ce que vaut son extrapolation.
 */
create or replace view public.volume_par_segment
with (security_invoker = true) as
select
  m.service,
  m.property_type,
  public.bande_surface(m.surface_m2)                    as bande,
  m.soil,
  count(*)::integer                                      as chantiers,
  min(m.realise_le)::date                                as premier,
  max(m.realise_le)::date                                as dernier,
  greatest(1, (max(m.realise_le)::date - min(m.realise_le)::date))::integer as jours_couverts,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2) as panier_median,
  percentile_cont(0.5) within group (
    order by m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
  )::numeric(10,2)                                       as ca_horaire
from public.job_metrics m
where m.complet and m.realise_le is not null
group by m.service, m.property_type, public.bande_surface(m.surface_m2), m.soil;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.recommandations enable row level security;
alter table public.experiences     enable row level security;

create policy recommandations_staff on public.recommandations
  for select using (public.is_staff());

-- Accepter ou rejeter une recommandation engage la tarification : reserve a
-- la direction.
create policy recommandations_admin on public.recommandations
  for all using (public.is_admin()) with check (public.is_admin());

create policy experiences_staff on public.experiences
  for select using (public.is_staff());

create policy experiences_admin on public.experiences
  for all using (public.is_admin()) with check (public.is_admin());
