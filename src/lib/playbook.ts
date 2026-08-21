import { SEUIL_OBSERVATIONS } from '@/lib/alertes';
import type { ResultatExperience } from '@/lib/experiences';
import type { Recommandation } from '@/lib/recommandations';

/**
 * SUITON Playbook — fermeture de la boucle.
 *
 *   observation → recommandation → décision → expérience → mesure → référence
 *
 * Le maillon qui manquait etait l'EXECUTION. Une recommandation acceptee qui
 * ne devient pas une experience mesuree n'apprend rien : c'est une intention.
 *
 * Module PUR. Aucune requete, aucune ecriture. Il transforme une
 * recommandation en plan, et une mesure en decision proposee.
 */

/* ==========================================================================
 * Plan d'exécution
 * ======================================================================== */

export interface ModelePlaybook {
  code: string;
  titre: string;
  famille: string;
  description: string;
  indicateur: string;
  duree_jours: number;
  seuil_effet_pct: number;
  seuil_n: number;
  prerequis: string[];
  vigilance: string[];
}

export interface Plan {
  /** Modèle de playbook retenu. */
  modele: ModelePlaybook;
  /** Ce qui sera concrètement changé pendant le test. */
  intervention: string;
  hypothese: string;
  dureeJours: number;
  indicateur: string;
  seuilEffetPct: number;
  seuilN: number;
  /** Chantiers attendus sur la durée du test, dans le périmètre. */
  chantiersAttendus: number;
  /** Le test pourra-t-il conclure ? */
  viable: boolean;
  /** Pourquoi il ne pourra pas, le cas échéant. */
  obstacle: string | null;
  prerequis: string[];
  vigilance: string[];
}

/** Associe une famille de recommandation au modèle de playbook adapté. */
const MODELE_PAR_FAMILLE: Record<string, string> = {
  tarification: 'hausse_tarifaire',
  planning: 'nouvelle_equipe',
  productivite: 'nouveau_materiel',
  qualite: 'nouvelle_procedure',
  prospection: 'nouvelle_zone',
};

/**
 * Duree maximale d'une experience.
 *
 * Au-dela de six mois, le marche, la saison et l'equipe auront change : la
 * mesure ne comparerait plus la meme entreprise a elle-meme.
 */
const PLAFOND_JOURS = 180;

export function modelePour(famille: string, modeles: ModelePlaybook[]): ModelePlaybook | null {
  const code = MODELE_PAR_FAMILLE[famille];
  return modeles.find((m) => m.code === code) ?? modeles[0] ?? null;
}

/**
 * Construit le plan d'exécution d'une recommandation.
 *
 * Le point critique est `viable` : on VERIFIE avant de lancer que le
 * périmètre produira assez de chantiers pour conclure. Lancer une expérience
 * de 60 jours sur un segment qui fait deux chantiers par trimestre garantit
 * six mois d'attente pour un « on ne peut pas savoir ».
 */
export function construirePlan(params: {
  recommandation: Recommandation;
  modele: ModelePlaybook;
  /** Chantiers du périmètre observés par mois. */
  chantiersParMois: number;
}): Plan {
  const { recommandation: reco, modele, chantiersParMois } = params;

  // Durée : celle du modèle, allongée si le rythme ne suffit pas.
  const moisNecessaires =
    chantiersParMois > 0 ? Math.ceil(modele.seuil_n / chantiersParMois) : Infinity;
  const joursNecessaires = moisNecessaires * 30;

  const dureeJours = Number.isFinite(joursNecessaires)
    ? Math.min(PLAFOND_JOURS, Math.max(modele.duree_jours, joursNecessaires))
    : modele.duree_jours;

  const chantiersAttendus = Math.round((chantiersParMois * dureeJours) / 30);

  // Un test qui exigerait plus de six mois n'est pas viable, meme si le
  // calcul finit par y arriver : le marche aura change avant la conclusion,
  // et personne ne se souviendra de ce qu'on testait.
  const tropLong = Number.isFinite(joursNecessaires) && joursNecessaires > PLAFOND_JOURS;
  const viable = chantiersParMois > 0 && !tropLong && chantiersAttendus >= modele.seuil_n;

  let obstacle: string | null = null;
  if (chantiersParMois <= 0) {
    obstacle =
      'Aucun chantier récent sur ce périmètre : impossible d’estimer combien de temps le test devrait durer.';
  } else if (tropLong) {
    const mois = Math.round(joursNecessaires / 30);
    obstacle = `À ${chantiersParMois.toFixed(1)} chantier${chantiersParMois > 1 ? 's' : ''} par mois, il faudrait ${mois} mois pour réunir les ${modele.seuil_n} chantiers nécessaires. Le marché aura changé avant la conclusion — élargissez le périmètre plutôt que d’attendre.`;
  } else if (!viable) {
    obstacle = `Ce périmètre ne produira que ${chantiersAttendus} chantier${chantiersAttendus > 1 ? 's' : ''} en ${dureeJours} jours — il en faut ${modele.seuil_n}.`;
  }

  return {
    modele,
    intervention: reco.experience?.titre ?? reco.titre,
    hypothese: reco.experience?.hypothese ?? `${reco.titre} améliore les résultats.`,
    dureeJours,
    indicateur: modele.indicateur,
    seuilEffetPct: modele.seuil_effet_pct,
    seuilN: modele.seuil_n,
    chantiersAttendus,
    viable,
    obstacle,
    prerequis: modele.prerequis,
    vigilance: modele.vigilance,
  };
}

/* ==========================================================================
 * Décision finale
 * ======================================================================== */

export type DecisionFinale = 'generaliser' | 'prolonger' | 'arreter' | 'en_attente';

export interface PropositionDecision {
  decision: DecisionFinale;
  titre: string;
  justification: string;
  /** Valeur annuelle attribuable, en fourchette. null si non attribuable. */
  valeurMin: number | null;
  valeurMax: number | null;
  /** Ce qui empêche d'attribuer la valeur avec certitude. */
  reserveAttribution: string | null;
}

/**
 * Propose une décision à partir de la mesure.
 *
 * Le système PROPOSE. Il ne généralise jamais de lui-même, et ne touche
 * jamais à la grille tarifaire.
 *
 * La valeur attribuée n'est calculée QUE sur une généralisation d'un résultat
 * net. Un résultat encourageant mais fragile ne produit aucune valeur
 * chiffrée : on ne compte pas ce qu'on n'a pas prouvé.
 */
export function proposerDecision(params: {
  resultat: ResultatExperience;
  /** Gain annuel estimé au moment de la recommandation, en fourchette. */
  gainAttenduMin: number | null;
  gainAttenduMax: number | null;
}): PropositionDecision {
  const { resultat: r, gainAttenduMin, gainAttenduMax } = params;

  if (r.verdict === 'indeterminé') {
    return {
      decision: 'prolonger',
      titre: 'Prolonger',
      justification:
        'Le test n’a pas encore de quoi conclure. Prolonger coûte du temps ; conclure maintenant coûterait une mauvaise décision.',
      valeurMin: null,
      valeurMax: null,
      reserveAttribution: null,
    };
  }

  if (r.verdict === 'negatif') {
    return {
      decision: 'arreter',
      titre: 'Arrêter',
      justification: `${r.conclusion} ${r.suite}`,
      valeurMin: null,
      valeurMax: null,
      reserveAttribution: null,
    };
  }

  if (r.verdict === 'neutre') {
    return {
      decision: 'arreter',
      titre: 'Arrêter, sans regret',
      justification:
        'Aucun effet mesurable. Le test a répondu : ce levier ne produit rien sur ce périmètre. C’est une information utile, pas un échec.',
      valeurMin: null,
      valeurMax: null,
      reserveAttribution: null,
    };
  }

  // --- Verdict positif ------------------------------------------------------
  const fragile = r.reserves.length > 0;

  if (fragile) {
    return {
      decision: 'prolonger',
      titre: 'Prolonger avant de généraliser',
      justification: `${r.conclusion} Mais ${r.reserves[0]?.toLowerCase() ?? 'le résultat reste fragile'} Prolongez plutôt que de généraliser sur un doute.`,
      valeurMin: null,
      valeurMax: null,
      reserveAttribution:
        'Aucune valeur n’est comptabilisée tant que le résultat n’est pas net : on ne compte pas ce qu’on n’a pas prouvé.',
    };
  }

  // La valeur retenue est bornee par le gain attendu ET par l'effet mesure.
  // On ne peut pas attribuer plus que ce qui avait ete estime, ni plus que ce
  // que la mesure montre.
  const facteurMesure = r.ecartPct !== null ? Math.abs(r.ecartPct) / 100 : null;

  return {
    decision: 'generaliser',
    titre: 'Généraliser',
    justification: `${r.conclusion} ${r.suite}`,
    valeurMin: gainAttenduMin,
    valeurMax: gainAttenduMax,
    reserveAttribution:
      facteurMesure !== null
        ? `Effet mesuré : ${r.ecartPct! > 0 ? '+' : ''}${r.ecartPct} %. La valeur annoncée reste une estimation : le marché et la saison ont pu jouer, l’expérience ne les isole pas complètement.`
        : null,
  };
}

/* ==========================================================================
 * Valeur créée — mesure que le logiciel fait de lui-même
 * ==========================================================================
 * C'est ici qu'un logiciel est le plus tente de mentir. Trois regles :
 *
 *   1. Seules les experiences GENERALISEES comptent. Une recommandation
 *      acceptee sans test ne prouve rien.
 *   2. La valeur est celle estimee AU MOMENT DE LA RECOMMANDATION, pas
 *      recalculee apres coup pour coller au resultat.
 *   3. L'attribution est signalee comme incertaine. Le marche a pu bouger.
 * ======================================================================== */

export interface BilanValeur {
  annee: number;
  experiencesGeneralisees: number;
  experiencesArretees: number;
  experiencesProlongees: number;
  recommandationsAcceptees: number;
  recommandationsEcartees: number;
  valeurAnnuelle: number;
  /** Ce que le chiffre vaut, dit en toutes lettres. */
  qualification: string;
  /** Réserve d'attribution, toujours présente quand une valeur est annoncée. */
  reserve: string | null;
}

export function composerBilan(params: {
  annee: number;
  generalisees: number;
  arretees: number;
  prolongees: number;
  acceptees: number;
  ecartees: number;
  valeurAnnuelle: number;
}): BilanValeur {
  const { generalisees, arretees, valeurAnnuelle } = params;
  const tranchees = generalisees + arretees;

  let qualification: string;
  let reserve: string | null = null;

  if (tranchees === 0) {
    qualification =
      'Aucune expérience n’a encore été menée à son terme. Le logiciel n’a donc rien prouvé — et il ne prétend rien.';
  } else if (generalisees === 0) {
    qualification = `${arretees} expérience${arretees > 1 ? 's' : ''} menée${arretees > 1 ? 's' : ''} à son terme, aucune généralisée. Savoir ce qui ne marche pas a une valeur, mais elle ne se chiffre pas en euros.`;
  } else if (valeurAnnuelle <= 0) {
    qualification = `${generalisees} expérience${generalisees > 1 ? 's généralisées' : ' généralisée'}, sans valeur chiffrable — gain en temps ou en qualité plutôt qu’en euros.`;
  } else {
    qualification = `${generalisees} expérience${generalisees > 1 ? 's généralisées' : ' généralisée'} sur ${tranchees} tranchée${tranchees > 1 ? 's' : ''}.`;
    reserve =
      'Cette valeur est l’estimation faite au moment de la recommandation, retenue seulement pour les expériences dont le résultat était net. Elle ne prouve pas une causalité : le marché et la saison ont pu jouer.';
  }

  return {
    annee: params.annee,
    experiencesGeneralisees: generalisees,
    experiencesArretees: arretees,
    experiencesProlongees: params.prolongees,
    recommandationsAcceptees: params.acceptees,
    recommandationsEcartees: params.ecartees,
    valeurAnnuelle,
    qualification,
    reserve,
  };
}

/* ==========================================================================
 * Mémoire d'entreprise
 * ======================================================================== */

export interface EntreeMemoire {
  titre: string;
  perimetre: string | null;
  intervention: string | null;
  testDebut: string;
  testFin: string | null;
  decision: DecisionFinale;
  conclusion: string | null;
  valeurAnnuelle: number | null;
}

/**
 * Normalise les espaces.
 *
 * `toLocaleString('fr-BE')` separe les milliers par une espace fine
 * insecable (U+202F). Elle s'affiche correctement sur le web mais disparait
 * dans un PDF, et casse toute recherche de texte. Ces recits sont destines a
 * etre relus et cites : on normalise.
 */
function espaces(valeur: string): string {
  return valeur.replace(new RegExp('[\\u202f\\u2009]', 'g'), ' ');
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Récit lisible d'une expérience close.
 *
 * L'objectif est qu'on puisse relire dans trois ans : « en mars 2027, nous
 * avons testé +8 % sur les maisons 140–160 m² à Nivelles. Résultat : +11 % de
 * CA horaire, volume stable, généralisé. »
 */
export function raconter(e: EntreeMemoire): string {
  const d = new Date(e.testDebut);
  const quand = `En ${MOIS[d.getMonth()]} ${d.getFullYear()}`;

  const quoi = e.intervention ?? e.titre;
  const ou = e.perimetre ? ` sur ${e.perimetre}` : '';

  const issue: Record<DecisionFinale, string> = {
    generaliser: 'généralisé',
    arreter: 'arrêté',
    prolonger: 'prolongé',
    en_attente: 'en cours de décision',
  };

  const resultat = e.conclusion ? ` ${e.conclusion}` : '';
  const valeur =
    e.valeurAnnuelle && e.valeurAnnuelle > 0
      ? ` Valeur estimée : ${espaces(Math.round(e.valeurAnnuelle).toLocaleString('fr-BE'))} € par an.`
      : '';

  return `${quand}, nous avons testé ${quoi.toLowerCase()}${ou}.${resultat} Décision : ${issue[e.decision]}.${valeur}`;
}

/** Rappel du seuil, exporté pour l'interface. */
export { SEUIL_OBSERVATIONS };
