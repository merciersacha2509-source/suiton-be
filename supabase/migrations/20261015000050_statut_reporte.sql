-- ===========================================================================
-- SUITON OS 1.0 — Sprint 8 — Statut « reportée »
-- ===========================================================================
-- Migration separee, et volontairement.
--
-- PostgreSQL interdit d'UTILISER une valeur d'enum dans la transaction qui
-- l'ajoute. Regrouper cet ALTER TYPE avec les vues qui s'en servent produit
-- « unsafe use of new value » — une erreur qui n'apparait qu'a l'application
-- de la migration, jamais a l'ecriture.
-- ===========================================================================

alter type recommandation_statut add value if not exists 'reportee';
