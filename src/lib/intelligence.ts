import type { NiveauConfiance, PropertyType, SoilLevel } from '@/types/database';

/**
 * Intelligence des devis.
 *
 * PRINCIPE FONDATEUR — un chiffre sans niveau de confiance est un mensonge
 * par omission.
 *
 * Avec zero chantier realise, il n'existe aucune moyenne. Avec trois, il
 * existe une moyenne qui ne vaut rien : un chantier atypique la deplace de
 * 40 %. Le systeme doit donc TOUJOURS accompagner une estimation historique
 * du nombre d'observations qui la fondent, et basculer sur la grille
 * tarifaire tant que ce nombre est insuffisant.
 *
 * Ce module est PUR : aucune requete, aucune dependance serveur. Il recoit
 * les agregats calcules par la base et en tire une recommandation.
 */

export const SEUILS_CONFIANCE = {
  faible: 3,
  moyenne: 5,
  bonne: 10,
  elevee: 25,
} as const;

export const LIBELLES_CONFIANCE: Record<NiveauConfiance, string> = {
  aucune: 'Aucune donnée',
  faible: 'Confiance faible',
  moyenne: 'Confiance moyenne',
  bonne: 'Bonne confiance',
  elevee: 'Confiance élevée',
};

/** Phrase affichable. Elle dit ce que vaut le chiffre, pas seulement le chiffre. */
export function expliquerConfiance(n: number, origine: 'observee' | 'catalogue'): string {
  if (origine === 'catalogue') {
    return n === 0
      ? 'Aucun chantier comparable réalisé — estimation issue de la grille tarifaire.'
      : `${n} chantier${n > 1 ? 's' : ''} comparable${n > 1 ? 's' : ''} : trop peu pour une moyenne fiable. Estimation issue de la grille tarifaire.`;
  }
  if (n >= SEUILS_CONFIANCE.elevee) {
    return `Fondée sur ${n} chantiers comparables. Cette référence est plus fiable que la grille.`;
  }
  if (n >= SEUILS_CONFIANCE.bonne) {
    return `Fondée sur ${n} chantiers comparables. La tendance se dessine.`;
  }
  return `Fondée sur ${n} chantiers comparables. À confirmer sur les prochains.`;
}

export function niveauDepuisN(n: number): NiveauConfiance {
  if (n >= SEUILS_CONFIANCE.elevee) return 'elevee';
  if (n >= SEUILS_CONFIANCE.bonne) return 'bonne';
  if (n >= SEUILS_CONFIANCE.moyenne) return 'moyenne';
  if (n >= SEUILS_CONFIANCE.faible) return 'faible';
  return 'aucune';
}

/* ==========================================================================
 * Estimation assistee
 * ======================================================================== */

export interface ReferenceEffective {
  minutesParM2: number;
  q1: number | null;
  q3: number | null;
  n: number;
  confiance: NiveauConfiance;
  origine: 'observee' | 'catalogue';
}

export interface EstimationAssistee {
  /** Durée retenue, en minutes. */
  dureeMin: number;
  dureeMax: number;
  /** Fourchette de prix HTVA issue de l'historique, si elle existe. */
  prixMin: number | null;
  prixMax: number | null;
  /** Chiffre d'affaires horaire attendu, si connu. */
  caHoraire: number | null;
  confiance: NiveauConfiance;
  explication: string;
  /** Points à signaler au moment de chiffrer. */
  alertes: string[];
}

export interface EntreeEstimation {
  propertyType: PropertyType;
  surface: number;
  soil: SoilLevel;
  techniciens: number;
  reference: ReferenceEffective;
  /** Médiane facturée sur les chantiers comparables, HTVA. */
  medianeHtva: number | null;
  /** Grille tarifaire, pour comparaison. */
  grilleMin: number;
  grilleMax: number;
}

/**
 * Estimation assistée par l'historique.
 *
 * La durée vient de la référence effective (observée ou catalogue). La
 * fourchette de prix n'est proposée QUE si l'historique est assez fourni :
 * suggérer un prix sur trois chantiers reviendrait à ancrer la tarification
 * sur du bruit.
 */
export function estimerAvecHistorique(e: EntreeEstimation): EstimationAssistee {
  const alertes: string[] = [];

  // La durée totale se divise par le nombre de techniciens, mais pas
  // linéairement : à deux, on se croise, on se parle, on se repasse le
  // matériel. 15 % de perte par technicien supplémentaire.
  const rendementEquipe = 1 / (1 + (e.techniciens - 1) * 0.15);
  const minutesTotales = e.reference.minutesParM2 * e.surface;
  const minutesParPersonne = (minutesTotales / e.techniciens) * (1 / rendementEquipe);

  const etendue =
    e.reference.q1 !== null && e.reference.q3 !== null
      ? {
          bas: e.reference.q1 / e.reference.minutesParM2,
          haut: e.reference.q3 / e.reference.minutesParM2,
        }
      : { bas: 0.85, haut: 1.2 };

  const dureeMin = Math.round((minutesParPersonne * etendue.bas) / 5) * 5;
  const dureeMax = Math.round((minutesParPersonne * etendue.haut) / 5) * 5;

  // --- Prix ---------------------------------------------------------------
  // Proposé uniquement à partir de 5 chantiers comparables.
  const assezDeDonnees = e.reference.n >= SEUILS_CONFIANCE.moyenne;
  const prixMin =
    assezDeDonnees && e.medianeHtva !== null ? Math.round(e.medianeHtva * 0.9) : null;
  const prixMax =
    assezDeDonnees && e.medianeHtva !== null ? Math.round(e.medianeHtva * 1.1) : null;

  const caHoraire =
    assezDeDonnees && e.medianeHtva !== null && minutesTotales > 0
      ? Math.round((e.medianeHtva / (minutesTotales / 60)) * 100) / 100
      : null;

  // --- Alertes ------------------------------------------------------------
  if (e.reference.origine === 'catalogue') {
    alertes.push(
      'Aucune référence observée pour ce gabarit : la durée vient du catalogue. Notez la durée réelle, elle affinera les prochaines estimations.',
    );
  }

  if (prixMin !== null && prixMax !== null) {
    // L'historique dit-il autre chose que la grille ?
    const ecart =
      ((prixMin + prixMax) / 2 - (e.grilleMin + e.grilleMax) / 2) /
      ((e.grilleMin + e.grilleMax) / 2);
    if (ecart > 0.15) {
      alertes.push(
        `Sur ce gabarit, vous facturez en moyenne ${Math.round(ecart * 100)} % au-dessus de la grille. La grille est peut-être sous-évaluée.`,
      );
    } else if (ecart < -0.15) {
      alertes.push(
        `Sur ce gabarit, vous facturez en moyenne ${Math.round(Math.abs(ecart) * 100)} % en dessous de la grille. Vérifiez les remises accordées.`,
      );
    }
  }

  if (e.techniciens > 2 && e.surface < 150) {
    alertes.push(
      `${e.techniciens} techniciens sur ${e.surface} m² : au-delà de deux personnes sur une petite surface, on se gêne plus qu'on ne s'aide.`,
    );
  }

  if (e.reference.q1 !== null && e.reference.q3 !== null) {
    const dispersion = (e.reference.q3 - e.reference.q1) / e.reference.minutesParM2;
    if (dispersion > 0.6) {
      alertes.push(
        'Les chantiers de ce gabarit sont très dispersés en durée. Une visite préalable réduirait le risque.',
      );
    }
  }

  return {
    dureeMin: Math.max(30, dureeMin),
    dureeMax: Math.max(60, dureeMax),
    prixMin,
    prixMax,
    caHoraire,
    confiance: e.reference.confiance,
    explication: expliquerConfiance(e.reference.n, e.reference.origine),
    alertes,
  };
}

/* ==========================================================================
 * Comparaison d'un chantier realise a sa reference
 * ======================================================================== */

export type Verdict = 'rapide' | 'conforme' | 'lent' | 'indeterminé';

export interface Comparaison {
  verdict: Verdict;
  ecartPct: number | null;
  phrase: string;
  minutesParM2: number;
  referenceMinutesParM2: number;
}

export function comparerALaReference(
  minutesParM2: number,
  reference: ReferenceEffective,
): Comparaison {
  if (reference.n === 0 && reference.origine === 'catalogue') {
    return {
      verdict: 'indeterminé',
      ecartPct: null,
      phrase:
        'Premier chantier de ce gabarit : il devient lui-même la référence. Aucune comparaison possible.',
      minutesParM2,
      referenceMinutesParM2: reference.minutesParM2,
    };
  }

  const ecart = (minutesParM2 - reference.minutesParM2) / reference.minutesParM2;
  const pct = Math.round(ecart * 100);

  // ±15 % : en deçà, l'écart n'est pas significatif sur un chantier isolé.
  if (Math.abs(ecart) <= 0.15) {
    return {
      verdict: 'conforme',
      ecartPct: pct,
      phrase: `Cadence conforme à la référence (${reference.minutesParM2.toFixed(1)} min/m²).`,
      minutesParM2,
      referenceMinutesParM2: reference.minutesParM2,
    };
  }

  if (ecart < 0) {
    return {
      verdict: 'rapide',
      ecartPct: pct,
      phrase: `${Math.abs(pct)} % plus rapide que la référence. Vérifier que rien n'a été survolé — la couverture photo le dira.`,
      minutesParM2,
      referenceMinutesParM2: reference.minutesParM2,
    };
  }

  return {
    verdict: 'lent',
    ecartPct: pct,
    phrase: `${pct} % plus lent que la référence. Chantier plus dur que prévu, ou temps mal employé : le détail par étape tranche.`,
    minutesParM2,
    referenceMinutesParM2: reference.minutesParM2,
  };
}
