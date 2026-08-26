import { SEUIL_OBSERVATIONS } from '@/lib/alertes';
import { niveauDepuisN } from '@/lib/intelligence';
import type { NiveauConfiance, PropertyType, ServiceType, SoilLevel } from '@/types/database';

/**
 * Moteur de recommandations.
 *
 * Il repond a une seule question : « que devrais-je faire aujourd'hui pour
 * gagner plus d'argent avec moins de temps ? »
 *
 * TROIS REGLES QUI GOUVERNENT TOUT LE MODULE
 *
 * 1. LE GAIN EST UNE FOURCHETTE, JAMAIS UN CHIFFRE.
 *    « Vous gagnerez 2 400 € » sur six chantiers est un mensonge. La borne
 *    basse suppose que le volume ne bouge pas et que la moitie des clients
 *    refusent la hausse ; la borne haute suppose l'inverse. L'ecart entre
 *    les deux EST l'information.
 *
 * 2. AUCUNE RECOMMANDATION SANS EXPLICATION COMPLETE.
 *    Chaque recommandation porte son raisonnement : les chiffres observes,
 *    le calcul du gain, les hypotheses. Une recommandation qu'on ne peut pas
 *    contester est une boite noire, et une boite noire finit par etre
 *    ignoree ou suivie aveuglement — les deux sont mauvais.
 *
 * 3. LE SYSTEME PROPOSE, IL N'APPLIQUE PAS.
 *    Aucune fonction de ce module n'ecrit dans la grille tarifaire.
 *
 * Module PUR : aucune requete. Il recoit les agregats des vues SQL.
 */

export type Famille = 'tarification' | 'planning' | 'prospection' | 'qualite' | 'productivite';
export type Urgence = 'immediate' | 'ce_mois' | 'quand_possible';

export interface Recommandation {
  /** Déterministe : même situation, même code. Permet de tracer les décisions. */
  code: string;
  famille: Famille;
  titre: string;
  action: string;

  /** Fourchette annuelle en euros. null quand le gain n'est pas chiffrable. */
  gainMin: number | null;
  gainMax: number | null;
  /** Ce que l'on gagne autrement qu'en euros : heures, retouches évitées. */
  gainNonMonetaire: string | null;

  chantiersConcernes: number;
  confiance: NiveauConfiance;
  urgence: Urgence;

  /** Le raisonnement, ligne par ligne. Aucune boîte noire. */
  explication: string[];
  /** Ce que le calcul suppose et qui pourrait être faux. */
  hypotheses: string[];

  /** Expérience contrôlée suggérée, quand la recommandation est risquée. */
  experience: {
    titre: string;
    hypothese: string;
    dureeJours: number;
  } | null;

  /** Score de priorisation. Interne. */
  score: number;
}

/* ==========================================================================
 * Entrées — issues des vues SQL
 * ======================================================================== */

export interface SegmentVolume {
  service: ServiceType;
  property_type: PropertyType;
  bande: string;
  soil: SoilLevel;
  chantiers: number;
  jours_couverts: number;
  panier_median: number | null;
  ca_horaire: number | null;
}

export interface SegmentRendement {
  techniciens: number;
  taille: 'petite' | 'grande';
  n: number;
  cadence: number | null;
}

export interface SegmentCommune {
  commune: string;
  chantiers: number;
  ca_horaire: number | null;
  panier: number | null;
  recurrence_pct: number | null;
  conversion_pct: number | null;
}

export interface SegmentRetouches {
  service: ServiceType;
  chantiers: number;
  retouches: number;
}

export interface SegmentEtape {
  ordre: number;
  libelle: string | null;
  observations: number;
  mediane_min: number | null;
  p90_min: number | null;
}

export interface EntreesRecommandations {
  volumes: SegmentVolume[];
  rendements: SegmentRendement[];
  communes: SegmentCommune[];
  retouches: SegmentRetouches[];
  etapes: SegmentEtape[];
  caHoraireGlobal: number | null;
  chantiersComplets: number;
  /** Codes déjà rejetés : on ne les repropose pas. */
  codesRejetes: string[];
}

/* ==========================================================================
 * Libellés
 * ======================================================================== */

const BIENS: Record<PropertyType, string> = {
  studio: 'studios',
  appartement: 'appartements',
  maison: 'maisons',
  villa: 'villas',
  bureaux: 'bureaux',
  commerce: 'commerces',
  autre: 'biens divers',
};

const BANDES: Record<string, string> = {
  xs: 'moins de 60 m²',
  s: '60–110 m²',
  m: '110–180 m²',
  l: '180–300 m²',
  xl: 'plus de 300 m²',
};

const SERVICES: Record<ServiceType, string> = {
  fin_de_chantier: 'fin de travaux',
  vitres: 'vitres',
};

const eur = (v: number) => `${Math.round(v).toLocaleString('fr-BE')} €`;

/* ==========================================================================
 * Volume annuel — la brique de tout calcul de gain
 * ======================================================================== */

/**
 * Extrapole un volume annuel depuis l'historique observé.
 *
 * L'extrapolation est plafonnée : projeter une année entière depuis trois
 * semaines d'activité donnerait des chiffres absurdes. Sous 60 jours
 * d'historique, on ne projette pas — on renvoie le volume observé tel quel,
 * et l'appelant sait que le gain annoncé est un plancher.
 */
export function volumeAnnuel(segment: { chantiers: number; jours_couverts: number }): {
  estime: number;
  extrapole: boolean;
} {
  if (segment.jours_couverts < 60) {
    return { estime: segment.chantiers, extrapole: false };
  }
  const parJour = segment.chantiers / segment.jours_couverts;
  return { estime: Math.round(parJour * 365), extrapole: true };
}

/* ==========================================================================
 * Famille 1 — Tarification
 * ======================================================================== */

/**
 * Segments dont le CA horaire est nettement sous la moyenne.
 *
 * La hausse recommandee est calibree pour ramener le segment a la moyenne,
 * PLAFONNEE A 15 %. Au-dela, on ne recommande pas : on suggere une
 * experience controlee. Une hausse de 30 % annoncee comme sure sur huit
 * chantiers est une facon rapide de perdre un segment entier.
 */
function recoTarification(e: EntreesRecommandations): Recommandation[] {
  if (e.caHoraireGlobal === null || e.caHoraireGlobal <= 0) return [];

  const sorties: Recommandation[] = [];

  for (const s of e.volumes) {
    if (s.chantiers < SEUIL_OBSERVATIONS || s.ca_horaire === null || s.panier_median === null) {
      continue;
    }

    const ecart = (s.ca_horaire - e.caHoraireGlobal) / e.caHoraireGlobal;
    if (ecart > -0.12) continue;

    const rattrapage = Math.min(0.15, Math.abs(ecart));
    const volume = volumeAnnuel(s);
    const hausseParChantier = s.panier_median * rattrapage;

    // Borne basse : la moitie du volume seulement accepte la hausse.
    // Borne haute : tout le volume l'accepte.
    // L'ecart entre les deux est l'incertitude reelle, et elle est enorme.
    const gainMin = hausseParChantier * volume.estime * 0.5;
    const gainMax = hausseParChantier * volume.estime;

    const segment = `${BIENS[s.property_type]} ${BANDES[s.bande] ?? s.bande}`;
    const code = `tarif:${s.service}:${s.property_type}:${s.bande}:${s.soil}`;

    sorties.push({
      code,
      famille: 'tarification',
      titre: `Augmenter de ${Math.round(rattrapage * 100)} % les ${segment}`,
      action: `Passer le panier médian de ${eur(s.panier_median)} à ${eur(s.panier_median * (1 + rattrapage))} HTVA sur ce gabarit.`,
      gainMin: Math.round(gainMin),
      gainMax: Math.round(gainMax),
      gainNonMonetaire: null,
      chantiersConcernes: s.chantiers,
      confiance: niveauDepuisN(s.chantiers),
      urgence: Math.abs(ecart) > 0.25 ? 'immediate' : 'ce_mois',
      explication: [
        `Ce segment rapporte ${eur(s.ca_horaire)}/h contre ${eur(e.caHoraireGlobal)}/h en moyenne, soit ${Math.round(Math.abs(ecart) * 100)} % de moins.`,
        `Panier médian actuel : ${eur(s.panier_median)} HTVA sur ${s.chantiers} chantiers.`,
        volume.extrapole
          ? `Volume annuel projeté : ${volume.estime} chantiers, extrapolé depuis ${s.jours_couverts} jours d'historique.`
          : `Volume observé : ${s.chantiers} chantiers sur ${s.jours_couverts} jours. Trop peu d'historique pour projeter une année — le gain annoncé est un plancher.`,
        `Gain = ${eur(hausseParChantier)} par chantier × ${volume.estime} chantiers, avec un taux d'acceptation entre 50 % et 100 %.`,
      ],
      hypotheses: [
        'Le volume ne baisse pas après la hausse. C’est l’hypothèse la plus fragile : un client sur deux peut refuser.',
        volume.extrapole
          ? 'Le rythme des douze prochains mois ressemble à celui observé.'
          : 'Aucune projection annuelle : le gain est calculé sur le volume déjà réalisé.',
        'La marge suit le prix — donc que les coûts ne montent pas en parallèle.',
      ],
      experience: {
        titre: `+${Math.round(rattrapage * 100)} % sur les ${segment}`,
        hypothese: `Une hausse de ${Math.round(rattrapage * 100)} % sur ce gabarit ne fait pas chuter le taux d'acceptation des devis.`,
        dureeJours: 60,
      },
      score: gainMin * poidsConfiance(niveauDepuisN(s.chantiers)),
    });
  }

  return sorties;
}

/* ==========================================================================
 * Famille 2 — Planning
 * ======================================================================== */

function recoPlanning(e: EntreesRecommandations): Recommandation[] {
  const petites = e.rendements.filter(
    (r) => r.taille === 'petite' && r.n >= SEUIL_OBSERVATIONS,
  );
  const seul = petites.find((r) => r.techniciens === 1);
  if (!seul || seul.cadence === null || e.caHoraireGlobal === null) return [];

  const sorties: Recommandation[] = [];

  for (const r of petites.filter((x) => x.techniciens >= 3)) {
    if (r.cadence === null) continue;

    const attendu = seul.cadence / r.techniciens;
    const perte = (r.cadence - attendu) / attendu;
    if (perte < 0.1) continue;

    // Heures perdues : la difference de cadence, sur un chantier type de
    // 120 m², multipliee par le volume observe.
    const minutesPerdues = (r.cadence - attendu) * 120;
    const heuresAn = (minutesPerdues * r.n) / 60;
    const gain = heuresAn * e.caHoraireGlobal;

    sorties.push({
      code: `planning:sureffectif:${r.techniciens}`,
      famille: 'planning',
      titre: `Ne plus envoyer ${r.techniciens} personnes sur moins de 150 m²`,
      action: `Deux suffisent. La troisième dégage ${Math.round(perte * 100)} % de perte de rendement : mieux vaut l'affecter à un second chantier.`,
      gainMin: Math.round(gain * 0.5),
      gainMax: Math.round(gain),
      gainNonMonetaire: `≈ ${Math.round(heuresAn)} h de main-d'œuvre libérées`,
      chantiersConcernes: r.n,
      confiance: niveauDepuisN(r.n),
      urgence: 'quand_possible',
      explication: [
        `À 1 technicien : ${seul.cadence.toFixed(2)} min/m². À ${r.techniciens} : ${r.cadence.toFixed(2)} min/m².`,
        `Attendu à ${r.techniciens} si le rendement était proportionnel : ${attendu.toFixed(2)} min/m².`,
        `Écart constaté : ${Math.round(perte * 100)} % de rendement perdu, observé sur ${r.n} chantiers.`,
        `Valorisé au CA horaire moyen de ${eur(e.caHoraireGlobal)}/h.`,
      ],
      hypotheses: [
        'La personne libérée est réaffectée à un chantier facturé — sinon le gain est nul.',
        'La perte vient de l’effectif, pas de chantiers structurellement plus difficiles qui justifieraient d’y mettre trois personnes.',
      ],
      experience: null,
      score: gain * 0.5 * poidsConfiance(niveauDepuisN(r.n)),
    });
  }

  return sorties;
}

/* ==========================================================================
 * Famille 3 — Prospection
 * ======================================================================== */

function recoProspection(e: EntreesRecommandations): Recommandation[] {
  if (e.caHoraireGlobal === null || e.caHoraireGlobal <= 0) return [];

  const fortes = e.communes
    .filter((c) => c.chantiers >= SEUIL_OBSERVATIONS && c.ca_horaire !== null)
    .filter((c) => (c.ca_horaire as number) > e.caHoraireGlobal! * 1.12)
    .sort((a, b) => (b.ca_horaire as number) - (a.ca_horaire as number))
    .slice(0, 3);

  if (fortes.length === 0) return [];

  const noms = fortes.map((c) => c.commune);
  const surplusMoyen =
    fortes.reduce((s, c) => s + ((c.ca_horaire as number) - e.caHoraireGlobal!), 0) /
    fortes.length;

  // Un chantier gagne dans une commune forte plutot qu'ailleurs rapporte le
  // surplus horaire × la duree moyenne d'un chantier (≈ 5 h).
  const gainParChantier = surplusMoyen * 5;

  return [
    {
      code: `prospection:${noms.join('+')}`,
      famille: 'prospection',
      titre: `Concentrer la prospection sur ${noms.join(' et ')}`,
      action: `Ces communes dégagent ${eur(surplusMoyen)}/h de plus que votre moyenne. Chaque chantier gagné y rapporte environ ${eur(gainParChantier)} de plus qu'ailleurs.`,
      gainMin: Math.round(gainParChantier * 5),
      gainMax: Math.round(gainParChantier * 15),
      gainNonMonetaire: 'Trajets plus courts, donc plus de chantiers par semaine',
      chantiersConcernes: fortes.reduce((s, c) => s + c.chantiers, 0),
      confiance: niveauDepuisN(Math.min(...fortes.map((c) => c.chantiers))),
      urgence: 'ce_mois',
      explication: [
        ...fortes.map(
          (c) =>
            `${c.commune} : ${eur(c.ca_horaire as number)}/h sur ${c.chantiers} chantiers${
              c.recurrence_pct !== null && c.recurrence_pct > 0
                ? `, ${Math.round(c.recurrence_pct)} % de clients revenus`
                : ''
            }.`,
        ),
        `Moyenne toutes communes : ${eur(e.caHoraireGlobal)}/h.`,
        `Gain estimé sur 5 à 15 chantiers supplémentaires gagnés dans ces communes.`,
      ],
      hypotheses: [
        'La prospection convertit — 5 à 15 chantiers supplémentaires est une hypothèse, pas une mesure.',
        'Ces communes restent aussi rentables à volume plus élevé.',
      ],
      experience: null,
      score:
        gainParChantier *
        5 *
        poidsConfiance(niveauDepuisN(Math.min(...fortes.map((c) => c.chantiers)))),
    },
  ];
}

/* ==========================================================================
 * Famille 4 — Qualité
 * ======================================================================== */

function recoQualite(e: EntreesRecommandations): Recommandation[] {
  const total = e.retouches.reduce((s, r) => s + r.retouches, 0);
  if (total < 3 || e.caHoraireGlobal === null) return [];

  const sorties: Recommandation[] = [];

  for (const r of e.retouches) {
    if (r.chantiers < SEUIL_OBSERVATIONS || r.retouches === 0) continue;

    const part = (r.retouches * 100) / total;
    if (part < 40) continue;

    // Une retouche coute un deplacement et environ deux heures.
    const coutRetouche = e.caHoraireGlobal * 2;
    const gain = r.retouches * coutRetouche;

    sorties.push({
      code: `qualite:retouches:${r.service}`,
      famille: 'qualite',
      titre: `Reprendre la procédure « ${SERVICES[r.service]} »`,
      action: `Ce poste concentre ${Math.round(part)} % de vos retouches. Chaque retouche coûte un déplacement et environ deux heures non facturées.`,
      gainMin: Math.round(gain * 0.4),
      gainMax: Math.round(gain * 0.8),
      gainNonMonetaire: `${r.retouches} retouche${r.retouches > 1 ? 's' : ''} évitable${r.retouches > 1 ? 's' : ''}`,
      chantiersConcernes: r.chantiers,
      confiance: niveauDepuisN(r.chantiers),
      urgence: part > 60 ? 'immediate' : 'ce_mois',
      explication: [
        `${r.retouches} retouche${r.retouches > 1 ? 's' : ''} sur ${total} au total, soit ${Math.round(part)} %.`,
        `Observé sur ${r.chantiers} chantiers de ce service.`,
        `Coût d'une retouche estimé à 2 h non facturées, soit ${eur(coutRetouche)} au CA horaire moyen.`,
        `Gain si 40 à 80 % de ces retouches sont évitées.`,
      ],
      hypotheses: [
        'Une correction de procédure élimine réellement une partie des retouches — c’est plausible, pas garanti.',
        'Une retouche coûte deux heures : c’est une estimation, pas une mesure. Le temps réel n’est pas encore enregistré.',
      ],
      experience: {
        titre: `Renforcer le contrôle « ${SERVICES[r.service]} »`,
        hypothese: `Un contrôle en lumière rasante systématique sur ce poste divise les retouches par deux.`,
        dureeJours: 90,
      },
      score: gain * 0.4 * poidsConfiance(niveauDepuisN(r.chantiers)),
    });
  }

  return sorties;
}

/* ==========================================================================
 * Famille 5 — Productivité
 * ======================================================================== */

/**
 * Etapes dont le p90 s'ecarte fortement de la mediane.
 *
 * Un p90 tres au-dessus de la mediane signale une etape qui derape parfois —
 * et c'est justement celle qu'on peut corriger, contrairement a une etape
 * uniformement lente qui est simplement longue par nature.
 */
function recoProductivite(e: EntreesRecommandations): Recommandation[] {
  if (e.caHoraireGlobal === null) return [];

  const sorties: Recommandation[] = [];

  for (const etape of e.etapes) {
    if (etape.observations < SEUIL_OBSERVATIONS) continue;
    if (etape.mediane_min === null || etape.p90_min === null || etape.mediane_min <= 0)
      continue;

    const dispersion = (etape.p90_min - etape.mediane_min) / etape.mediane_min;
    if (dispersion < 0.8) continue;

    const minutesPerduesParChantier = (etape.p90_min - etape.mediane_min) * 0.1; // 10 % des chantiers
    const gainAn = ((minutesPerduesParChantier * etape.observations) / 60) * e.caHoraireGlobal;

    sorties.push({
      code: `productivite:etape:${etape.ordre}`,
      famille: 'productivite',
      titre: `L'étape « ${etape.libelle ?? `n° ${etape.ordre}`} » dérape un chantier sur dix`,
      action: `Médiane ${Math.round(etape.mediane_min)} min, mais ${Math.round(etape.p90_min)} min sur les 10 % les plus longs. Identifier ce qui distingue ces chantiers.`,
      gainMin: Math.round(gainAn * 0.3),
      gainMax: Math.round(gainAn * 0.7),
      gainNonMonetaire: `≈ ${Math.round((minutesPerduesParChantier * etape.observations) / 60)} h récupérables`,
      chantiersConcernes: etape.observations,
      confiance: niveauDepuisN(etape.observations),
      urgence: 'quand_possible',
      explication: [
        `Médiane : ${Math.round(etape.mediane_min)} min. p90 : ${Math.round(etape.p90_min)} min.`,
        `Écart de ${Math.round(dispersion * 100)} % entre le cas courant et les chantiers difficiles.`,
        `Mesuré sur ${etape.observations} chantiers.`,
        `Une étape uniformément lente est simplement longue ; une étape dispersée est corrigeable.`,
      ],
      hypotheses: [
        'Les chantiers qui dérapent partagent une cause identifiable — matériel, accès, type de salissure.',
        'Le temps par étape est fiable, donc que la checklist est cochée au fur et à mesure.',
      ],
      experience: null,
      score: gainAn * 0.3 * poidsConfiance(niveauDepuisN(etape.observations)),
    });
  }

  return sorties;
}

/* ==========================================================================
 * Priorisation
 * ======================================================================== */

/**
 * Poids de confiance dans le score.
 *
 * Une recommandation a 2 000 € de gain sur 5 chantiers ne vaut pas une
 * recommandation a 2 000 € sur 40. Le poids ecrase deliberement les
 * recommandations faiblement fondees : mieux vaut rater une opportunite que
 * d'engager une hausse tarifaire sur du bruit.
 */
function poidsConfiance(niveau: NiveauConfiance): number {
  switch (niveau) {
    case 'elevee':
      return 1;
    case 'bonne':
      return 0.7;
    case 'moyenne':
      return 0.4;
    case 'faible':
      return 0.15;
    default:
      return 0;
  }
}

const POIDS_URGENCE: Record<Urgence, number> = {
  immediate: 1.3,
  ce_mois: 1,
  quand_possible: 0.8,
};

/**
 * Produit les recommandations, classées par ROI estimé.
 *
 * Le classement multiplie le gain minimal — jamais le maximal — par le poids
 * de confiance et celui d'urgence. Classer sur le gain maximal placerait en
 * tête les paris les plus optimistes.
 */
export function produireRecommandations(
  e: EntreesRecommandations,
  limite = 5,
): Recommandation[] {
  const toutes = [
    ...recoTarification(e),
    ...recoPlanning(e),
    ...recoProspection(e),
    ...recoQualite(e),
    ...recoProductivite(e),
  ];

  const rejetes = new Set(e.codesRejetes);

  return toutes
    .filter((r) => !rejetes.has(r.code))
    .filter((r) => r.confiance !== 'aucune')
    .map((r) => ({ ...r, score: r.score * POIDS_URGENCE[r.urgence] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

/** Gain cumulé des recommandations retenues. Fourchette, jamais un point. */
export function gainCumule(recommandations: Recommandation[]): {
  min: number;
  max: number;
} {
  return recommandations.reduce(
    (acc, r) => ({ min: acc.min + (r.gainMin ?? 0), max: acc.max + (r.gainMax ?? 0) }),
    { min: 0, max: 0 },
  );
}

export function raisonAucuneRecommandation(chantiersComplets: number): string {
  if (chantiersComplets === 0) {
    return 'Aucun chantier terminé et facturé. Le moteur a besoin de chantiers réels pour proposer autre chose que des généralités.';
  }
  if (chantiersComplets < SEUIL_OBSERVATIONS) {
    return `${chantiersComplets} chantier${chantiersComplets > 1 ? 's' : ''} facturé${chantiersComplets > 1 ? 's' : ''}. Il en faut au moins ${SEUIL_OBSERVATIONS} par segment pour qu'une recommandation repose sur autre chose que le hasard — et une mauvaise recommandation coûte plus cher qu'aucune.`;
  }
  return 'Aucun écart suffisamment net pour justifier une action. Votre tarification et votre organisation correspondent à ce que mesurent vos chantiers.';
}
