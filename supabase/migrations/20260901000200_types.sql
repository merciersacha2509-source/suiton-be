-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Types metier
-- ===========================================================================
-- Chaque enum encode une regle. Ajouter une valeur est une decision produit,
-- pas un detail technique : c'est pourquoi ce ne sont pas des colonnes texte.
-- ===========================================================================

-- Roles applicatifs. Le role "client" n'existe pas ici : le client accede a
-- son portail par jeton opaque, sans compte (chapitre 7 du PRD).
create type app_role as enum ('admin', 'staff', 'technicien', 'partenaire');

-- Les 11 etapes du pipeline commercial. Decrit la RELATION, pas l'execution.
create type job_stage as enum (
  'nouveau',
  'contacte',
  'qualifie',
  'devis_a_produire',
  'devis_envoye',
  'relance',
  'negociation',
  'gagne',
  'planifie',
  'termine',
  'perdu'
);

-- Statut d'INTERVENTION : decrit l'execution. Volontairement distinct de
-- l'etape. Un chantier "gagne" peut avoir trois interventions a des statuts
-- differents.
create type intervention_status as enum (
  'provisoire',
  'confirme',
  'en_route',
  'sur_place',
  'termine',
  'annule'
);

create type service_type   as enum ('fin_de_chantier', 'apres_renovation', 'vitres');
create type soil_level     as enum ('leger', 'standard', 'lourd');
create type property_type  as enum ('studio', 'appartement', 'maison', 'villa', 'bureaux', 'commerce', 'autre');
create type zone_tier      as enum ('principale', 'secondaire', 'exceptionnelle');
create type client_kind    as enum ('particulier', 'professionnel');
create type quote_status   as enum ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');
create type invoice_status as enum ('brouillon', 'emise', 'payee', 'annulee');
create type invoice_kind   as enum ('facture', 'avoir');
create type vat_regime     as enum ('standard_21', 'autoliquidation', 'exonere');
create type photo_phase    as enum ('avant', 'apres', 'contexte', 'incident');
create type message_channel as enum ('portail', 'email', 'whatsapp', 'telephone', 'interne');
create type automation_state as enum ('actif', 'suspendu', 'desactive');
