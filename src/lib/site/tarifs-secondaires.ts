/**
 * Tarifs des prestations secondaires : nettoyage de vehicules et de canapes.
 *
 * Source unique des montants, des durees et des textes de contenu. Ces
 * prestations ne passent pas par la grille au m² (`settings.prix_m2`) : le
 * prix depend d'un choix de base et d'options, pas d'une surface.
 *
 * Ces prestations visent des particuliers : le droit belge impose aux
 * consommateurs un prix toutes taxes comprises. Les prix des vehicules sont
 * donc fixes TVAC (montants ronds, la reference) et le HTVA en est derive ;
 * les totaux restent ainsi exacts, sans ecart d'un centime. Les canapes
 * restent definis HTVA (30 a 40 € la place) et convertis a l'affichage.
 */

export const TAUX_TVA_PARTICULIER = 0.21;

/** TVAC en euros, arrondi au centime. Calcul en centimes : pas de derive flottante. */
export function ajouterTva(htva: number): number {
  return Math.round(htva * 100 * (1 + TAUX_TVA_PARTICULIER)) / 100;
}

/** HTVA en euros, arrondi au centime, a partir d'un prix TVAC. */
export function retirerTva(tvac: number): number {
  return Math.round((tvac * 100) / (1 + TAUX_TVA_PARTICULIER)) / 100;
}

const EUR_ENTIER = new Intl.NumberFormat('fr-BE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const EUR_CENTIMES = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });

/** 90 -> « 90 € », 108,9 -> « 108,90 € » : jamais « 108,9 € ». */
export function eur(montant: number): string {
  return Number.isInteger(montant) ? EUR_ENTIER.format(montant) : EUR_CENTIMES.format(montant);
}

/** 105 -> « 1 h 45 », 90 -> « 1 h 30 », 60 -> « 1 h ». */
export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** 30, 60 -> « 30 min à 1 h » ; 60, 60 -> « 1 h ». Les durees restent indicatives. */
export function formatPlageDuree(min: number, max: number): string {
  return min === max ? formatDuree(min) : `${formatDuree(min)} à ${formatDuree(max)}`;
}

/* -------------------------------------------------------------------------- */
/* Vehicules                                                                  */
/* -------------------------------------------------------------------------- */

export interface BaseVehicule {
  nom: string;
  contenu: string;
}

/** Le prix de la base depend de la taille du vehicule ; les options, non. */
export interface TailleVehicule {
  id: 'compacte' | 'grand';
  nom: string;
  exemples: string;
  /** Nettoyage interieur, TVAC. */
  prixTvac: number;
  /** Duree de la base en minutes : un grand vehicule demande plus de temps. */
  dureeMin: number;
}

export interface OptionVehicule {
  id: 'shampouinage' | 'vapeur';
  nom: string;
  prixTvac: number;
  /** Fourchette de duree en minutes : elle depend de l'etat du vehicule. */
  dureeMin: number;
  dureeMax: number;
  contenu: string;
  /** Traitement vapeur : avertissement de compatibilite des matieres. */
  vapeur: boolean;
}

export const BASE_VEHICULE: BaseVehicule = {
  nom: 'Nettoyage intérieur',
  contenu: 'Aspiration, plastiques et garnitures, vitres.',
};

export const TAILLES_VEHICULE: readonly TailleVehicule[] = [
  {
    id: 'compacte',
    nom: 'Citadine / compacte',
    exemples: 'Polo, Clio, Golf, 208…',
    prixTvac: 70,
    dureeMin: 105,
  },
  {
    id: 'grand',
    nom: 'SUV, monospace, utilitaire',
    exemples: 'Tiguan, Espace, Berlingo, Sprinter…',
    prixTvac: 90,
    dureeMin: 130,
  },
];

/** Prix d'appel affiche sur l'accueil et dans les titres : la plus petite base. */
export const PRIX_APPEL_VEHICULE = Math.min(...TAILLES_VEHICULE.map((t) => t.prixTvac));

/** Aucune option n'en impose une autre. Pas de lavage exterieur : non propose. */
export const OPTIONS_VEHICULE: readonly OptionVehicule[] = [
  {
    id: 'shampouinage',
    nom: 'Shampouinage des sièges',
    prixTvac: 20,
    dureeMin: 15,
    dureeMax: 30,
    contenu: 'Injection-extraction des sièges, des tapis et du coffre.',
    vapeur: false,
  },
  {
    id: 'vapeur',
    nom: 'Total vapeur',
    prixTvac: 20,
    dureeMin: 15,
    dureeMax: 30,
    contenu: 'Traitement vapeur des plastiques, aérateurs, joints et ciel de toit.',
    vapeur: true,
  },
];

export const AVERTISSEMENT_VAPEUR =
  'Traitement vapeur sous réserve de compatibilité des matières (cuir, alcantara, certains velours). Test préalable sur zone non visible.';

export type IdOptionVehicule = OptionVehicule['id'];
export type IdTailleVehicule = TailleVehicule['id'];

export function calculerVehicule(
  taille: IdTailleVehicule,
  options: readonly IdOptionVehicule[],
): {
  htva: number;
  tvac: number;
  dureeMin: number;
  dureeMax: number;
} {
  const base = TAILLES_VEHICULE.find((t) => t.id === taille) ?? TAILLES_VEHICULE[0]!;
  const choisies = OPTIONS_VEHICULE.filter((o) => options.includes(o.id));
  const tvac = base.prixTvac + choisies.reduce((s, o) => s + o.prixTvac, 0);
  const dureeMin = base.dureeMin + choisies.reduce((s, o) => s + o.dureeMin, 0);
  const dureeMax = base.dureeMin + choisies.reduce((s, o) => s + o.dureeMax, 0);
  return { htva: retirerTva(tvac), tvac, dureeMin, dureeMax };
}

/* -------------------------------------------------------------------------- */
/* Canapes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Montants TVAC, comme pour les vehicules.
 *
 * Fourchette par nombre de places, selon l'etat du canape. Les paliers 2, 4,
 * 6 et 8 places sont ceux fixes par SUITON ; 1, 3, 5 et 7 places en decoulent
 * (1 place = plancher des 2 places). Au-dela de 8 places : +10 € par place.
 */
export const PRIX_CANAPE: Readonly<Record<number, { min: number; max: number }>> = {
  1: { min: 50, max: 60 },
  2: { min: 50, max: 60 },
  3: { min: 60, max: 70 },
  4: { min: 70, max: 80 },
  5: { min: 90, max: 100 },
  6: { min: 110, max: 120 },
  7: { min: 120, max: 130 },
  8: { min: 130, max: 140 },
};
export const CANAPE_PLACE_AU_DELA = 10;
const PLACES_PALIER_MAX = 8;
/** Total vapeur : un supplement forfaitaire par canape, quelle que soit sa taille. */
export const VAPEUR_CANAPE = 20;

/**
 * Black Week : option vapeur offerte sur les canapes jusqu'au 30/11 inclus,
 * heure de Bruxelles. Le tarif de reference reste VAPEUR_CANAPE ; seul le
 * simulateur et le bandeau lisent cette date, pour que l'offre s'eteigne
 * seule sans toucher a la grille.
 */
export const FIN_BLACK_WEEK = new Date('2026-12-01T00:00:00+01:00').getTime();

export function blackWeekActive(maintenant: number = Date.now()): boolean {
  return maintenant < FIN_BLACK_WEEK;
}
export const PLACES_MAX_CANAPE = 12;

export const CONTENU_VAPEUR_CANAPE =
  "Passage vapeur avant l'injection-extraction, pour assainir, traiter les taches incrustées et les odeurs.";

export function calculerCanape(
  places: number,
  vapeur: boolean,
): { min: number; max: number; supplementVapeur: number } {
  const supplementVapeur = vapeur ? VAPEUR_CANAPE : 0;
  const n = Math.min(Math.max(Math.floor(places), 1), PLACES_MAX_CANAPE);
  const palier = PRIX_CANAPE[Math.min(n, PLACES_PALIER_MAX)]!;
  const extra = Math.max(n - PLACES_PALIER_MAX, 0) * CANAPE_PLACE_AU_DELA;
  return {
    min: palier.min + extra + supplementVapeur,
    max: palier.max + extra + supplementVapeur,
    supplementVapeur,
  };
}

/* -------------------------------------------------------------------------- */
/* Matelas                                                                    */
/* -------------------------------------------------------------------------- */

export interface TailleMatelas {
  id: 'une-place' | 'deux-places' | 'grand-lit';
  nom: string;
  prixMin: number;
  prixMax: number;
}

/** Par matelas, TVAC, les deux faces. Le grand lit prolonge la progression du marche. */
export const TAILLES_MATELAS: readonly TailleMatelas[] = [
  { id: 'une-place', nom: '1 place (90 cm)', prixMin: 50, prixMax: 60 },
  { id: 'deux-places', nom: '2 places (140 à 160 cm)', prixMin: 70, prixMax: 80 },
  { id: 'grand-lit', nom: 'Grand lit (180 à 200 cm)', prixMin: 90, prixMax: 100 },
];

export const MATELAS_MAX_PAR_TAILLE = 6;

export type QuantitesMatelas = Partial<Record<TailleMatelas['id'], number>>;

export function calculerMatelas(quantites: QuantitesMatelas): {
  min: number;
  max: number;
  nombre: number;
} {
  let min = 0;
  let max = 0;
  let nombre = 0;
  for (const t of TAILLES_MATELAS) {
    const n = Math.min(Math.max(quantites[t.id] ?? 0, 0), MATELAS_MAX_PAR_TAILLE);
    min += n * t.prixMin;
    max += n * t.prixMax;
    nombre += n;
  }
  return { min, max, nombre };
}

/* -------------------------------------------------------------------------- */
/* Tapis                                                                      */
/* -------------------------------------------------------------------------- */

/** Prix du premier tapis, TVAC ; chaque tapis suivant coute moins cher (80 €, puis 100 € pour deux). */
export const PRIX_TAPIS = 80;
export const PRIX_TAPIS_SUPPLEMENTAIRE = 20;
export const TAPIS_MAX = 6;

export function calculerTapis(nombre: number): number {
  const n = Math.min(Math.max(Math.floor(nombre), 0), TAPIS_MAX);
  return n === 0 ? 0 : PRIX_TAPIS + (n - 1) * PRIX_TAPIS_SUPPLEMENTAIRE;
}

/* -------------------------------------------------------------------------- */
/* Fin de location                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Forfait unique TVAC pour un logement jusqu'a 90 m² ; au-dela, devis.
 * Refrigerateur et textiles sont hors forfait et chiffres sur demande : aucun
 * montant n'est affiche pour eux. Aucune duree n'est affichee.
 */
export const FIN_LOCATION = { forfaitTvac: 490, surfaceMax: 90 } as const;

export interface OptionFinLocation {
  id: 'frigo' | 'textiles';
  nom: string;
  contenu: string;
}

export const OPTIONS_FIN_LOCATION: readonly OptionFinLocation[] = [
  { id: 'frigo', nom: 'Réfrigérateur', contenu: "Nettoyage de l'intérieur, des bacs et des joints." },
  {
    id: 'textiles',
    nom: 'Textiles',
    contenu: 'Canapés, matelas, tapis : aux tarifs de la page nettoyage textile.',
  },
];

export type StatutFinLocation = 'forfait' | 'devis';

/** `surface` absente ou nulle : le forfait s'applique, c'est le prix d'appel affiche. */
export function calculerFinLocation(surface: number | null): {
  statut: StatutFinLocation;
  tvac: number | null;
} {
  if (surface !== null && surface > FIN_LOCATION.surfaceMax) {
    return { statut: 'devis', tvac: null };
  }
  return { statut: 'forfait', tvac: FIN_LOCATION.forfaitTvac };
}
