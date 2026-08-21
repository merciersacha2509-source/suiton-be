-- ===========================================================================
-- SUITON OS — Jeu de demonstration
-- ===========================================================================
-- Ce fichier peuple la base avec un parcours complet, de la demande entrante
-- au chantier livre et publie. Il sert a montrer le produit et a le tester
-- sans qu'aucune donnee reelle soit en jeu.
--
-- REGLE ABSOLUE : aucune ligne de ce fichier ne doit pouvoir etre confondue
-- avec un vrai client. Trois marqueurs, redondants a dessein :
--
--   1. tout nom commence par « DÉMO — »
--   2. toute adresse de courriel est en @demo.suiton.invalid
--      Le TLD .invalid est reserve par la RFC 2606 : il ne se resout jamais.
--      Meme si un envoi partait par erreur, il ne pourrait atteindre personne.
--   3. tout numero est en 0400 00 00 xx, plage non attribuee en Belgique
--
-- Un seul de ces marqueurs suffirait a distinguer les donnees ; les trois
-- ensemble rendent l'erreur pratiquement impossible, y compris a l'oeil nu
-- dans une liste.
--
-- Le script est IDEMPOTENT : il supprime d'abord tout ce qu'il a cree, en se
-- fondant sur ces marqueurs. Il ne touche a rien d'autre.
-- ===========================================================================

-- --- Nettoyage : uniquement ce que ce script a cree -----------------------
--
-- L'ordre compte. `jobs.client_id` est en ON DELETE RESTRICT : on ne supprime
-- pas un client qui a des chantiers, et c'est voulu — un dossier client ne
-- doit pas disparaitre par ricochet. Les chantiers partent donc d'abord, et
-- leurs devis, interventions, rapports et photos suivent en cascade. Les
-- FACTURES, elles, sont aussi en RESTRICT — une piece comptable ne doit pas
-- disparaitre parce qu'on efface un chantier. Elles partent donc en premier.
delete from public.invoices
where job_id in (select j.id from public.jobs j join public.clients c on c.id = j.client_id
                 where c.email like '%@demo.suiton.invalid');

delete from public.jobs
where client_id in (select id from public.clients where email like '%@demo.suiton.invalid');

delete from public.clients where email like '%@demo.suiton.invalid';
delete from public.partners where denomination like 'DÉMO —%';
delete from public.teams   where nom like 'DÉMO —%';

-- --- Equipe ---------------------------------------------------------------
insert into public.teams (nom, couleur, actif)
values ('DÉMO — Équipe 1', '#14415F', true);

-- --- Partenaire professionnel --------------------------------------------
insert into public.partners (denomination, tva, commune, code_postal, remise_pct, actif)
values ('DÉMO — Constructions Vandenberghe SRL', 'BE0999999999', 'Hal', '1500', 8, true);

-- ===========================================================================
-- 1. Demande fraiche — arrivee ce matin, pas encore traitee
-- ===========================================================================
with c as (
  insert into public.clients (nom, email, telephone, kind, commune, code_postal, adresse, score)
  values ('DÉMO — Marie Dupont', 'marie@demo.suiton.invalid', '0400 00 00 01',
          'particulier', 'Enghien', '7850', 'Rue de la Démonstration 1', 62)
  returning id
)
insert into public.jobs (
  client_id, service, property_type, soil, surface_m2, commune, code_postal, adresse,
  zone, urgent, date_souhaitee, estimation_min, estimation_max, duree_estimee_min,
  stage, source, notes
)
select c.id, 'fin_de_chantier', 'maison', 'standard', 140, 'Enghien', '7850',
       'Rue de la Démonstration 1', 'principale', false, current_date + 12,
       980, 1120, 390, 'nouveau', 'site',
       'DÉMO — Fin de chantier après plafonnage. Réception provisoire prévue.'
from c;

-- ===========================================================================
-- 2. Devis envoye — en attente de reponse
-- ===========================================================================
with c as (
  insert into public.clients (nom, email, telephone, kind, commune, code_postal, adresse, score)
  values ('DÉMO — Ahmed Benali', 'ahmed@demo.suiton.invalid', '0400 00 00 02',
          'particulier', 'Nivelles', '1400', 'Chaussée de Démo 42', 78)
  returning id
), j as (
  insert into public.jobs (
    client_id, service, property_type, soil, surface_m2, commune, code_postal, adresse,
    zone, urgent, date_souhaitee, estimation_min, estimation_max, duree_estimee_min,
    stage, source, notes
  )
  select c.id, 'apres_renovation', 'appartement', 'lourd', 95, 'Nivelles', '1400',
         'Chaussée de Démo 42', 'secondaire', true, current_date + 5,
         880, 1165, 300, 'devis_envoye', 'site',
         'DÉMO — Rénovation lourde, ponçage de parquet. Urgent : remise des clés.'
  from c returning id
)
insert into public.quotes (
  job_id, status, vat_regime, montant_htva, tva_montant, montant_ttc,
  valide_jusqu_au, lignes, sent_at
)
select j.id, 'envoye', 'standard_21', 1020, 214.20, 1234.20,
       current_date + 30,
       jsonb_build_array(
         jsonb_build_object('libelle', 'Nettoyage après rénovation — appartement 95 m²',
                            'quantite', 1, 'unite', 'forfait', 'prix_unitaire', 940, 'total', 940),
         jsonb_build_object('libelle', 'Majoration intervention sous 48 h',
                            'quantite', 1, 'unite', 'forfait', 'prix_unitaire', 55, 'total', 55),
         jsonb_build_object('libelle', 'Déplacement zone secondaire',
                            'quantite', 1, 'unite', 'forfait', 'prix_unitaire', 25, 'total', 25)
       ),
       now() - interval '2 days'
from j;

-- ===========================================================================
-- 3. Chantier planifie — intervention la semaine prochaine
-- ===========================================================================
with c as (
  insert into public.clients (nom, email, telephone, kind, commune, code_postal, adresse, score)
  values ('DÉMO — Sophie Lambert', 'sophie@demo.suiton.invalid', '0400 00 00 03',
          'particulier', 'Waterloo', '1410', 'Avenue de Démo 7', 91)
  returning id
), j as (
  insert into public.jobs (
    client_id, service, property_type, soil, surface_m2, commune, code_postal, adresse,
    zone, urgent, estimation_min, estimation_max, duree_estimee_min, stage, source, notes
  )
  select c.id, 'fin_de_chantier', 'villa', 'standard', 260, 'Waterloo', '1410',
         'Avenue de Démo 7', 'secondaire', false, 1845, 2105, 730, 'planifie', 'site',
         'DÉMO — Villa neuve, grandes surfaces vitrées, deux niveaux.'
  from c returning id
)
insert into public.interventions (job_id, team_id, starts_at, ends_at, status)
select j.id, (select id from public.teams where nom = 'DÉMO — Équipe 1'),
       (current_date + 7 + time '08:00') at time zone 'Europe/Brussels',
       (current_date + 7 + time '20:15') at time zone 'Europe/Brussels',
       'confirme'
from j;

-- ===========================================================================
-- 4. Chantier livre, facture et PUBLIE — le parcours complet
-- ===========================================================================
-- Ecrit en instructions successives plutot qu'en une seule chaine de CTE.
-- Raison technique : les CTE d'une meme instruction voient l'etat de la base
-- AVANT l'instruction. Une CTE ne peut donc pas lire les lignes qu'une CTE
-- soeur vient d'inserer — le rapport ne pouvait pas relire la checklist qu'on
-- venait de cocher. Des instructions separees se lisent aussi mieux.
-- ---------------------------------------------------------------------------

create temporary table demo_ids (cle text primary key, id uuid) on commit drop;

insert into public.clients (
  nom, email, telephone, kind, tva, commune, code_postal, adresse, score,
  consent_photos, consent_photos_at
)
values ('DÉMO — Entreprise Vandenberghe', 'chantiers@demo.suiton.invalid', '0400 00 00 04',
        'professionnel', 'BE0999999999', 'Hal', '1500', 'Zoning de Démo 15', 118,
        true, now() - interval '40 days');

insert into demo_ids
select 'client', id from public.clients where email = 'chantiers@demo.suiton.invalid';

insert into public.jobs (
  client_id, service, property_type, soil, surface_m2, commune, code_postal, adresse,
  zone, urgent, estimation_min, estimation_max, duree_estimee_min, duree_reelle_min,
  stage, source, notes, published, published_slug, published_at, resume_public
)
select id, 'fin_de_chantier', 'appartement', 'lourd', 88, 'Hal', '1500',
       'Zoning de Démo 15', 'principale', false, 880, 1230, 300, 315, 'termine', 'partenaire',
       'DÉMO — Lot 3 d''un immeuble de six appartements.',
       true, 'demo-appartement-88m2-hal', now() - interval '10 days',
       'DÉMO — Appartement de 88 m² à Hal, livré après un chantier lourd. Poussière de ' ||
       'découpe dans toutes les rainures de châssis, résidus de colle sur le carrelage du ' ||
       'séjour, film plastique encore collé sur quatre vitrages. Cinq heures quinze ' ||
       'd''intervention, vitres et châssis compris. Réception sans réserve le lendemain.'
from demo_ids where cle = 'client';

insert into demo_ids
select 'job', id from public.jobs where published_slug = 'demo-appartement-88m2-hal';

insert into public.quotes (
  job_id, status, vat_regime, montant_htva, tva_montant, montant_ttc,
  valide_jusqu_au, lignes, sent_at, accepted_at
)
select id, 'accepte', 'autoliquidation', 1050, 0, 1050, current_date + 5,
       jsonb_build_array(
         jsonb_build_object('libelle', 'Nettoyage de fin de chantier — appartement 88 m²',
                            'quantite', 1, 'unite', 'forfait',
                            'prix_unitaire', 1050, 'total', 1050)
       ),
       now() - interval '25 days', now() - interval '23 days'
from demo_ids where cle = 'job';

insert into public.interventions (job_id, team_id, starts_at, ends_at, status)
select d.id, (select id from public.teams where nom = 'DÉMO — Équipe 1'),
       (current_date - 12 + time '08:00') at time zone 'Europe/Brussels',
       (current_date - 12 + time '13:15') at time zone 'Europe/Brussels',
       'termine'
from demo_ids d where d.cle = 'job';

insert into demo_ids
select 'intervention', i.id from public.interventions i
join demo_ids d on d.cle = 'job' and d.id = i.job_id;

-- La base refuse un rapport dont la checklist n'est pas complete. Le seed
-- suit donc le meme chemin que le terrain : les six etapes sont cochees.
insert into public.checklist_progress (intervention_id, ordre, fait_at, note)
select d.id, e.ordre,
       (current_date - 12 + time '08:00') at time zone 'Europe/Brussels'
         + (e.ordre * interval '48 minutes'),
       case when e.ordre = 4
            then 'DÉMO — Deux traces de silicone signalées, traitées.' end
from demo_ids d cross join public.checklist_steps e
where d.cle = 'intervention';

insert into public.reports (
  job_id, intervention_id, checklist, observations, duree_reelle_min,
  garantie_jusqu_au, validated_at
)
select
  (select id from demo_ids where cle = 'job'),
  (select id from demo_ids where cle = 'intervention'),
  -- Le rapport FIGE la checklist telle qu'elle a ete cochee : c'est ce
  -- document, et non la table de suivi, qui est remis au client.
  (select jsonb_agg(
            jsonb_build_object(
              'ordre', e.ordre,
              'libelle', e.libelle,
              'fait_a', to_char(cp.fait_at at time zone 'Europe/Brussels', 'HH24:MI'),
              'note', cp.note
            ) order by e.ordre)
   from public.checklist_progress cp
   join public.checklist_steps e on e.ordre = cp.ordre
   where cp.intervention_id = (select id from demo_ids where cle = 'intervention')),
  'DÉMO — Ensemble conforme. Deux traces de silicone signalées sur le vitrage de la ' ||
  'salle de bain, traitées le jour même. Aucune réserve.',
  315, (current_date - 10)::date, now() - interval '12 days';

-- Facture B2B rattachee au partenaire : c'est ce qui declenche la contrainte
-- `b2b_peppol`. Depuis le 1er janvier 2026, une facture entre assujettis
-- belges doit porter un identifiant Peppol, sans quoi le client ne peut pas
-- deduire sa TVA. La base refuse d'emettre sans lui — le seed doit donc
-- montrer une facture conforme, pas une facture qui contourne la regle.
insert into public.invoices (
  job_id, client_id, partner_id, quote_id, kind, status, vat_regime,
  montant_htva, tva_montant, montant_ttc, peppol_id, date_emission, date_echeance
)
select
  (select id from demo_ids where cle = 'job'),
  (select id from demo_ids where cle = 'client'),
  (select id from public.partners where denomination = 'DÉMO — Constructions Vandenberghe SRL'),
  (select id from public.quotes
    where job_id = (select id from demo_ids where cle = 'job')),
  'facture', 'emise', 'autoliquidation', 1050, 0, 1050,
  '9925:BE0999999999',
  (current_date - 11)::date, (current_date + 18)::date;

-- ===========================================================================
-- 5. Chantier perdu — le pipeline doit aussi montrer ce qui ne passe pas
-- ===========================================================================
with c as (
  insert into public.clients (nom, email, telephone, kind, commune, code_postal, score)
  values ('DÉMO — Luc Peeters', 'luc@demo.suiton.invalid', '0400 00 00 05',
          'particulier', 'Tubize', '1480', 34)
  returning id
)
insert into public.jobs (
  client_id, service, property_type, soil, surface_m2, commune, code_postal,
  zone, estimation_min, estimation_max, stage, source, perdu_motif
)
select c.id, 'vitres', 'studio', 'leger', 45, 'Tubize', '1480',
       'secondaire', 160, 205, 'perdu', 'site',
       'DÉMO — A choisi un prestataire moins cher.'
from c;
