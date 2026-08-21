import type { SettingsRow } from '@/types/database';

/** Reglages identiques a ceux du seed SQL. Si le seed change, ceci change. */
export const SETTINGS: SettingsRow = {
  id: true,
  prix_m2: {
    fin_de_chantier: {
      leger: { min: 5, max: 5 },
      standard: { min: 7, max: 8 },
      lourd: { min: 10, max: 14 },
    },
    apres_renovation: {
      leger: { min: 4, max: 5 },
      standard: { min: 6, max: 7 },
      lourd: { min: 9, max: 12 },
    },
    vitres: {
      leger: { min: 3, max: 4 },
      standard: { min: 4, max: 5 },
      lourd: { min: 6, max: 8 },
    },
  },
  coef_bien: {
    studio: 1,
    appartement: 1,
    maison: 1,
    villa: 1,
    bureaux: 1,
    commerce: 1,
    autre: 1,
  },
  zones: {
    principale: { frais: 0, libelle: 'Enghien et 20 km' },
    secondaire: { frais: 25, libelle: 'Brabant wallon, Hainaut' },
    exceptionnelle: { frais: 800, libelle: 'Hors zone' },
  },
  majoration_urgence: 0.2,
  seuil_surface_devis: 300,
  tva_taux: 0.21,
  delai_devis_heures: 24,
  garantie_heures: 48,
  tampon_trajet_min: 30,
  acompte_pct: 30,
  delai_paiement_jours: 15,
  validite_devis_jours: 30,
  banque: { iban: 'BE68 5390 0754 7034', bic: 'GKCCBEBB', titulaire: 'SUITON — Sacha Mercier' },
  entreprise: {
    denomination: 'SUITON',
    adresse: 'Rue Boussart 7',
    code_postal: '7850',
    commune: 'Enghien',
    pays: 'Belgique',
    tva: 'BE1040784957',
    peppol: '9925:BE1040784957',
    telephone: '0489 21 01 24',
    email: 'suiton.detailing@gmail.com',
    iban: '',
  },
  updated_at: '2026-09-01T00:00:00.000Z',
};
