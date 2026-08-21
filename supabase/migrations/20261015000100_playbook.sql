-- ===========================================================================
-- SUITON OS 1.0 — Sprint 8 — SUITON Playbook
-- ===========================================================================
-- Fermeture de la boucle :
--
--   observation → recommandation → décision → expérience → mesure → référence
--
-- Le maillon manquant etait l'EXECUTION. Une recommandation acceptee qui ne
-- devient pas une experience mesuree n'apprend rien : c'est une intention.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Modeles de playbook
--
-- Un playbook est une trame d'experience. Il ne contient pas les valeurs
-- (quel segment, quelle hausse) mais la METHODE : quel indicateur observer,
-- combien de temps, ce qui doit etre vrai pour conclure.
-- ---------------------------------------------------------------------------
create table public.playbook_modeles (
  code            text primary key,
  titre           text not null,
  famille         recommandation_famille not null,
  description     text not null,

  indicateur      text not null,
  duree_jours     smallint not null,
  -- Ecart minimal a observer pour que le test soit concluant, en %.
  seuil_effet_pct numeric(5,2) not null default 10,
  -- Nombre de chantiers minimal de chaque cote.
  seuil_n         smallint not null default 5,

  -- Ce qu'il faut preparer AVANT de lancer. Une experience mal preparee
  -- produit une mesure ininterpretable.
  prerequis       text[] not null default '{}',
  -- Ce qu'il faut surveiller pendant, au-dela de l'indicateur principal.
  vigilance       text[] not null default '{}',

  actif           boolean not null default true,
  created_at      timestamptz not null default now(),

  constraint playbook_indicateur check (
    indicateur in ('ca_horaire', 'minutes_par_m2', 'facture_htva', 'couverture_photo')
  ),
  constraint playbook_duree check (duree_jours between 30 and 365),
  constraint playbook_seuil check (seuil_effet_pct between 1 and 100)
);

insert into public.playbook_modeles
  (code, titre, famille, description, indicateur, duree_jours, seuil_effet_pct, prerequis, vigilance)
values
  (
    'hausse_tarifaire',
    'Hausse tarifaire ciblée',
    'tarification',
    'Augmenter le prix sur un gabarit précis et vérifier que le volume tient.',
    'ca_horaire', 60, 10,
    array[
      'Figer le périmètre : un seul gabarit, une seule commune si possible.',
      'Noter le taux d''acceptation des devis AVANT de commencer — sans lui, on ne saura pas si la hausse a fait fuir.',
      'Prévenir l''équipe : un devis refusé pendant le test est une donnée, pas un échec.'
    ],
    array[
      'Le taux d''acceptation des devis. Un CA horaire en hausse avec moitié moins de chantiers est une perte.',
      'La composition des chantiers : si le test attire des chantiers plus faciles, la mesure est faussée.'
    ]
  ),
  (
    'nouvelle_equipe',
    'Nouvelle équipe ou nouvel intervenant',
    'planning',
    'Mesurer la montée en compétence d''un nouvel arrivant sans le juger trop tôt.',
    'minutes_par_m2', 90, 15,
    array[
      'Exclure les cinq premiers chantiers : personne n''est à son rythme la première semaine.',
      'Affecter des chantiers comparables à ceux de la période de référence.'
    ],
    array[
      'La couverture photo : un rythme rapide obtenu en sautant des étapes n''est pas un gain.',
      'Le taux de retouche, qui met plusieurs semaines à se manifester.'
    ]
  ),
  (
    'nouveau_materiel',
    'Nouveau matériel',
    'productivite',
    'Vérifier qu''un investissement matériel se traduit en temps gagné.',
    'minutes_par_m2', 60, 10,
    array[
      'Chiffrer le coût du matériel : le gain de temps doit le couvrir.',
      'Former avant de mesurer — un outil mal maîtrisé fait perdre du temps.'
    ],
    array['La qualité du résultat, qui ne doit pas baisser avec la vitesse.']
  ),
  (
    'nouvelle_procedure',
    'Nouvelle procédure',
    'qualite',
    'Tester un changement d''ordre ou de méthode dans la checklist.',
    'couverture_photo', 90, 15,
    array[
      'Écrire la nouvelle procédure noir sur blanc avant de commencer.',
      'S''assurer que toute l''équipe l''applique — un test à moitié appliqué ne mesure rien.'
    ],
    array['La durée totale, qui ne doit pas exploser au nom de la qualité.']
  ),
  (
    'nouvelle_zone',
    'Nouvelle zone géographique',
    'prospection',
    'Évaluer si une commune mérite d''entrer dans la zone principale.',
    'ca_horaire', 120, 12,
    array[
      'Mesurer le temps de trajet réel, aller et retour.',
      'Vérifier que le forfait de déplacement le couvre.'
    ],
    array[
      'Le temps de trajet ne figure pas dans la durée du chantier : un CA horaire flatteur peut masquer deux heures de route.'
    ]
  )
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Expériences : exécution et décision finale
-- ---------------------------------------------------------------------------
create type decision_finale as enum ('generaliser', 'prolonger', 'arreter', 'en_attente');

alter table public.experiences
  add column if not exists modele_code   text references public.playbook_modeles (code) on delete set null,
  add column if not exists recommandation_code text,
  -- Ce qui est effectivement change pendant le test : « +8 % », « équipe 2 ».
  add column if not exists intervention  text,
  add column if not exists seuil_effet_pct numeric(5,2) not null default 10,
  add column if not exists seuil_n       smallint not null default 5,
  add column if not exists decision      decision_finale not null default 'en_attente',
  add column if not exists decide_le     timestamptz,
  -- Valeur annuelle attribuee a cette experience, saisie a la generalisation.
  add column if not exists valeur_annuelle numeric(10,2);

alter table public.experiences
  add constraint experiences_decision_datee check (
    decision = 'en_attente' or decide_le is not null
  );

-- ---------------------------------------------------------------------------
-- Report d'une recommandation
--
-- Le statut « reportee » est ajoute par la migration precedente : PostgreSQL
-- interdit d'utiliser une valeur d'enum dans la transaction qui l'ajoute.
-- ---------------------------------------------------------------------------
alter table public.recommandations
  add column if not exists reportee_au date,
  add column if not exists experience_id uuid references public.experiences (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Valeur créée
--
-- ATTENTION — c'est ici qu'un logiciel est le plus tenté de mentir.
--
-- On ne compte QUE les expériences terminées, généralisées, dont le résultat
-- était positif. Une recommandation acceptée sans test ne compte pas : rien
-- ne prouve qu'elle a produit quoi que ce soit.
--
-- Et même ainsi, l'attribution reste incertaine : le marché a pu bouger, la
-- saison a pu jouer. La vue expose donc le nombre d'expériences derrière le
-- chiffre, pour que l'interface puisse le relativiser.
-- ---------------------------------------------------------------------------
create or replace view public.valeur_creee
with (security_invoker = true) as
select
  date_trunc('year', e.decide_le)::date                              as annee,
  count(*) filter (where e.decision = 'generaliser')::integer        as generalisees,
  count(*) filter (where e.decision = 'arreter')::integer            as arretees,
  count(*) filter (where e.decision = 'prolonger')::integer          as prolongees,
  -- Seules les generalisations portent une valeur.
  coalesce(sum(e.valeur_annuelle) filter (where e.decision = 'generaliser'), 0)::numeric(10,2)
                                                                     as valeur_annuelle,
  count(*)::integer                                                  as experiences_tranchees
from public.experiences e
where e.statut = 'terminee' and e.decide_le is not null
group by date_trunc('year', e.decide_le);

/** Décisions prises sur les recommandations, par année. */
create or replace view public.decisions_par_annee
with (security_invoker = true) as
select
  date_trunc('year', r.decide_le)::date                       as annee,
  count(*) filter (where r.statut = 'acceptee')::integer      as acceptees,
  count(*) filter (where r.statut = 'rejetee')::integer       as rejetees,
  count(*) filter (where r.statut = 'reportee')::integer      as reportees,
  count(*) filter (where r.statut = 'experimentee')::integer  as experimentees,
  count(*)::integer                                           as total
from public.recommandations r
where r.decide_le is not null
group by date_trunc('year', r.decide_le);

/**
 * Mémoire d'entreprise.
 *
 * Une ligne lisible par expérience close. C'est ce qui permet de relire, dans
 * trois ans : « en mars 2027, nous avons testé +8 % sur les maisons 140–160 m²
 * à Nivelles. Résultat : +11 % de CA horaire, volume stable, généralisé. »
 */
create or replace view public.memoire_entreprise
with (security_invoker = true) as
select
  e.id,
  e.titre,
  e.hypothese,
  e.intervention,
  e.famille,
  e.indicateur,
  e.test_debut,
  e.test_fin,
  e.decision,
  e.decide_le,
  e.conclusion,
  e.valeur_annuelle,
  m.titre                                                     as modele,
  -- Perimetre en clair, pour la lecture.
  concat_ws(' · ',
    nullif(e.service::text, ''),
    nullif(e.property_type::text, ''),
    nullif(e.bande, ''),
    nullif(e.commune, '')
  )                                                           as perimetre
from public.experiences e
left join public.playbook_modeles m on m.code = e.modele_code
where e.statut in ('terminee', 'abandonnee')
order by e.decide_le desc nulls last, e.test_debut desc;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.playbook_modeles enable row level security;

create policy playbook_read on public.playbook_modeles
  for select using (auth.uid() is not null);

create policy playbook_admin on public.playbook_modeles
  for all using (public.is_admin()) with check (public.is_admin());
