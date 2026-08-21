import 'server-only';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { enregistrerPolices } from '@/lib/pdf/fonts';
import { DevisDocument } from '@/lib/pdf/documents/devis';
import { FactureDocument } from '@/lib/pdf/documents/facture';
import { RapportDocument } from '@/lib/pdf/documents/rapport';
import { BonInterventionDocument } from '@/lib/pdf/documents/bon-intervention';
import { AttestationDocument } from '@/lib/pdf/documents/attestation';
import { FicheChantierDocument } from '@/lib/pdf/documents/fiche-chantier';
import { RapportQualiteDocument } from '@/lib/pdf/documents/rapport-qualite';
import {
  ExploitationDocument,
  type DonneesExploitation,
} from '@/lib/pdf/documents/exploitation';
import type {
  DonneesAttestation,
  DonneesBonIntervention,
  DonneesDevis,
  DonneesFacture,
  DonneesFicheChantier,
  DonneesRapport,
  DonneesRapportQualite,
} from '@/lib/pdf/documents/types';

export {
  composerAttestation,
  composerBonIntervention,
  composerDevis,
  composerEmetteur,
  composerFacture,
  composerFicheChantier,
  composerRapport,
  composerRapportQualite,
  decouperForfaits,
  LIBELLES_BIEN,
  LIBELLES_SALISSURE,
  LIBELLES_SERVICE,
} from '@/lib/pdf/compose';

/**
 * Rendu PDF. Deterministe : memes donnees, meme fichier.
 *
 * Les polices sont enregistrees a chaque appel — la fonction est idempotente
 * et sort immediatement si c'est deja fait. Sur Vercel, chaque instance
 * froide repart de zero : l'enregistrement ne peut donc pas vivre au niveau
 * du module.
 *
 * Le cast couvre une incompatibilite connue entre les types React 19 et la
 * signature de renderToBuffer, qui attend un ReactElement<DocumentProps>
 * alors que nos composants declarent leurs propres props. Ils renvoient bien
 * un <Document> : la conversion est correcte a l'execution.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rendre<P extends Record<string, any>>(
  composant: (p: P) => ReactElement | null,
  props: P,
): Promise<Buffer> {
  enregistrerPolices();
  const element = createElement(composant, props) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

export const rendreDevisPdf = (d: DonneesDevis) => rendre(DevisDocument, { d });
export const rendreFacturePdf = (d: DonneesFacture) => rendre(FactureDocument, { d });
export const rendreRapportPdf = (d: DonneesRapport) => rendre(RapportDocument, { d });
export const rendreBonInterventionPdf = (d: DonneesBonIntervention) =>
  rendre(BonInterventionDocument, { d });
export const rendreAttestationPdf = (d: DonneesAttestation) =>
  rendre(AttestationDocument, { d });
export const rendreFicheChantierPdf = (d: DonneesFicheChantier) =>
  rendre(FicheChantierDocument, { d });
export const rendreRapportQualitePdf = (d: DonneesRapportQualite) =>
  rendre(RapportQualiteDocument, { d });
export const rendreExploitationPdf = (d: DonneesExploitation) =>
  rendre(ExploitationDocument, { d });
