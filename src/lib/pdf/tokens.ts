/**
 * Jetons de la collection documentaire SUITON.
 *
 * Une seule source pour les sept documents. Modifier une valeur ici la
 * propage partout — c'est ce qui fait qu'ils forment une collection et non
 * une accumulation.
 */

export const COULEURS = {
  abysse: '#0B2239',
  ocean: '#14415F',
  aqua: '#5FC2CE',
  aquaDeep: '#1E6E78',
  aquaWash: '#E8F6F8',
  mineral: '#F4F6F5',
  mineralSombre: '#E2E7E6',
  ardoise: '#64748B',
  ardoiseClair: '#94A3B8',
  ambre: '#B45309',
  ambreWash: '#FFFAEB',
  succes: '#15803D',
  succesWash: '#ECFDF3',
  danger: '#B03A2E',
} as const;

export const POLICES = {
  titre: 'Jura',
  texte: 'Inter',
} as const;

/**
 * Echelle typographique. Les valeurs ne sont pas rondes par hasard :
 * elles suivent un rapport d'environ 1,2 entre chaque niveau, ce qui donne
 * une hierarchie lisible sans avoir a la souligner.
 */
export const TAILLES = {
  micro: 6.6,
  etiquette: 7,
  petit: 7.6,
  base: 8.6,
  moyen: 9.4,
  grand: 11,
  titreSection: 10.5,
  titreDocument: 22,
  chiffre: 13,
} as const;

export const ESPACES = {
  page: { haut: 30, bas: 46, cotes: 40 },
  bloc: 12,
  section: 14,
} as const;

/**
 * Types de documents produits par SUITON OS.
 *
 * `interne` : ne quitte jamais l'entreprise.
 * `equipe`  : remis a l'equipe sur le chantier.
 * `client`  : transmis au client — donc soigne et juridiquement tenu.
 */
export const DOCUMENTS = {
  devis: { libelle: 'Devis', pied: 'DEVIS', prefixe: 'D', destinataire: 'client' },
  facture: { libelle: 'Facture', pied: 'FACTURE', prefixe: 'F', destinataire: 'client' },
  rapport: {
    libelle: "Rapport d'intervention",
    pied: "RAPPORT D'INTERVENTION",
    prefixe: 'R',
    destinataire: 'client',
  },
  attestation: {
    libelle: 'Attestation de fin de chantier',
    pied: 'ATTESTATION DE FIN DE CHANTIER',
    prefixe: 'A',
    destinataire: 'client',
  },
  bon_intervention: {
    libelle: "Bon d'intervention",
    pied: "BON D'INTERVENTION",
    prefixe: 'B',
    destinataire: 'equipe',
  },
  fiche_chantier: {
    libelle: 'Fiche chantier',
    pied: 'FICHE CHANTIER — INTERNE',
    prefixe: 'FC',
    destinataire: 'interne',
  },
  rapport_qualite: {
    libelle: 'Rapport qualité',
    pied: 'RAPPORT QUALITÉ — INTERNE',
    prefixe: 'Q',
    destinataire: 'interne',
  },
} as const;

export type TypeDocument = keyof typeof DOCUMENTS;
export type Destinataire = (typeof DOCUMENTS)[TypeDocument]['destinataire'];
