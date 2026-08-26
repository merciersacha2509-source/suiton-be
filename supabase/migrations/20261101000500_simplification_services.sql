-- Simplification produit : fusion de "apres_renovation" dans
-- "fin_de_chantier" (une seule prestation "fin de travaux" cote site) et
-- retrait du niveau de salissure "leger" (Standard / Lourd uniquement).
--
-- Postgres ne sait pas retirer une valeur d'un type enum sans recreer le
-- type et toutes les colonnes qui en dependent (service_type est utilise
-- par 4 tables et 2 fonctions, soil_level par 6 tables et 2 fonctions).
-- Recreer ces enums pour deux valeurs qui ne seront plus jamais ecrites
-- represente un risque disproportionne par rapport au gain : on migre donc
-- les DONNEES existantes vers les valeurs qui restent, et on laisse
-- 'apres_renovation' / 'leger' comme membres d'enum morts mais inoffensifs.
-- L'application ne les propose ni ne les accepte plus nulle part.

-- --- Chantiers reels : jamais reassigner silencieusement sans tracer -------
update public.jobs
set service = 'fin_de_chantier'
where service = 'apres_renovation';

update public.jobs
set soil = 'standard'
where soil = 'leger';

-- --- Metriques et experimentation (lecture historique) ---------------------
update public.job_metrics
set service = 'fin_de_chantier'
where service = 'apres_renovation';

update public.job_metrics
set soil = 'standard'
where soil = 'leger';

update public.experiences
set service = 'fin_de_chantier'
where service = 'apres_renovation';

update public.experiences
set soil = 'standard'
where soil = 'leger';

-- --- Catalogue de reference : cadence par bande/salissure -------------------
-- Seed technique, pas des chantiers reels : on retire simplement les 35
-- lignes "leger" plutot que de les reassigner (deja couvertes par 'standard').
delete from public.reference_catalogue
where soil = 'leger';

-- --- Grille tarifaire publique : jsonb, pas d'enum ---------------------------
update public.settings
set prix_m2 = (prix_m2 - 'apres_renovation')
  #- '{fin_de_chantier,leger}'
  #- '{vitres,leger}';
