import type { ClientKind, ScoreBand, ZoneTier } from '@/types/database';

/**
 * Moteur de score — DETERMINISTE.
 *
 * Aucun modele entraine. SUITON n'a realise aucun chantier commercial : il
 * n'existe aucun devis gagne ou perdu sur lequel s'entrainer. Une
 * probabilite affichee dans ces conditions serait une regle arbitraire
 * deguisee en prediction, et le danger d'un chiffre presente comme predictif
 * est qu'on finit par lui faire confiance.
 *
 * Socle : 0-100. Signaux comportementaux : -40 a +40. Total borne 0-140.
 */

export interface ScoreSocleInput {
  montantEstime: number;
  clientKind: ClientKind;
  /** Segment du partenaire, si le contact est rattache a une personne morale. */
  segment: 'entreprise_generale' | 'promoteur' | 'architecte' | 'agence' | 'independant' | null;
  /** Nombre de chantiers attendus par an. 1 = chantier unique. */
  recurrenceAnnuelle: number;
  zone: ZoneTier;
  /** Jours avant la date souhaitee. null si aucune date donnee. */
  delaiJours: number | null;
  aDesPhotos: boolean;
}

export const RULES = {
  repond_moins_2h: { points: 10, libelle: 'Repond en moins de 2 h', ttlJours: 90 },
  deja_client: { points: 12, libelle: 'Deja client', ttlJours: null },
  a_recommande: { points: 10, libelle: 'A recommande SUITON', ttlJours: null },
  devis_ouvert_2x: { points: 8, libelle: 'Devis ouvert deux fois', ttlJours: 90 },
  retour_site_7j: { points: 7, libelle: 'Retour sur le site sous 7 jours', ttlJours: 90 },
  photos_apres_coup: { points: 6, libelle: 'Photos envoyees apres la demande', ttlJours: 90 },
  a_laisse_avis: { points: 6, libelle: 'A laisse un avis', ttlJours: null },
  consulte_3_pages: { points: 5, libelle: 'Trois pages ou plus consultees', ttlJours: 90 },
  silence_7j: { points: -12, libelle: 'Silence depuis 7 jours', ttlJours: 90 },
  devis_dormant_14j: {
    points: -15,
    libelle: 'Devis ouvert sans suite depuis 14 jours',
    ttlJours: 90,
  },
} as const;

export type RuleCode = keyof typeof RULES;

export const SCORE_MAX = 140;
export const COMPORTEMENT_PLAFOND = 40;

function pointsMontant(montant: number): number {
  if (montant >= 2000) return 25;
  if (montant >= 1000) return 20;
  if (montant >= 500) return 12;
  return 5;
}

function pointsProfil(kind: ClientKind, segment: ScoreSocleInput['segment']): number {
  if (kind === 'particulier') return 8;
  if (segment === 'entreprise_generale' || segment === 'promoteur') return 25;
  if (segment === 'agence' || segment === 'architecte') return 20;
  return 16;
}

function pointsRecurrence(parAn: number): number {
  if (parAn > 5) return 20;
  if (parAn >= 2) return 12;
  return 0;
}

function pointsZone(zone: ZoneTier): number {
  if (zone === 'principale') return 10;
  if (zone === 'secondaire') return 6;
  return 2;
}

function pointsDelai(jours: number | null): number {
  if (jours === null) return 3;
  if (jours < 15) return 12;
  if (jours <= 30) return 7;
  return 3;
}

/** Socle statique, 0 a 100. Calcule une fois a la creation de la demande. */
export function computeSocle(input: ScoreSocleInput): number {
  const total =
    pointsMontant(input.montantEstime) +
    pointsProfil(input.clientKind, input.segment) +
    pointsRecurrence(input.recurrenceAnnuelle) +
    pointsZone(input.zone) +
    pointsDelai(input.delaiJours) +
    (input.aDesPhotos ? 8 : 0);

  return Math.min(100, total);
}

/**
 * Somme des signaux comportementaux, plafonnee a +/-40.
 *
 * Le plafond est delibere : sans lui, un prospect tres actif mais peu
 * solvable finirait par depasser une entreprise generale silencieuse.
 */
export function computeComportement(signals: readonly RuleCode[]): number {
  const brut = signals.reduce((sum, code) => sum + RULES[code].points, 0);
  return Math.max(-COMPORTEMENT_PLAFOND, Math.min(COMPORTEMENT_PLAFOND, brut));
}

export function computeScore(socle: ScoreSocleInput, signals: readonly RuleCode[]): number {
  const total = computeSocle(socle) + computeComportement(signals);
  return Math.max(0, Math.min(SCORE_MAX, total));
}

/**
 * Bande de score.
 *
 * ATTENTION : la base calcule la meme chose dans une colonne generee
 * (clients.score_band). Les deux implementations doivent rester alignees —
 * le test `scoring.test.ts` verifie les seuils exacts.
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= 110) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 55) return 'B';
  return 'C';
}

export const BAND_TRAITEMENT: Record<ScoreBand, string> = {
  'A+': 'Notification immediate, rappel sous 2 h, devis sur mesure',
  A: 'Priorite dans la file des devis, rappel sous 2 h ouvrees',
  B: 'Parcours standard, devis sous 24 h, relances J+2 / J+5 / J+10',
  C: 'Devis automatique, une seule relance a J+5',
};
