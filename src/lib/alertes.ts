import { SEUILS_CONFIANCE, niveauDepuisN } from '@/lib/intelligence';
import type { NiveauConfiance, PropertyType, ServiceType, SoilLevel } from '@/types/database';

/**
 * Moteur d'alertes.
 *
 * Une alerte n'est utile que si elle est ACTIONNABLE : elle doit dire ce qui
 * se passe, de combien, et quoi en faire. « Attention aux marges » n'aide
 * personne ; « les maisons de 140 a 180 m² sont sous-facturees de 18 %,
 * relevez la grille de 1,20 €/m² » se traduit en decision.
 *
 * Deux garde-fous, appliques sans exception :
 *
 *   1. SEUIL MINIMAL. Aucune alerte sous 5 observations. Un ecart mesure sur
 *      trois chantiers mesure le hasard, pas une tendance — et une alerte
 *      fausse coute plus cher qu'une alerte absente : elle fait perdre
 *      confiance dans toutes les autres.
 *
 *   2. AMPLITUDE MINIMALE. Un ecart de 4 % ne justifie pas d'agir. Chaque
 *      regle porte son propre seuil d'amplitude, calibre sur ce qui change
 *      reellement une decision.
 *
 * Module PUR : aucune requete, aucune dependance serveur. Il recoit les
 * agregats calcules par les vues SQL et en tire des phrases.
 */

export const SEUIL_OBSERVATIONS = SEUILS_CONFIANCE.moyenne; // 5

export type GraviteAlerte = 'opportunite' | 'attention' | 'critique';

export interface Alerte {
  /** Identifiant stable : sert de clé de rendu et de suivi. */
  code: string;
  gravite: GraviteAlerte;
  titre: string;
  /** Ce qu'il faut faire. Une alerte sans action est un constat inutile. */
  action: string;
  n: number;
  confiance: NiveauConfiance;
  /** Ordre d'affichage : plus élevé = plus haut. */
  poids: number;
}

/* ==========================================================================
 * Entrées
 * ======================================================================== */

export interface LigneEcartTarifaire {
  property_type: PropertyType;
  bande: string;
  soil: SoilLevel;
  service: ServiceType;
  n: number;
  facture_mediane: number | null;
  ca_horaire: number | null;
}

export interface LigneRendementEffectif {
  techniciens: number;
  taille: 'petite' | 'grande';
  n: number;
  cadence: number | null;
}

export interface LigneRetouches {
  service: ServiceType;
  chantiers: number;
  retouches: number;
  part_pct: number | null;
}

export interface LigneCommune {
  commune: string;
  chantiers: number;
  ca_horaire: number | null;
  recurrence_pct: number | null;
  conversion_pct: number | null;
}

export interface EntreesAlertes {
  ecarts: LigneEcartTarifaire[];
  rendements: LigneRendementEffectif[];
  retouches: LigneRetouches[];
  communes: LigneCommune[];
  /** Référence globale du CA horaire, pour comparer les segments entre eux. */
  caHoraireGlobal: number | null;
  /** Précision des estimations, en %. */
  precisionEstimation: number | null;
  couvertureMoyenne: number | null;
  checklistsSuspectes: number;
  chantiersComplets: number;
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
  autre: 'biens',
};

const BANDES: Record<string, string> = {
  xs: 'moins de 60 m²',
  s: '60 à 110 m²',
  m: '110 à 180 m²',
  l: '180 à 300 m²',
  xl: 'plus de 300 m²',
};

const SERVICES: Record<ServiceType, string> = {
  fin_de_chantier: 'fin de travaux',
  vitres: 'vitres',
};

const SALISSURES: Record<SoilLevel, string> = {
  standard: 'salissure standard',
  lourd: 'salissure lourde',
};

const pct = (v: number) => `${Math.abs(Math.round(v))} %`;

/* ==========================================================================
 * Règles
 * ======================================================================== */

/**
 * Segments dont le CA horaire s'écarte franchement de la moyenne.
 *
 * C'est l'alerte qui rapporte le plus : elle identifie ce qu'il faut
 * repricer, et ce qu'il faut arrêter de brader.
 */
function reglesEcartTarifaire(e: EntreesAlertes): Alerte[] {
  if (e.caHoraireGlobal === null || e.caHoraireGlobal <= 0) return [];

  const alertes: Alerte[] = [];

  for (const ligne of e.ecarts) {
    if (ligne.n < SEUIL_OBSERVATIONS || ligne.ca_horaire === null) continue;

    const ecart = (ligne.ca_horaire - e.caHoraireGlobal) / e.caHoraireGlobal;

    // 12 % : en deçà, l'écart tient à la composition des chantiers, pas au
    // tarif.
    if (Math.abs(ecart) < 0.12) continue;

    const segment = `${BIENS[ligne.property_type]} de ${BANDES[ligne.bande] ?? ligne.bande}, ${SALISSURES[ligne.soil]}`;

    if (ecart < 0) {
      alertes.push({
        code: `sous-facturation:${ligne.property_type}:${ligne.bande}:${ligne.soil}`,
        gravite: Math.abs(ecart) > 0.25 ? 'critique' : 'attention',
        titre: `Les ${segment} rapportent ${pct(ecart * 100)} de moins à l'heure que votre moyenne.`,
        action:
          ligne.facture_mediane !== null
            ? `Panier médian ${Math.round(ligne.facture_mediane)} € HTVA. Relevez la grille sur ce gabarit, ou refusez-les : à ce rythme ils occupent des journées qui rapporteraient plus ailleurs.`
            : 'Relevez la grille sur ce gabarit, ou vérifiez les remises accordées.',
        n: ligne.n,
        confiance: niveauDepuisN(ligne.n),
        poids: 100 + Math.abs(ecart) * 100,
      });
    } else {
      alertes.push({
        code: `surperformance:${ligne.property_type}:${ligne.bande}:${ligne.soil}`,
        gravite: 'opportunite',
        titre: `Les ${segment} rapportent ${pct(ecart * 100)} de plus à l'heure que votre moyenne.`,
        action: `C'est votre meilleur segment. Orientez la prospection dessus — et vérifiez que la grille n'est pas simplement sous-évaluée ailleurs.`,
        n: ligne.n,
        confiance: niveauDepuisN(ligne.n),
        poids: 70 + ecart * 100,
      });
    }
  }

  return alertes;
}

/**
 * Sureffectif sur petite surface.
 *
 * À deux, on se croise ; à trois sur 90 m², on se gêne. L'alerte compare la
 * cadence réelle à effectifs différents plutôt que de postuler une règle.
 */
function regleSureffectif(e: EntreesAlertes): Alerte[] {
  const petites = e.rendements.filter(
    (r) => r.taille === 'petite' && r.n >= SEUIL_OBSERVATIONS,
  );
  const seul = petites.find((r) => r.techniciens === 1);
  const plusieurs = petites.filter((r) => r.techniciens >= 3);

  if (!seul || seul.cadence === null || plusieurs.length === 0) return [];

  const alertes: Alerte[] = [];

  for (const r of plusieurs) {
    if (r.cadence === null) continue;

    // Cadence en min/m² PAR CHANTIER : à effectif multiple, elle devrait
    // baisser proportionnellement. Si elle ne baisse pas assez, l'équipe
    // se gêne.
    const attendu = seul.cadence / r.techniciens;
    const perte = (r.cadence - attendu) / attendu;

    if (perte < 0.1) continue;

    alertes.push({
      code: `sureffectif:${r.techniciens}`,
      gravite: perte > 0.25 ? 'attention' : 'opportunite',
      titre: `À ${r.techniciens} sur moins de 150 m², vous perdez ${pct(perte * 100)} de rendement.`,
      action: `Sur ces surfaces, deux personnes suffisent. La troisième produit ${pct(perte * 100)} de perte : mieux vaut l'envoyer sur un second chantier.`,
      n: r.n,
      confiance: niveauDepuisN(r.n),
      poids: 80 + perte * 50,
    });
  }

  return alertes;
}

/** Concentration des retouches sur un service. */
function regleRetouches(e: EntreesAlertes): Alerte[] {
  const total = e.retouches.reduce((s, r) => s + r.retouches, 0);
  if (total < 3) return [];

  const alertes: Alerte[] = [];

  for (const r of e.retouches) {
    if (r.chantiers < SEUIL_OBSERVATIONS || r.retouches === 0) continue;

    const part = (r.retouches * 100) / total;
    // 40 % des retouches concentrées sur un service : ce n'est plus le hasard.
    if (part < 40) continue;

    alertes.push({
      code: `retouches:${r.service}`,
      gravite: part > 60 ? 'critique' : 'attention',
      titre: `${Math.round(part)} % de vos retouches concernent le poste « ${SERVICES[r.service]} ».`,
      action: `Reprenez l'étape correspondante de la procédure : soit elle est bâclée, soit elle est mal chiffrée en temps. Le détail par étape le dira.`,
      n: r.chantiers,
      confiance: niveauDepuisN(r.chantiers),
      poids: 90 + part / 2,
    });
  }

  return alertes;
}

/** Communes qui se détachent, à la hausse comme à la baisse. */
function reglesCommunes(e: EntreesAlertes): Alerte[] {
  if (e.caHoraireGlobal === null || e.caHoraireGlobal <= 0) return [];

  const alertes: Alerte[] = [];

  for (const c of e.communes) {
    if (c.chantiers < SEUIL_OBSERVATIONS || c.ca_horaire === null) continue;

    const ecart = (c.ca_horaire - e.caHoraireGlobal) / e.caHoraireGlobal;
    if (Math.abs(ecart) < 0.12) continue;

    if (ecart > 0) {
      alertes.push({
        code: `commune-forte:${c.commune}`,
        gravite: 'opportunite',
        titre: `${c.commune} dégage ${pct(ecart * 100)} de marge horaire de plus que votre moyenne.`,
        action:
          c.recurrence_pct !== null && c.recurrence_pct >= 25
            ? `Et ${Math.round(c.recurrence_pct)} % des clients y reviennent. C'est là qu'il faut prospecter.`
            : `Concentrez-y la prospection : trajets courts, chantiers rentables.`,
        n: c.chantiers,
        confiance: niveauDepuisN(c.chantiers),
        poids: 75 + ecart * 60,
      });
    } else {
      alertes.push({
        code: `commune-faible:${c.commune}`,
        gravite: 'attention',
        titre: `${c.commune} rapporte ${pct(ecart * 100)} de moins à l'heure que votre moyenne.`,
        action: `Vérifiez le temps de trajet : s'il est long, le forfait de déplacement ne le couvre pas.`,
        n: c.chantiers,
        confiance: niveauDepuisN(c.chantiers),
        poids: 60 + Math.abs(ecart) * 60,
      });
    }
  }

  return alertes;
}

/** Estimations systématiquement fausses : la grille est à revoir. */
function regleEstimation(e: EntreesAlertes): Alerte[] {
  if (e.chantiersComplets < SEUIL_OBSERVATIONS || e.precisionEstimation === null) return [];
  if (e.precisionEstimation >= 60) return [];

  return [
    {
      code: 'estimation-imprecise',
      gravite: e.precisionEstimation < 40 ? 'critique' : 'attention',
      titre: `Seuls ${Math.round(e.precisionEstimation)} % de vos chantiers tiennent dans la fourchette estimée.`,
      action:
        'La grille de durées ne décrit plus votre réalité. Les références observées, elles, sont à jour : basez vos prochains devis dessus.',
      n: e.chantiersComplets,
      confiance: niveauDepuisN(e.chantiersComplets),
      poids: 95,
    },
  ];
}

/** Couverture photo insuffisante : la promesse commerciale n'est pas tenue. */
function regleCouverture(e: EntreesAlertes): Alerte[] {
  if (e.chantiersComplets < SEUIL_OBSERVATIONS || e.couvertureMoyenne === null) return [];
  if (e.couvertureMoyenne >= 70) return [];

  return [
    {
      code: 'couverture-photo',
      gravite: e.couvertureMoyenne < 40 ? 'critique' : 'attention',
      titre: `Couverture photo moyenne de ${Math.round(e.couvertureMoyenne)} %.`,
      action:
        'Le rapport avant/après est votre argument de vente et votre protection en cas de litige. Une paire par pièce, systématiquement.',
      n: e.chantiersComplets,
      confiance: niveauDepuisN(e.chantiersComplets),
      poids: 85,
    },
  ];
}

/**
 * Checklists cochées après coup.
 *
 * Pas de seuil d'observations ici : une seule suffit à alerter. Ce n'est pas
 * une tendance statistique mais un défaut de procédure, et il fausse la base
 * de référence de façon permanente.
 */
function regleChecklistsSuspectes(e: EntreesAlertes): Alerte[] {
  if (e.checklistsSuspectes === 0) return [];

  return [
    {
      code: 'checklists-suspectes',
      gravite: 'attention',
      titre: `${e.checklistsSuspectes} chantier${e.checklistsSuspectes > 1 ? 's ont' : ' a'} sa checklist cochée après coup.`,
      action:
        'Ces chantiers sont exclus des références — leurs durées ne mesurent rien. Cocher au fur et à mesure prend dix secondes et rend la procédure opposable.',
      n: e.checklistsSuspectes,
      confiance: 'elevee',
      poids: 65,
    },
  ];
}

/* ==========================================================================
 * Assemblage
 * ======================================================================== */

/**
 * Produit les alertes, triées par priorité.
 *
 * Plafonnées à six : au-delà, une liste d'alertes devient un mur qu'on cesse
 * de lire, et la septième dilue la première.
 */
export function produireAlertes(e: EntreesAlertes, limite = 6): Alerte[] {
  const toutes = [
    ...reglesEcartTarifaire(e),
    ...regleSureffectif(e),
    ...regleRetouches(e),
    ...reglesCommunes(e),
    ...regleEstimation(e),
    ...regleCouverture(e),
    ...regleChecklistsSuspectes(e),
  ];

  const ordre: Record<GraviteAlerte, number> = { critique: 3, attention: 2, opportunite: 1 };

  return toutes
    .sort((a, b) => ordre[b.gravite] - ordre[a.gravite] || b.poids - a.poids)
    .slice(0, limite);
}

/**
 * Message affiché quand aucune alerte ne peut être produite.
 *
 * Un bloc d'alertes vide sans explication laisse croire que tout va bien.
 * Il faut dire pourquoi il est vide.
 */
export function raisonAucuneAlerte(chantiersComplets: number): string {
  if (chantiersComplets === 0) {
    return 'Aucun chantier terminé et facturé. Les alertes apparaîtront dès que le système aura de quoi comparer.';
  }
  if (chantiersComplets < SEUIL_OBSERVATIONS) {
    return `${chantiersComplets} chantier${chantiersComplets > 1 ? 's' : ''} facturé${chantiersComplets > 1 ? 's' : ''} : il en faut au moins ${SEUIL_OBSERVATIONS} par segment pour qu'un écart signifie autre chose que le hasard.`;
  }
  return 'Aucun écart significatif détecté sur vos segments. C’est une bonne nouvelle : votre grille tarifaire correspond à votre réalité.';
}
