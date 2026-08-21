-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Reglages initiaux
-- ===========================================================================
-- La grille tarifaire vit ici et nulle part ailleurs. Le calculateur public,
-- le devis et le tableau de bord lisent tous cette ligne : une modification
-- se propage partout, immediatement, sans deploiement.
-- ===========================================================================

insert into public.settings (id, prix_m2, zones, entreprise)
values (
  true,
  jsonb_build_object(
    'fin_de_chantier', jsonb_build_object(
      'leger',    jsonb_build_object('min',  5, 'max',  5),
      'standard', jsonb_build_object('min',  7, 'max',  8),
      'lourd',    jsonb_build_object('min', 10, 'max', 14)
    ),
    'apres_renovation', jsonb_build_object(
      'leger',    jsonb_build_object('min',  4, 'max',  5),
      'standard', jsonb_build_object('min',  6, 'max',  7),
      'lourd',    jsonb_build_object('min',  9, 'max', 12)
    ),
    'vitres', jsonb_build_object(
      'leger',    jsonb_build_object('min',  3, 'max',  4),
      'standard', jsonb_build_object('min',  4, 'max',  5),
      'lourd',    jsonb_build_object('min',  6, 'max',  8)
    )
  ),
  jsonb_build_object(
    'principale',    jsonb_build_object('frais',   0, 'libelle', 'Enghien et 20 km'),
    'secondaire',    jsonb_build_object('frais',  25, 'libelle', 'Brabant wallon, Hainaut'),
    'exceptionnelle',jsonb_build_object('frais', 800, 'libelle', 'Hors zone — sur devis')
  ),
  jsonb_build_object(
    'denomination', 'SUITON',
    'adresse',      'Rue Boussart 7',
    'code_postal',  '7850',
    'commune',      'Enghien',
    'pays',         'Belgique',
    'tva',          'BE1040784957',
    'peppol',       '9925:BE1040784957',
    'telephone',    '0489 21 01 24',
    'email',        'suiton.detailing@gmail.com',
    'iban',         ''
  )
)
on conflict (id) do nothing;

-- Les neuf scenarios Make. Crees suspendus : ils s'activent au Sprint 8,
-- quand les processus auront ete executes manuellement au moins une fois.
insert into public.automations (code, libelle, state) values
  ('nouveau_lead',      'Nouveau lead',            'suspendu'),
  ('devis_a_produire',  'Devis a produire',        'suspendu'),
  ('devis_envoye',      'Devis envoye + relances', 'suspendu'),
  ('devis_accepte',     'Devis accepte',           'suspendu'),
  ('veille_chantier',   'Veille de chantier',      'suspendu'),
  ('intervention',      'Intervention en cours',   'suspendu'),
  ('fin_de_chantier',   'Fin de chantier',         'suspendu'),
  ('avis_google',       'Sequence avis Google',    'suspendu'),
  ('client_inactif',    'Client inactif',          'suspendu')
on conflict (code) do nothing;

-- Une equipe pour demarrer : au lancement, SUITON c'est une personne.
insert into public.teams (nom, couleur) values ('Equipe 1', '#14415F')
on conflict (nom) do nothing;
