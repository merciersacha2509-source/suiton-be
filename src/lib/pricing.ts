import type {
  ServiceType,
  SoilLevel,
  ZoneTier,
  PropertyType,
  SettingsRow,
} from '@/types/database';

/**
 * Moteur de tarification.
 *
 * Source unique de verite : la ligne `settings` en base. La grille n'est
 * ecrite en dur nulle part — c'est ce qui permet de la modifier depuis
 * l'interface sans deploiement, et ce qui garantit que le calculateur
 * public, le devis et le tableau de bord parlent du meme prix.
 *
 * Le montant n'est JAMAIS accepte en entree d'une API : il est toujours
 * recalcule cote serveur a partir de cette grille.
 */

/**
 * Sous-ensemble de la grille necessaire au calcul public.
 *
 * Le calculateur du site et le parcours de reservation partagent ce type :
 * une seule forme de grille, donc un seul prix possible.
 */
export type GrillePublique = Pick<
  SettingsRow,
  | 'prix_m2'
  | 'coef_bien'
  | 'zones'
  | 'majoration_urgence'
  | 'seuil_surface_devis'
  | 'delai_devis_heures'
>;

export interface EstimateInput {
  service: ServiceType;
  soil: SoilLevel;
  surface_m2: number;
  zone: ZoneTier;
  urgent: boolean;
  /**
   * Type de bien. Facultatif : absent, le coefficient vaut 1 et le calcul
   * est exactement celui d'avant. Aucun devis existant ne change de montant
   * parce qu'on a ajoute ce champ.
   */
  property_type?: PropertyType;
}

export interface Estimate {
  /** Fourchette basse, TVA non comprise. */
  min: number;
  /** Fourchette haute, TVA non comprise. */
  max: number;
  /** true si la surface impose un devis sur mesure. */
  surDevis: boolean;
  detail: {
    baseMin: number;
    baseMax: number;
    fraisZone: number;
    majorationUrgence: number;
    prixM2Min: number;
    prixM2Max: number;
    coefBien: number;
  };
}

/** Arrondi commercial a 10 € : afficher 987,43 € donne une fausse precision. */
function arrondir(value: number): number {
  return Math.round(value / 10) * 10;
}

export function estimate(input: EstimateInput, settings: GrillePublique): Estimate {
  const bande = settings.prix_m2[input.service]?.[input.soil];
  if (!bande) {
    throw new Error(
      `Grille tarifaire incomplete : aucun prix pour ${input.service} / ${input.soil}.`,
    );
  }

  const zone = settings.zones[input.zone];
  const fraisZone = zone?.frais ?? 0;

  // Coefficient par type de bien. Vaut 1 tant que le dirigeant ne l'a pas
  // ajuste : ajouter cette dimension ne change aucun prix par lui-meme.
  const coefBien =
    (input.property_type ? settings.coef_bien?.[input.property_type] : undefined) ?? 1;

  const baseMin = bande.min * input.surface_m2 * coefBien;
  const baseMax = bande.max * input.surface_m2 * coefBien;

  const majorationTaux = input.urgent ? settings.majoration_urgence : 0;
  const majorationUrgence = (baseMax + fraisZone) * majorationTaux;

  const min = arrondir((baseMin + fraisZone) * (1 + majorationTaux));
  const max = arrondir((baseMax + fraisZone) * (1 + majorationTaux));

  return {
    min,
    max,
    surDevis:
      input.surface_m2 > settings.seuil_surface_devis || input.zone === 'exceptionnelle',
    detail: {
      baseMin,
      baseMax,
      fraisZone,
      majorationUrgence,
      prixM2Min: bande.min,
      prixM2Max: bande.max,
      coefBien,
    },
  };
}

/** Duree estimee, en minutes. Sert au calendrier, pas au prix. */
export function estimateDuration(input: Pick<EstimateInput, 'surface_m2' | 'soil'>): {
  min: number;
  max: number;
} {
  const cadence: Record<SoilLevel, { min: number; max: number }> = {
    leger: { min: 1.4, max: 2.0 },
    standard: { min: 2.0, max: 2.8 },
    lourd: { min: 2.8, max: 4.0 },
  };
  const c = cadence[input.soil];
  return {
    min: Math.round((input.surface_m2 * c.min) / 5) * 5,
    max: Math.round((input.surface_m2 * c.max) / 5) * 5,
  };
}
