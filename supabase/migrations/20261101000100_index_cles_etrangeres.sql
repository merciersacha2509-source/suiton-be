-- ===========================================================================
-- SUITON OS 1.0 — Mise en production — Index sur les cles etrangeres
-- ===========================================================================
-- PostgreSQL n'indexe PAS automatiquement le cote enfant d'une cle etrangere.
-- Il indexe le cote parent, parce que c'est une cle primaire. Le cote enfant
-- reste nu tant qu'on ne l'indexe pas explicitement.
--
-- La consequence n'est pas seulement une jointure lente. A CHAQUE suppression
-- ou mise a jour d'une ligne parente, PostgreSQL doit verifier qu'aucun enfant
-- ne la reference — et sans index, cette verification est un parcours complet
-- de la table enfant.
--
-- Trois chemins rendent cela critique ici :
--
--   1. L'effacement RGPD d'un client. events.client_id est en ON DELETE
--      CASCADE et `events` est notre table la plus volumineuse : sans index,
--      supprimer un client la parcourt entierement. L'effacement est une
--      obligation legale avec un delai d'un mois ; ce n'est pas l'operation
--      qu'on veut voir expirer.
--
--   2. La desactivation d'un compte. Douze tables referencent profiles en
--      ON DELETE SET NULL. Supprimer un profil les parcourt toutes.
--
--   3. Les lectures quotidiennes : photos par intervention, factures par
--      devis, chaine de versions d'un document.
--
-- Les index sont partiels sur les colonnes nullables : une colonne
-- majoritairement nulle produirait sinon un index en grande partie vide.
-- Un index partiel « where col is not null » reste utilisable pour la
-- verification de contrainte, qui ne cherche jamais NULL.
-- ===========================================================================

-- --- Effacement d'un client (RGPD) ----------------------------------------
create index if not exists events_client_id_idx
  on public.events (client_id) where client_id is not null;
create index if not exists reviews_client_id_idx
  on public.reviews (client_id) where client_id is not null;

-- --- Suppression d'un chantier --------------------------------------------
create index if not exists score_events_job_id_idx
  on public.score_events (job_id) where job_id is not null;
create index if not exists booking_drafts_converti_en_idx
  on public.booking_drafts (converti_en) where converti_en is not null;

-- --- Lectures quotidiennes ------------------------------------------------
create index if not exists photos_intervention_id_idx
  on public.photos (intervention_id) where intervention_id is not null;
create index if not exists invoices_quote_id_idx
  on public.invoices (quote_id) where quote_id is not null;
create index if not exists invoices_partner_id_idx
  on public.invoices (partner_id) where partner_id is not null;
create index if not exists invoices_avoir_de_idx
  on public.invoices (avoir_de) where avoir_de is not null;
create index if not exists documents_superseded_by_idx
  on public.documents (superseded_by) where superseded_by is not null;
create index if not exists checklist_progress_ordre_idx
  on public.checklist_progress (ordre);
create index if not exists recommandations_experience_id_idx
  on public.recommandations (experience_id) where experience_id is not null;
create index if not exists experiences_modele_code_idx
  on public.experiences (modele_code) where modele_code is not null;

-- --- Suppression d'un compte ----------------------------------------------
-- Douze references vers profiles. Individuellement peu sollicitees ; prises
-- ensemble, elles transforment la suppression d'un compte en douze parcours
-- de table.
create index if not exists audit_logs_actor_id_idx
  on public.audit_logs (actor_id) where actor_id is not null;
create index if not exists events_actor_id_idx
  on public.events (actor_id) where actor_id is not null;
create index if not exists checklist_progress_fait_par_idx
  on public.checklist_progress (fait_par) where fait_par is not null;
create index if not exists documents_created_by_idx
  on public.documents (created_by) where created_by is not null;
create index if not exists experiences_cree_par_idx
  on public.experiences (cree_par) where cree_par is not null;
create index if not exists job_archives_archive_par_idx
  on public.job_archives (archive_par) where archive_par is not null;
create index if not exists messages_auteur_id_idx
  on public.messages (auteur_id) where auteur_id is not null;
create index if not exists photos_uploaded_by_idx
  on public.photos (uploaded_by) where uploaded_by is not null;
create index if not exists quotes_created_by_idx
  on public.quotes (created_by) where created_by is not null;
create index if not exists recommandations_decide_par_idx
  on public.recommandations (decide_par) where decide_par is not null;
create index if not exists reports_validated_by_idx
  on public.reports (validated_by) where validated_by is not null;
create index if not exists settings_updated_by_idx
  on public.settings (updated_by) where updated_by is not null;
create index if not exists settings_history_updated_by_idx
  on public.settings_history (updated_by) where updated_by is not null;
