-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Extensions
-- ===========================================================================
-- btree_gist est requis par la contrainte EXCLUDE des interventions : elle
-- combine une egalite (team_id) et un chevauchement de plage (&&), ce qu'un
-- index gist ne sait faire qu'avec cette extension.
--
-- Elle est installee dans `public` et NON dans `extensions` : les classes
-- d'operateurs d'un index sont resolues via le search_path, qui ne contient
-- pas `extensions` au moment ou les migrations s'executent. Le meme piege
-- vaut pour les types — c'est la raison pour laquelle les adresses e-mail
-- sont stockees en `text` avec un index unique sur lower(), plutot qu'en
-- citext.
--
-- gen_random_uuid() n'exige aucune extension depuis PostgreSQL 13 : elle
-- fait partie du coeur.
-- ===========================================================================

create extension if not exists "btree_gist" with schema public;
