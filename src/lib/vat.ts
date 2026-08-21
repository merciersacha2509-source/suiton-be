import type { ClientKind } from '@/types/database';

export type VatRegime = 'standard_21' | 'autoliquidation' | 'exonere';

export interface VatInput {
  clientKind: ClientKind;
  /** Numero de TVA du client, format BE + 10 chiffres. */
  clientVat: string | null;
  /** Travaux immobiliers : nettoyage de fin de chantier et apres renovation. */
  travauxImmobiliers: boolean;
}

export interface VatResult {
  regime: VatRegime;
  taux: number;
  /** Mention a porter sur la facture. Chaine vide si aucune. */
  mention: string;
}

/**
 * Regime de TVA applicable.
 *
 * L'autoliquidation (report de perception) s'applique aux travaux
 * immobiliers entre assujettis etablis en Belgique : SUITON ne facture pas
 * la TVA, le client la declare lui-meme. La mention est OBLIGATOIRE sur la
 * facture — son absence engage la responsabilite de l'emetteur.
 */
export function resolveVat(input: VatInput): VatResult {
  const estAssujettiBelge =
    input.clientKind === 'professionnel' &&
    typeof input.clientVat === 'string' &&
    /^BE[0-9]{10}$/.test(input.clientVat);

  if (estAssujettiBelge && input.travauxImmobiliers) {
    return {
      regime: 'autoliquidation',
      taux: 0,
      mention:
        'Autoliquidation — TVA a acquitter par le cocontractant. ' +
        'Art. 20 de l’AR n° 1 du Code de la TVA.',
    };
  }

  return { regime: 'standard_21', taux: 0.21, mention: '' };
}

export interface VatAmounts {
  htva: number;
  tva: number;
  ttc: number;
}

/** Montants arrondis au cent. La contrainte SQL verifie la coherence. */
export function computeAmounts(htva: number, taux: number): VatAmounts {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const base = round2(htva);
  const tva = round2(base * taux);
  return { htva: base, tva, ttc: round2(base + tva) };
}
