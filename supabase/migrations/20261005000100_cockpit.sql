-- ===========================================================================
-- SUITON OS 1.0 — Sprint 6 — Vues du cockpit
-- ===========================================================================
-- Toute la logique d'agregation vit ici. Le front n'additionne rien, ne
-- moyenne rien, ne classe rien : il affiche. C'est la seule facon de garantir
-- qu'un chiffre du tableau de bord et le meme chiffre dans un PDF racontent
-- la meme chose.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Bloc 1 — Performance globale, avec evolution
--
-- L'evolution compare les 90 derniers jours aux 90 precedents. Comparer au
-- mois precedent n'a aucun sens a ce volume : un mois a trois chantiers
-- produit des variations de 200 % qui ne signifient rien.
-- ---------------------------------------------------------------------------
create or replace view public.perf_globale
with (security_invoker = true) as
with periodes as (
  select
    m.*,
    case
      when m.realise_le >= now() - interval '90 days'  then 'courante'
      when m.realise_le >= now() - interval '180 days' then 'precedente'
    end as periode
  from public.job_metrics m
  where m.complet and m.realise_le is not null
),
agg as (
  select
    periode,
    count(*)::integer                                                            as n,
    percentile_cont(0.5) within group (order by minutes_par_m2)::numeric(6,2)    as cadence,
    percentile_cont(0.5) within group (
      order by facture_htva / nullif(duree_reelle_min, 0) * 60
    )::numeric(10,2)                                                             as ca_horaire,
    round(avg(couverture_photo), 1)                                              as couverture,
    round(avg(avis_note), 2)                                                     as note,
    round(avg(delai_signature_h), 1)                                             as delai_signature_h,
    round(avg(delai_paiement_j), 1)                                              as delai_paiement_j,
    round(
      count(*) filter (
        where duree_reelle_min between duree_estimee_min and duree_estimee_max
      )::numeric * 100 / nullif(count(*), 0), 1
    )                                                                            as precision_pct,
    round(count(*) filter (where retouches > 0)::numeric * 100 / nullif(count(*), 0), 1) as taux_retouche
  from periodes
  where periode is not null
  group by periode
)
select
  coalesce((select n from agg where periode = 'courante'), 0)          as n,
  coalesce((select n from agg where periode = 'precedente'), 0)        as n_precedent,
  (select cadence from agg where periode = 'courante')                 as cadence,
  (select cadence from agg where periode = 'precedente')               as cadence_precedente,
  (select ca_horaire from agg where periode = 'courante')              as ca_horaire,
  (select ca_horaire from agg where periode = 'precedente')            as ca_horaire_precedent,
  (select precision_pct from agg where periode = 'courante')           as precision_pct,
  (select precision_pct from agg where periode = 'precedente')         as precision_precedente,
  (select taux_retouche from agg where periode = 'courante')           as taux_retouche,
  (select taux_retouche from agg where periode = 'precedente')         as taux_retouche_precedent,
  (select couverture from agg where periode = 'courante')              as couverture,
  (select couverture from agg where periode = 'precedente')            as couverture_precedente,
  (select note from agg where periode = 'courante')                    as note,
  (select note from agg where periode = 'precedente')                  as note_precedente,
  (select delai_signature_h from agg where periode = 'courante')       as delai_signature_h,
  (select delai_signature_h from agg where periode = 'precedente')     as delai_signature_precedent,
  (select delai_paiement_j from agg where periode = 'courante')        as delai_paiement_j,
  (select delai_paiement_j from agg where periode = 'precedente')      as delai_paiement_precedent;

-- ---------------------------------------------------------------------------
-- Bloc 2 — Matiere premiere des alertes
--
-- Ecart entre ce qui est facture et ce que la grille prevoyait, par gabarit.
-- C'est cette vue qui permet de dire « les maisons de 140 a 180 m² sont
-- sous-facturees de 18 % » — un constat qu'on ne fait jamais de tete.
-- ---------------------------------------------------------------------------
create or replace view public.ecart_tarifaire
with (security_invoker = true) as
select
  m.property_type,
  public.bande_surface(m.surface_m2)                                        as bande,
  m.soil,
  m.service,
  count(*)::integer                                                         as n,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2) as facture_mediane,
  percentile_cont(0.5) within group (order by m.devis_htva)::numeric(10,2)   as devis_median,
  round(avg(m.ecart_facturation), 2)                                         as ecart_moyen,
  percentile_cont(0.5) within group (
    order by m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
  )::numeric(10,2)                                                           as ca_horaire,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
where m.complet and m.facture_htva is not null
group by m.property_type, public.bande_surface(m.surface_m2), m.soil, m.service;

/** Rendement selon le nombre de techniciens. Alimente l'alerte de sureffectif. */
create or replace view public.rendement_par_effectif
with (security_invoker = true) as
select
  m.techniciens,
  case when m.surface_m2 < 150 then 'petite' else 'grande' end               as taille,
  count(*)::integer                                                          as n,
  percentile_cont(0.5) within group (order by m.minutes_par_m2)::numeric(6,2) as cadence,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
where m.complet and m.minutes_par_m2 is not null and not m.checklist_suspecte
group by m.techniciens, case when m.surface_m2 < 150 then 'petite' else 'grande' end;

/** Concentration des retouches par service. */
create or replace view public.retouches_par_service
with (security_invoker = true) as
select
  m.service,
  count(*)::integer                                    as chantiers,
  sum(m.retouches)::integer                            as retouches,
  round(
    sum(m.retouches)::numeric * 100
    / nullif(sum(sum(m.retouches)) over (), 0), 1
  )                                                    as part_pct,
  public.confiance(count(*)::integer)                  as confiance
from public.job_metrics m
where m.complet
group by m.service;

-- ---------------------------------------------------------------------------
-- Bloc 4 — Matrice de rentabilite
--
-- Le CA horaire est le seul indicateur qui compare honnetement un petit
-- chantier rapide a un gros chantier lent : le chiffre d'affaires brut
-- favorise mecaniquement les grandes surfaces, meme peu rentables.
-- ---------------------------------------------------------------------------
create or replace view public.rentabilite_matrice
with (security_invoker = true) as
select
  m.service,
  public.bande_surface(m.surface_m2)                                        as bande,
  count(*)::integer                                                         as n,
  percentile_cont(0.5) within group (
    order by m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
  )::numeric(10,2)                                                          as ca_horaire,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2) as panier,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
where m.complet and m.facture_htva is not null and m.duree_reelle_min is not null
group by m.service, public.bande_surface(m.surface_m2);

-- ---------------------------------------------------------------------------
-- Bloc 5 — Table des references par gabarit
-- ---------------------------------------------------------------------------
create or replace view public.references_gabarits
with (security_invoker = true) as
select
  c.property_type,
  c.bande,
  c.soil,
  c.minutes_par_m2                       as catalogue_min_m2,
  o.n                                    as n,
  o.mediane_min_m2,
  o.q1_min_m2,
  o.q3_min_m2,
  o.mediane_htva,
  o.mediane_duree,
  coalesce(o.confiance, 'aucune'::niveau_confiance) as confiance,
  case when coalesce(o.n, 0) >= 5 then 'observee' else 'catalogue' end       as origine,
  case when coalesce(o.n, 0) >= 5 then o.mediane_min_m2 else c.minutes_par_m2 end as effective_min_m2
from public.reference_catalogue c
left join public.reference_observee o
  on o.property_type = c.property_type and o.bande = c.bande and o.soil = c.soil;

-- ---------------------------------------------------------------------------
-- Bloc 7 — Opportunites de prospection
--
-- On ne classe pas sur le seul chiffre d'affaires : une commune rentable est
-- une commune ou l'on gagne bien sa journee ET ou l'on revient. Le taux de
-- recurrence pese autant que le CA horaire.
-- ---------------------------------------------------------------------------
create or replace view public.opportunites_communes
with (security_invoker = true) as
with demandes as (
  select j.commune, count(*)::integer as total,
         count(*) filter (where j.stage in ('gagne','planifie','termine'))::integer as gagnes
  from public.jobs j
  group by j.commune
)
select
  m.commune,
  m.zone,
  count(*)::integer                                                          as chantiers,
  percentile_cont(0.5) within group (
    order by m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
  )::numeric(10,2)                                                           as ca_horaire,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2) as panier,
  count(*) filter (where m.chantier_rang > 1)::integer                       as recurrents,
  round(
    count(*) filter (where m.chantier_rang > 1)::numeric * 100 / nullif(count(*), 0), 1
  )                                                                          as recurrence_pct,
  coalesce(d.total, 0)                                                       as demandes,
  round(coalesce(d.gagnes, 0)::numeric * 100 / nullif(d.total, 0), 1)        as conversion_pct,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
left join demandes d on d.commune = m.commune
where m.complet
group by m.commune, m.zone, d.total, d.gagnes;

-- ---------------------------------------------------------------------------
-- Bloc 9 — Evolution dans le temps
--
-- Par trimestre et non par mois : a trois chantiers par mois, une courbe
-- mensuelle ne montre que du bruit.
-- ---------------------------------------------------------------------------
create or replace view public.evolution_trimestrielle
with (security_invoker = true) as
select
  date_trunc('quarter', m.realise_le)::date                                  as trimestre,
  count(*)::integer                                                          as chantiers,
  percentile_cont(0.5) within group (order by m.minutes_par_m2)::numeric(6,2) as cadence,
  percentile_cont(0.5) within group (
    order by m.facture_htva / nullif(m.duree_reelle_min, 0) * 60
  )::numeric(10,2)                                                           as ca_horaire,
  percentile_cont(0.5) within group (order by m.facture_htva)::numeric(10,2) as panier,
  round(avg(m.couverture_photo), 1)                                          as couverture,
  public.confiance(count(*)::integer)                                        as confiance
from public.job_metrics m
where m.complet and m.realise_le is not null
group by date_trunc('quarter', m.realise_le)
order by trimestre;

-- ---------------------------------------------------------------------------
-- Chantiers comparables — « voir les chantiers derriere ce chiffre »
-- ---------------------------------------------------------------------------
create or replace function public.chantiers_comparables(
  p_property_type property_type,
  p_surface       integer,
  p_soil          soil_level,
  p_limite        integer default 20
)
returns table (
  job_id           uuid,
  reference        text,
  commune          text,
  surface_m2       integer,
  duree_reelle_min integer,
  minutes_par_m2   numeric,
  facture_htva     numeric,
  realise_le       timestamptz,
  suspecte         boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.job_id, m.reference, m.commune, m.surface_m2, m.duree_reelle_min,
         m.minutes_par_m2, m.facture_htva, m.realise_le, m.checklist_suspecte
  from public.job_metrics m
  where m.complet
    and m.property_type = p_property_type
    and m.soil = p_soil
    and public.bande_surface(m.surface_m2) = public.bande_surface(p_surface)
  order by m.realise_le desc
  limit p_limite
$$;
