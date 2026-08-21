import { SEUIL_OBSERVATIONS } from '@/lib/alertes';
import { niveauDepuisN } from '@/lib/intelligence';
import type { NiveauConfiance } from '@/types/database';

/**
 * Expériences contrôlées.
 *
 * C'est la partie la plus honnete du systeme. Plutot que d'affirmer qu'une
 * hausse de 8 % passera, on la teste sur un perimetre et une periode donnes,
 * puis on compare avec la meme rigueur que partout ailleurs.
 *
 * LE POINT CRITIQUE : ce module doit etre pret a REFUSER DE CONCLURE. Une
 * experience qui se termine sur « on ne peut pas savoir » a plus de valeur
 * qu'une experience qui conclut a tort — parce que la seconde fait prendre
 * une decision, et que cette decision sera fausse.
 */

export type VerdictExperience = 'positif' | 'negatif' | 'neutre' | 'indeterminé';

export interface Echantillon {
  n: number;
  mediane: number | null;
  q1: number | null;
  q3: number | null;
}

export interface ResultatExperience {
  verdict: VerdictExperience;
  ecartPct: number | null;
  /** Phrase de conclusion, destinée à être lue telle quelle. */
  conclusion: string;
  /** Ce qu'il faut faire de ce résultat. */
  suite: string;
  confiance: NiveauConfiance;
  reference: Echantillon;
  test: Echantillon;
  /** Ce qui empêche de conclure, s'il y a lieu. */
  reserves: string[];
}

/** Sens de l'indicateur : une hausse est-elle une bonne nouvelle ? */
const HAUSSE_FAVORABLE: Record<string, boolean> = {
  ca_horaire: true,
  facture_htva: true,
  couverture_photo: true,
  minutes_par_m2: false, // moins de minutes par m² = mieux
};

const LIBELLES_INDICATEUR: Record<string, string> = {
  ca_horaire: 'CA horaire',
  facture_htva: 'panier moyen',
  couverture_photo: 'couverture photo',
  minutes_par_m2: 'cadence',
};

/**
 * Compare deux échantillons et rend un verdict.
 *
 * Trois raisons de refuser de conclure, dans cet ordre :
 *
 *   1. échantillon trop petit d'un côté ou de l'autre ;
 *   2. écart inférieur à 10 % — sous ce seuil, la différence tient au hasard
 *      des chantiers, pas à l'expérience ;
 *   3. recouvrement des intervalles interquartiles — si la moitié centrale
 *      des deux échantillons se chevauche, les distributions ne sont pas
 *      distinguables, quelle que soit la différence des médianes.
 *
 * Le troisième point est celui qu'on oublie le plus souvent, et c'est celui
 * qui produit les fausses conclusions les plus coûteuses.
 */
export function analyserExperience(params: {
  reference: Echantillon;
  test: Echantillon;
  indicateur: string;
}): ResultatExperience {
  const { reference, test, indicateur } = params;
  const reserves: string[] = [];
  const libelle = LIBELLES_INDICATEUR[indicateur] ?? indicateur;
  const confiance = niveauDepuisN(Math.min(reference.n, test.n));

  // --- 1. Taille des échantillons -----------------------------------------
  if (reference.n < SEUIL_OBSERVATIONS || test.n < SEUIL_OBSERVATIONS) {
    const manquant =
      reference.n < SEUIL_OBSERVATIONS
        ? `période de référence (${reference.n})`
        : `période de test (${test.n})`;

    return {
      verdict: 'indeterminé',
      ecartPct: null,
      conclusion: `Impossible de conclure : ${SEUIL_OBSERVATIONS} chantiers minimum sont nécessaires de chaque côté, la ${manquant} n'y arrive pas.`,
      suite:
        'Prolongez la période de test, ou élargissez le périmètre. Conclure maintenant reviendrait à décider au hasard.',
      confiance,
      reference,
      test,
      reserves: [
        `Référence : ${reference.n} chantier${reference.n > 1 ? 's' : ''}. Test : ${test.n}.`,
      ],
    };
  }

  if (reference.mediane === null || test.mediane === null || reference.mediane === 0) {
    return {
      verdict: 'indeterminé',
      ecartPct: null,
      conclusion: 'Impossible de conclure : les données de mesure sont incomplètes.',
      suite: 'Vérifiez que les chantiers du périmètre sont bien terminés et facturés.',
      confiance,
      reference,
      test,
      reserves: ['Médiane non calculable sur au moins une des deux périodes.'],
    };
  }

  // --- 2. Amplitude --------------------------------------------------------
  const ecart = (test.mediane - reference.mediane) / Math.abs(reference.mediane);
  const pct = Math.round(ecart * 100);

  if (Math.abs(ecart) < 0.1) {
    return {
      verdict: 'neutre',
      ecartPct: pct,
      conclusion: `Aucun effet mesurable : ${libelle} varie de ${pct} %, ce qui reste dans le bruit habituel d'un échantillon de cette taille.`,
      suite:
        'L’expérience n’a pas nui. Si le changement ne coûte rien, gardez-le ; sinon, revenez en arrière.',
      confiance,
      reference,
      test,
      reserves: [],
    };
  }

  // --- 3. Recouvrement interquartile ---------------------------------------
  // Si la moitie centrale des deux echantillons se chevauche, les
  // distributions ne sont pas distinguables — meme si les medianes different.
  const chevauchement =
    reference.q1 !== null &&
    reference.q3 !== null &&
    test.q1 !== null &&
    test.q3 !== null &&
    test.q1 < reference.q3 &&
    reference.q1 < test.q3;

  if (chevauchement) {
    reserves.push(
      'Les moitiés centrales des deux périodes se chevauchent : la différence de médiane pourrait tenir à la composition des chantiers plutôt qu’à l’expérience.',
    );
  }

  if (Math.min(reference.n, test.n) < 10) {
    reserves.push(
      `Échantillons modestes (${reference.n} et ${test.n}). Le résultat oriente, il ne prouve pas.`,
    );
  }

  const favorable = HAUSSE_FAVORABLE[indicateur] ?? true;
  const bonEffet = favorable ? ecart > 0 : ecart < 0;

  if (bonEffet) {
    return {
      verdict: 'positif',
      ecartPct: pct,
      conclusion: `${libelle} évolue de ${pct > 0 ? '+' : ''}${pct} % : ${Math.abs(pct)} % ${favorable ? 'de mieux' : 'de gagné'} sur la période de test.`,
      suite: chevauchement
        ? 'Résultat encourageant mais fragile. Prolongez plutôt que de généraliser tout de suite.'
        : 'Résultat net. Vous pouvez généraliser — et lancer l’expérience suivante.',
      confiance,
      reference,
      test,
      reserves,
    };
  }

  return {
    verdict: 'negatif',
    ecartPct: pct,
    conclusion: `${libelle} évolue de ${pct > 0 ? '+' : ''}${pct} %, dans le mauvais sens.`,
    suite: chevauchement
      ? 'Dégradation possible mais non établie. Arrêtez par prudence : un doute sur une perte se tranche en revenant en arrière.'
      : 'Revenez à la situation antérieure. L’expérience a répondu, et la réponse est non.',
    confiance,
    reference,
    test,
    reserves,
  };
}

/* ==========================================================================
 * Suggestions d'expériences
 * ======================================================================== */

export interface SuggestionExperience {
  code: string;
  titre: string;
  hypothese: string;
  famille: string;
  dureeJours: number;
  /** Pourquoi cette expérience mérite d'être menée. */
  justification: string;
}

/**
 * Traduit une recommandation risquée en expérience contrôlée.
 *
 * Toute recommandation tarifaire devrait passer par là : une hausse de prix
 * est irréversible en pratique — on ne rebaisse pas ses tarifs sans envoyer
 * un signal désastreux. Autant la tester sur un périmètre restreint.
 */
export function suggererDepuisRecommandation(reco: {
  code: string;
  famille: string;
  titre: string;
  chantiersConcernes: number;
  experience: { titre: string; hypothese: string; dureeJours: number } | null;
}): SuggestionExperience | null {
  if (!reco.experience) return null;

  return {
    code: `exp:${reco.code}`,
    titre: reco.experience.titre,
    hypothese: reco.experience.hypothese,
    famille: reco.famille,
    dureeJours: reco.experience.dureeJours,
    justification:
      reco.famille === 'tarification'
        ? `Une hausse de prix ne se rebaisse pas sans abîmer l'image. Mieux vaut la tester ${reco.experience.dureeJours} jours sur ce seul gabarit.`
        : `À ${reco.chantiersConcernes} chantiers, l'écart observé mérite d'être confirmé avant d'en faire une règle.`,
  };
}

/** Durée minimale conseillée pour qu'une expérience puisse conclure. */
export function dureeConseillee(chantiersParMois: number): {
  jours: number;
  explication: string;
} {
  if (chantiersParMois <= 0) {
    return {
      jours: 90,
      explication:
        'Aucun rythme connu. Trois mois est un pari raisonnable, à ajuster dès que le volume se stabilise.',
    };
  }

  // Il faut au moins 5 chantiers dans le périmètre pour conclure.
  const mois = Math.ceil(SEUIL_OBSERVATIONS / chantiersParMois);
  const jours = Math.max(30, mois * 30);

  return {
    jours,
    explication: `À ${chantiersParMois} chantier${chantiersParMois > 1 ? 's' : ''} par mois sur ce périmètre, il faut environ ${jours} jours pour réunir les ${SEUIL_OBSERVATIONS} chantiers nécessaires.`,
  };
}
