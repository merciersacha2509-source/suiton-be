-- ===========================================================================
-- SUITON OS 1.0 — Lancement — Coefficients par type de bien
-- ===========================================================================
-- Le calculateur public ne demandait pas le type de bien. Or deux logements
-- de 120 m² ne demandent pas le meme travail : un studio n'a qu'un sanitaire
-- et peu de menuiseries ; une villa en a plusieurs, plus d'escaliers et
-- beaucoup plus de surface vitree. Le m² au sol ne dit pas tout.
--
-- REGLE FONDATRICE, INCHANGEE : le logiciel ne modifie jamais la grille
-- tarifaire de lui-meme. Tous les coefficients sont donc crees a 1.000 —
-- c'est-a-dire SANS AUCUN EFFET sur les prix actuels. Ils apparaissent dans
-- l'ecran des reglages ; le dirigeant les ajuste quand il aura des donnees
-- reelles, ou jamais.
--
-- Les bornes 0,5 – 2,0 sont un garde-fou : une faute de frappe dans un champ
-- de reglages ne doit pas pouvoir diviser un devis par dix.
-- ===========================================================================

alter table public.settings
  add column if not exists coef_bien jsonb not null default jsonb_build_object(
    'studio',      1.000,
    'appartement', 1.000,
    'maison',      1.000,
    'villa',       1.000,
    'bureaux',     1.000,
    'commerce',    1.000,
    'autre',       1.000
  );

comment on column public.settings.coef_bien is
  'Coefficient multiplicateur par type de bien. 1.000 = sans effet. '
  'Ajuste par le dirigeant uniquement, jamais par le systeme.';

-- Tous les types de l'enumeration doivent etre presents, et dans les bornes.
--
-- Une contrainte CHECK ne peut pas contenir de sous-requete : on ne peut donc
-- pas parcourir le jsonb avec jsonb_each_text. Les sept cles sont enumerees
-- explicitement. C'est verbeux, mais c'est verifie a chaque ecriture — et une
-- enumeration de sept valeurs ne bouge pas plus souvent que le type SQL dont
-- elle est tiree.
alter table public.settings
  drop constraint if exists settings_coef_bien_complet;

alter table public.settings
  add constraint settings_coef_bien_complet check (
    coef_bien ?& array['studio','appartement','maison','villa','bureaux','commerce','autre']
    and (coef_bien ->> 'studio')::numeric      between 0.5 and 2.0
    and (coef_bien ->> 'appartement')::numeric between 0.5 and 2.0
    and (coef_bien ->> 'maison')::numeric      between 0.5 and 2.0
    and (coef_bien ->> 'villa')::numeric       between 0.5 and 2.0
    and (coef_bien ->> 'bureaux')::numeric     between 0.5 and 2.0
    and (coef_bien ->> 'commerce')::numeric    between 0.5 and 2.0
    and (coef_bien ->> 'autre')::numeric       between 0.5 and 2.0
  );
