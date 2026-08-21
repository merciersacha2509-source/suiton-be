import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocColonnes,
  BlocEncadre,
  BlocEnTete,
  BlocPartie,
  BlocPied,
  BlocPucesColonnes,
  BlocSection,
  BlocTableau,
  BlocTitre,
  BlocTotaux,
  S,
} from '@/lib/pdf/blocks';
import type { DonneesFacture } from '@/lib/pdf/documents/types';

const COLONNES = [
  { cle: 'description', entete: 'DESCRIPTION' },
  { cle: 'quantite', entete: 'QTÉ', largeur: 42, alignement: 'center' as const },
  { cle: 'unite', entete: 'UNITÉ', largeur: 52, alignement: 'center' as const },
  { cle: 'prixUnitaire', entete: 'PU HTVA', largeur: 78, alignement: 'right' as const },
  { cle: 'total', entete: 'TOTAL HTVA', largeur: 84, alignement: 'right' as const },
];

/**
 * Facture.
 *
 * ATTENTION — depuis le 1er janvier 2026, une facture B2B belge doit etre
 * transmise en format STRUCTURE via Peppol. Ce PDF est un accompagnement
 * lisible, pas le document fiscal : il ne remplace pas la transmission.
 * Pour un particulier, en revanche, il EST la facture.
 */
export function FactureDocument({ d }: { d: DonneesFacture }) {
  return (
    <Document
      title={`Facture ${d.numero} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Facture ${d.numero}`}
      creator="SUITON OS"
      producer="SUITON OS"
    >
      <Page size="A4" style={S.page}>
        <BlocEnTete emetteur={d.emetteur} />

        <BlocTitre
          titre="FACTURE"
          meta={[`N° ${d.numero}`, `Date : ${d.dateEmission}`, `Échéance : ${d.dateEcheance}`]}
        />

        <BlocColonnes>
          <BlocPartie etiquette="CLIENT" partie={d.client} />
          <BlocPartie
            etiquette="CHANTIER / INTERVENTION"
            partie={{
              nom: d.chantier.typePrestation,
              adresse: d.chantier.adresse,
              codePostal: d.chantier.codePostal,
              commune: d.chantier.commune,
            }}
            extras={[
              `Date d'intervention : ${d.chantier.dateIntervention}`,
              `Devis de référence : ${d.chantier.devisReference}`,
            ]}
          />
        </BlocColonnes>

        <BlocSection titre="DÉTAIL DE LA PRESTATION" />
        <BlocTableau colonnes={COLONNES} rangees={d.lignes as never} />

        {/* La mention legale occupe la colonne gauche des totaux : elle se lit
            au moment exact ou le client se demande pourquoi la TVA est a zero. */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          {d.mentionLegale ? (
            <BlocEncadre
              ton="legal"
              titre="MENTION LÉGALE — CLIENT ASSUJETTI (CHANTIER)"
              style={{ flex: 1, marginTop: 9 }}
            >
              <Text style={S.encadreTexte}>{d.mentionLegale}</Text>
            </BlocEncadre>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={{ marginTop: 9 }}>
            <BlocTotaux
              sousTotal={d.sousTotal}
              tvaLibelle={d.tvaLibelle}
              tvaMontant={d.tvaMontant}
              total={d.total}
            />
          </View>
        </View>

        <View style={[S.colonnes, { marginTop: 12 }]} wrap={false}>
          <View style={S.colonne}>
            <Text style={S.etiquette}>COORDONNÉES DE PAIEMENT</Text>
            <Text style={S.ligne}>IBAN : {d.paiement.iban || '—'}</Text>
            <Text style={S.ligne}>BIC : {d.paiement.bic || '—'}</Text>
            <Text style={S.ligne}>Titulaire : {d.paiement.titulaire}</Text>
            <Text style={S.ligne}>Communication structurée : {d.paiement.communication}</Text>
          </View>

          <View style={S.colonne}>
            <Text style={S.etiquette}>ÉCHÉANCE</Text>
            <Text style={S.ligne}>Date de facturation : {d.echeance.dateFacturation}</Text>
            <Text style={S.ligne}>
              Paiement dû au : {d.echeance.payableAu} ({d.echeance.delaiJours} jours)
            </Text>
            <Text style={S.ligne}>Facture n° : {d.echeance.numeroFacture}</Text>
            <Text style={S.ligne}>Devis de référence : {d.echeance.devisReference}</Text>
          </View>
        </View>

        <BlocSection titre="CONDITIONS DE PAIEMENT" />
        <BlocPucesColonnes items={d.conditions} compact />

        <BlocPied emetteur={d.emetteur} type="facture" page={1} pages={1} />
      </Page>
    </Document>
  );
}
