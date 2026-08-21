/**
 * Identite de l'entreprise, telle qu'elle apparait publiquement.
 *
 * Ces valeurs sont dupliquees depuis `settings` en base — deliberement.
 * Les pages publiques sont generees statiquement : une lecture en base a
 * chaque rendu couterait un aller-retour sur le chemin critique du LCP,
 * pour des donnees qui changent une fois tous les cinq ans.
 *
 * En cas de divergence, `settings` fait foi pour les documents ; ceci fait
 * foi pour le site.
 */
export const ENTREPRISE = {
  nom: 'SUITON',
  slogan: 'Nous ne nettoyons pas simplement. Nous prouvons le résultat.',
  activite: 'Nettoyage de fin de chantier',
  adresse: 'Rue Boussart 7',
  codePostal: '7850',
  commune: 'Enghien',
  pays: 'BE',
  paysNom: 'Belgique',
  region: 'Hainaut',
  tva: 'BE1040784957',
  peppol: '9925:BE1040784957',
  telephone: '0489 21 01 24',
  telephoneE164: '+32489210124',
  whatsapp: '32489210124',
  email: 'suiton.detailing@gmail.com',
  /** Coordonnees d'Enghien. Servent au JSON-LD et a la carte. */
  latitude: 50.6939,
  longitude: 4.0342,
  /** Rayon d'intervention en metres, pour le JSON-LD. */
  rayonKm: 45,
  horaires: [
    { jours: 'Lundi au vendredi', heures: '08:00 – 17:00' },
    { jours: 'Samedi', heures: '08:00 – 13:00' },
    { jours: 'Dimanche', heures: 'Fermé' },
  ],
  fondation: '2026',
} as const;

/** Ouverture officielle. Avant cette date, le site annonce le lancement. */
export const LANCEMENT = new Date('2026-10-01T00:00:00+02:00');

export const GARANTIES = [
  {
    titre: 'Vitres et châssis compris',
    detail:
      "Jamais en supplément. Beaucoup de sociétés les facturent à part — un chantier livré avec des vitres sales n'est pas un chantier livré.",
  },
  {
    titre: 'Rapport photo avant/après',
    detail:
      "Remis à la fin de chaque chantier : procédure suivie étape par étape, avec l'heure de chacune, et les comparaisons pièce par pièce.",
  },
  {
    titre: 'Garantie retouche 48 heures',
    detail:
      'Un point ne vous convient pas ? Nous repassons sans frais et sans discussion. Un appel suffit.',
  },
  {
    titre: 'Devis ferme sous 24 heures',
    detail:
      'Pas une fourchette qui bouge le jour du chantier. Le montant est ferme pour la surface et le niveau de salissure annoncés.',
  },
] as const;

export const ETAPES_CLIENT = [
  {
    numero: 1,
    titre: 'Vous décrivez le chantier',
    detail: 'Six étapes, deux minutes. Une estimation s’affiche pendant que vous remplissez.',
  },
  {
    numero: 2,
    titre: 'Vous recevez un devis ferme',
    detail:
      'Sous 24 heures ouvrées, en PDF, avec tout ce qui est compris — et ce qui ne l’est pas.',
  },
  {
    numero: 3,
    titre: 'Vous acceptez en ligne',
    detail: 'Un bouton. Le créneau se bloque, la confirmation part.',
  },
  {
    numero: 4,
    titre: 'Nous intervenons',
    detail: 'Vous êtes prévenu la veille, puis le matin même quand nous prenons la route.',
  },
  {
    numero: 5,
    titre: 'Vous recevez la preuve',
    detail: 'Rapport photo avant/après, procédure horodatée, observations. Puis la facture.',
  },
] as const;
