-- ===========================================================================
-- SUITON OS 1.0 — Sprint 5 — References dynamiques
-- ===========================================================================
-- LE PROBLEME CENTRAL DE CE SPRINT
--
-- Avec zero chantier realise, il n'existe aucune moyenne. Avec trois, il
-- existe une moyenne qui ne vaut rien : un chantier atypique la deplace de
-- 40 %. Un systeme qui affiche « temps moyen : 4 h 12 » sur trois chantiers
-- ment par omission — et le danger d'un chiffre presente comme statistique
-- est qu'on finit par lui faire confiance.
--
-- La reponse tient en trois regles :
--   1. tout indicateur porte un NIVEAU DE CONFIANCE explicite ;
--   2. sous 5 chantiers comparables, on renvoie la valeur de CATALOGUE, pas
--      une moyenne ;
--   3. on utilise la MEDIANE, pas la moyenne : un chantier catastrophique ne
--      doit pas deplacer la reference de tous les autres.
-- ===========================================================================

create type niveau_confiance as enum ('aucune', 'faible', 'moyenne', 'bonne', 'elevee');

comment on type niveau_confiance is
  'aucune : < 3 chantiers, valeur catalogue. faible : 3-4. moyenne : 5-9. bonne : 10-24. elevee : 25+.';

/**
 * Niveau de confiance en fonction du nombre d'observations.
 *
 * Les seuils ne sont pas theoriques : en dessous de 5 chantiers comparables,
 * l'ecart-type est tel que la mediane n'apporte rien sur le catalogue. A 25,
 * elle devient plus fiable que n'importe quelle estimation a priori.
 */
create or replace function public.confiance(p_n integer)
returns niveau_confiance
language sql
immutable
as $$
  select case
    when p_n >= 25 then 'elevee'::niveau_confiance
    when p_n >= 10 then 'bonne'::niveau_confiance
    when p_n >=  5 then 'moyenne'::niveau_confiance
    when p_n >=  3 then 'faible'::niveau_confiance
    else                'aucune'::niveau_confiance
  end
$$;

-- ---------------------------------------------------------------------------
-- Catalogue de reference
--
-- Valeurs de depart, utilisees tant que l'historique ne suffit pas. Elles
-- viennent de la cadence annoncee dans la grille tarifaire, pas d'une
-- observation : c'est assume et signale par une confiance « aucune ».
-- ---------------------------------------------------------------------------
create table public.reference_catalogue (
  property_type property_type not null,
  bande         text          not null,
  soil          soil_level    not null,
  minutes_par_m2 numeric(6,2) not null,

  primary key (property_type, bande, soil),
  constraint catalogue_bande check (bande in ('xs','s','m','l','xl')),
  constraint catalogue_cadence check (minutes_par_m2 between 0.2 and 20)
);

-- Cadence de base par salissure, majoree sur les petites surfaces : le cout
-- fixe d'installation y pese proportionnellement plus lourd.
insert into public.reference_catalogue (property_type, bande, soil, minutes_par_m2)
select p.t, b.b, s.s,
       round(
         s.base * case b.b
           when 'xs' then 1.35
           when 's'  then 1.15
           when 'm'  then 1.00
           when 'l'  then 0.92
           else           0.85
         end, 2)
from (values
  ('studio'::property_type), ('appartement'), ('maison'), ('villa'),
  ('bureaux'), ('commerce'), ('autre')
) p(t)
cross join (values ('xs'),('s'),('m'),('l'),('xl')) b(b)
cross join (values ('leger'::soil_level, 1.7), ('standard', 2.4), ('lourd', 3.4)) s(s, base)
on conflict do nothing;

alter table public.reference_catalogue enable row level security;

-- Lisible par tout utilisateur authentifie : c'est un bareme, pas une donnee
-- sensible. Modifiable par l'administrateur seul — une cadence de reference
-- fausse decale toutes les estimations a venir.
create policy catalogue_read on public.reference_catalogue
  for select using (auth.uid() is not null);

create policy catalogue_admin on public.reference_catalogue
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reference observee
--
-- Mediane et quartiles des chantiers reellement realises, par gabarit.
-- `percentile_cont` sur la mediane plutot que `avg` : un chantier
-- catastrophique ne doit pas deplacer la reference de tous les autres.
-- ---------------------------------------------------------------------------
create or replace view public.reference_observee
with (security_invoker = true) as
select
  m.property_type,
  public.bande_surface(m.surface_m2) as bande,
  m.soil,
  count(*)::integer                                                          as n,
  percentile_cont(0.5) within group (order by m.minutes_par_m2)::numeric(6,2) as mediane_min_m2,
  percentile_cont(0.25) within group (order by m.minutes_par_m2)::numeric(6,2) as q1_min_m2,
  percentile_cont(0.75) within group (order by m.minutes_par_m2)::numeric(6,2) as q3_min_m2,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2)   as mediane_htva,
  percentile_cont(0.5) within group (order by m.duree_reelle_min)::integer     as mediane_duree,
  public.confiance(count(*)::integer)                                          as confiance
from public.job_metrics m
where m.complet
  and m.minutes_par_m2 is not null
  and not m.checklist_suspecte   -- une checklist cochee apres coup fausse les temps
group by m.property_type, public.bande_surface(m.surface_m2), m.soil;

/**
 * Reference effective : observee si elle est assez solide, catalogue sinon.
 *
 * C'est LA fonction qui protege le systeme du mensonge statistique. Elle
 * renvoie toujours une valeur exploitable ET toujours le niveau de confiance
 * qui l'accompagne — l'appelant ne peut pas afficher l'un sans l'autre.
 */
create or replace function public.reference_effective(
  p_property_type property_type,
  p_surface       integer,
  p_soil          soil_level
)
returns table (
  minutes_par_m2 numeric,
  q1             numeric,
  q3             numeric,
  n              integer,
  confiance      niveau_confiance,
  origine        text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bande as (select public.bande_surface(p_surface) as b),
  obs as (
    select r.* from public.reference_observee r, bande
    where r.property_type = p_property_type and r.bande = bande.b and r.soil = p_soil
  ),
  cat as (
    select c.minutes_par_m2 from public.reference_catalogue c, bande
    where c.property_type = p_property_type and c.bande = bande.b and c.soil = p_soil
  )
  select
    -- Sous 5 observations, le catalogue prime : une mediane sur trois
    -- chantiers n'est pas une reference, c'est une coincidence.
    case when coalesce((select n from obs), 0) >= 5
         then (select mediane_min_m2 from obs)
         else (select minutes_par_m2 from cat) end,
    (select q1_min_m2 from obs),
    (select q3_min_m2 from obs),
    coalesce((select n from obs), 0),
    public.confiance(coalesce((select n from obs), 0)),
    case when coalesce((select n from obs), 0) >= 5 then 'observee' else 'catalogue' end
$$;

-- ---------------------------------------------------------------------------
-- Vues d'agregation
-- ---------------------------------------------------------------------------

/** Rendement et marge par type de chantier. */
create or replace view public.stats_par_service
with (security_invoker = true) as
select
  m.service,
  count(*)::integer                                                            as chantiers,
  percentile_cont(0.5) within group (order by m.minutes_par_m2)::numeric(6,2)   as mediane_min_m2,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2)    as mediane_htva,
  -- Chiffre d'affaires horaire : le seul indicateur de rentabilite qui
  -- compare honnetement un petit chantier rapide a un gros chantier lent.
  round(avg(m.facture_htva / nullif(m.duree_reelle_min, 0) * 60), 2)            as ca_horaire,
  round(avg(m.couverture_photo), 1)                                            as couverture_photo,
  round(avg(m.avis_note), 2)                                                   as note_moyenne,
  public.confiance(count(*)::integer)                                          as confiance
from public.job_metrics m
where m.complet
group by m.service;

/** Rentabilite par commune. Sert a decider ou prospecter. */
create or replace view public.stats_par_commune
with (security_invoker = true) as
select
  m.commune,
  m.zone,
  count(*)::integer                                                         as chantiers,
  round(avg(m.facture_htva), 2)                                             as panier_moyen,
  round(avg(m.facture_htva / nullif(m.duree_reelle_min, 0) * 60), 2)        as ca_horaire,
  count(*) filter (where m.chantier_rang > 1)::integer                      as recurrents,
  public.confiance(count(*)::integer)                                       as confiance
from public.job_metrics m
where m.complet
group by m.commune, m.zone;

/** Efficacite par equipe. */
create or replace view public.stats_par_equipe
with (security_invoker = true) as
select
  m.team_id,
  t.nom as equipe,
  count(*)::integer                                                          as chantiers,
  percentile_cont(0.5) within group (order by m.minutes_par_m2)::numeric(6,2) as mediane_min_m2,
  round(avg(m.couverture_photo), 1)                                          as couverture_photo,
  count(*) filter (where m.checklist_complete)::integer                      as checklists_completes,
  count(*) filter (where m.checklist_suspecte)::integer                      as checklists_suspectes,
  round(avg(m.avis_note), 2)                                                 as note_moyenne,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
join public.teams t on t.id = m.team_id
where m.complet
group by m.team_id, t.nom;

/** Precision des estimations : l'indicateur qui dit si la grille est juste. */
create or replace view public.stats_estimation
with (security_invoker = true) as
select
  count(*)::integer                                                       as chantiers,
  count(*) filter (
    where m.duree_reelle_min between m.duree_estimee_min and m.duree_estimee_max
  )::integer                                                              as dans_la_fourchette,
  round(
    count(*) filter (
      where m.duree_reelle_min between m.duree_estimee_min and m.duree_estimee_max
    )::numeric * 100 / nullif(count(*), 0), 1
  )                                                                       as precision_pct,
  round(avg(m.duree_reelle_min - m.duree_estimee_max), 0)                  as ecart_moyen_min,
  round(avg(m.ecart_facturation), 2)                                       as ecart_facturation_moyen,
  public.confiance(count(*)::integer)                                      as confiance
from public.job_metrics m
where m.complet and m.duree_reelle_min is not null and m.duree_estimee_max is not null;

/** Temps median par etape de la procedure. */
create or replace view public.stats_par_etape
with (security_invoker = true) as
select
  e.ordre::smallint,
  s.libelle,
  count(*)::integer                                                    as observations,
  percentile_cont(0.5) within group (order by e.minutes)::integer       as mediane_min,
  percentile_cont(0.9) within group (order by e.minutes)::integer       as p90_min,
  public.confiance(count(*)::integer)                                  as confiance
from public.job_metrics m
cross join lateral jsonb_each_text(m.temps_par_etape) as j(cle, val)
cross join lateral (select j.cle::smallint as ordre, j.val::integer as minutes) e
left join public.checklist_steps s on s.ordre = e.ordre
where m.complet and e.minutes > 0
group by e.ordre, s.libelle
order by e.ordre;
