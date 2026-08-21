import type { Emetteur, PaireAvantApres, Partie } from '@/lib/pdf/blocks';
import type { LigneDocument } from '@/lib/pdf/quote-data';

/**
 * Contrats de donnees des sept documents.
 *
 * Aucun ne contient de logique : ce sont des donnees deja formatees, pretes
 * a poser sur la page. Le calcul vit dans `compose.ts`, le rendu dans les
 * composants — cette separation est ce qui rend les regles metier testables
 * sans jamais rendre un PDF.
 */

export interface DonneesCommunes {
  numero: string;
  emetteur: Emetteur;
}

/* --- Devis --------------------------------------------------------------- */
export interface DonneesDevis extends DonneesCommunes {
  dateEmission: string;
  validiteJours: number;
  valideJusquAu: string;
  client: Partie;
  chantier: {
    typePrestation: string;
    adresse?: string;
    codePostal?: string;
    commune: string;
    dateSouhaitee: string;
    surface: string;
    dureeEstimee: string;
  };
  lignes: LigneDocument[];
  sousTotal: string;
  tvaLibelle: string;
  tvaMontant: string;
  total: string;
  noteTva: string;
  acompte: string | null;
  inclus: string;
  conditions: string[];
}

/* --- Facture ------------------------------------------------------------- */
export interface DonneesFacture extends DonneesCommunes {
  dateEmission: string;
  dateEcheance: string;
  client: Partie;
  chantier: {
    typePrestation: string;
    adresse?: string;
    codePostal?: string;
    commune: string;
    dateIntervention: string;
    devisReference: string;
  };
  lignes: LigneDocument[];
  sousTotal: string;
  tvaLibelle: string;
  tvaMontant: string;
  total: string;
  mentionLegale: string;
  paiement: { iban: string; bic: string; titulaire: string; communication: string };
  echeance: {
    dateFacturation: string;
    payableAu: string;
    delaiJours: number;
    numeroFacture: string;
    devisReference: string;
  };
  conditions: string[];
}

/* --- Rapport ------------------------------------------------------------- */
export interface EtapeRapport {
  ordre: number;
  libelle: string;
  detail: string;
  faitA: string;
}

export interface DonneesRapport extends DonneesCommunes {
  dateIntervention: string;
  client: Partie;
  chantier: {
    reference: string;
    typePrestation: string;
    typeBien: string;
    surface: string;
    salissure: string;
    adresse?: string;
    codePostal?: string;
    commune: string;
  };
  execution: {
    debut: string;
    fin: string;
    dureeReelle: string;
    dureeEstimee: string;
    ecart: string;
    equipe: string;
  };
  etapes: EtapeRapport[];
  paires: PaireAvantApres[];
  observations: string;
  garantie: { heures: number; expireLe: string };
  signataire: string;
  signeLe: string;
}

/* --- Bon d'intervention -------------------------------------------------- */
export interface DonneesBonIntervention extends DonneesCommunes {
  reference: string;
  date: string;
  creneau: string;
  dureePrevue: string;
  equipe: string;
  client: Partie;
  chantier: {
    typePrestation: string;
    typeBien: string;
    surface: string;
    salissure: string;
    adresse: string;
    codePostal: string;
    commune: string;
    itineraire: string;
  };
  acces: string;
  prestations: { libelle: string; detail: string }[];
  pointsSensibles: string[];
  materiel: string[];
  precisionsClient: string | null;
}

/* --- Fiche chantier (interne) -------------------------------------------- */
export interface DonneesFicheChantier extends DonneesCommunes {
  reference: string;
  editeeLe: string;
  etape: string;
  client: Partie & { score: number; bande: string; kind: string };
  chantier: {
    typePrestation: string;
    typeBien: string;
    surface: string;
    salissure: string;
    commune: string;
    zone: string;
    urgent: boolean;
  };
  economie: {
    estimation: string;
    devis: string | null;
    facture: string | null;
    dureeEstimee: string;
    dureeReelle: string | null;
    ecartDuree: string | null;
  };
  checklist: { ordre: number; libelle: string; faitA: string | null }[];
  historique: { date: string; type: string; detail: string }[];
  notes: string | null;
}

/* --- Attestation de fin de chantier -------------------------------------- */
export interface DonneesAttestation extends DonneesCommunes {
  reference: string;
  dateEmission: string;
  client: Partie;
  chantier: {
    typePrestation: string;
    typeBien: string;
    surface: string;
    adresse?: string;
    codePostal?: string;
    commune: string;
  };
  intervention: { date: string; debut: string; fin: string; duree: string; equipe: string };
  prestationsRealisees: string[];
  garantie: { heures: number; expireLe: string };
  rapportNumero: string | null;
  signataire: string;
}

/* --- Rapport qualite (interne) ------------------------------------------- */
export interface DonneesRapportQualite extends DonneesCommunes {
  reference: string;
  editeLe: string;
  chantier: { typePrestation: string; surface: string; commune: string; salissure: string };
  execution: {
    debut: string;
    fin: string;
    dureeReelle: string;
    dureeEstimee: string;
    ecartMinutes: number;
    ecartLibelle: string;
    equipe: string;
  };
  etapes: (EtapeRapport & { ecartMinutes: number | null })[];
  couverturePhoto: {
    pairesCompletes: number;
    pairesIncompletes: number;
    piecesCouvertes: string[];
  };
  observations: string;
  rendement: { minutesParM2: string; reference: string; appreciation: string };
  pointsVigilance: string[];
}
