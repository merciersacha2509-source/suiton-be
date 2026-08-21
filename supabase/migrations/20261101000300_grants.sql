-- ===========================================================================
-- SUITON OS 1.0 — Privileges de base
-- ===========================================================================
-- La RLS (migration 20260901000800 et suivantes) filtre les LIGNES qu'un
-- role peut voir ou modifier. Elle suppose que ce role a deja, au niveau
-- SQL, le droit de toucher la table : sans GRANT, Postgres refuse la
-- requete avant meme d'evaluer une seule politique RLS — « permission
-- denied for table x », quelle que soit la politique ecrite.
--
-- Sur un projet Supabase heberge, ces privileges de base sont poses une fois
-- par la plateforme, hors migrations. Une base construite depuis ce depot
-- seul — `supabase start` en local, ou une reconstruction complete ailleurs
-- que sur la plateforme — ne les a jamais recus : aucune migration ne les
-- posait. Resultat concret observe en local : un utilisateur authentifie
-- valide (jeton verifie par GoTrue) ne peut pas lire sa propre ligne dans
-- `profiles`, et la connexion echoue silencieusement.
--
-- Cette migration pose explicitement ce que la plateforme pose implicitement,
-- pour que la base soit utilisable quelle que soit la facon dont elle est
-- construite. Elle ne retire aucune restriction : la RLS reste la barriere
-- reelle, ligne par ligne, exactement comme avant.
-- ===========================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Le role anon n'ecrit jamais directement (cf. migration RLS) : lecture
-- seule, et seulement ce que les politiques RLS exposent reellement.
grant select on all tables in schema public to anon;

-- Le role authenticated agit sous son identite : la RLS decide, table par
-- table et ligne par ligne, ce que chaque politique autorise vraiment.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Le role service_role contourne la RLS par conception (cle serveur
-- uniquement) ; il lui faut neanmoins les privileges de base pour y
-- acceder.
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;
grant all on all sequences in schema public to service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;

-- Tables et fonctions creees APRES cette migration : mêmes privileges par
-- defaut, sans devoir y repenser a chaque nouvelle migration.
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
