import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocColonnes,
  BlocEncadre,
  BlocEnTete,
  BlocPartie,
  BlocPied,
  BlocPucesColonnes,
  BlocSection,
  BlocSignatures,
  BlocTableau,
  BlocTitre,
  BlocTotaux,
  S,
} from '@/lib/pdf/blocks';
import type { DonneesDevis } from '@/lib/pdf/documents/types';

const COLONNES = [
  { cle: 'description', entete: 'DESCRIPTION' },
  { cle: 'quantite', entete: 'QTÉ', largeur: 42, alignement: 'center' as const },
  { cle: 'unite', entete: 'UNITÉ', largeur: 52, alignement: 'center' as const },
  { cle: 'prixUnitaire', entete: 'PU HTVA', largeur: 78, alignement: 'right' as const },
  { cle: 'total', entete: 'TOTAL HTVA', largeur: 84, alignement: 'right' as const },
];

/**
 * Devis.
 *
 * Le bloc signature n'est pas decoratif : « Bon pour accord » manuscrit rend
 * un devis papier opposable en Belgique. Le client qui accepte en ligne
 * depuis son portail laisse une trace equivalente, horodatee.
 */
export function DevisDocument({ d }: { d: DonneesDevis }) {
  return (
    <Document
      title={`Devis ${d.numero} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Devis ${d.numero}`}
      creator="SUITON OS"
      producer="SUITON OS"
    >
      <Page size="A4" style={S.page}>
        <BlocEnTete emetteur={d.emetteur} />

        <BlocTitre
          titre="DEVIS"
          meta={[
            `N° ${d.numero}`,
            `Date d'émission : ${d.dateEmission}`,
            `Validité : ${d.validiteJours} jours`,
          ]}
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
              `Surface : ${d.chantier.surface}`,
              `Date souhaitée : ${d.chantier.dateSouhaitee}`,
            ]}
          />
        </BlocColonnes>

        <BlocSection titre="DÉTAIL DE LA PRESTATION" />
        <BlocTableau colonnes={COLONNES} rangees={d.lignes as never} />

        {/* La colonne gauche des totaux serait vide : la promesse commerciale
            s'y lit en meme temps que le prix. */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <BlocEncadre
            ton="preuve"
            titre="COMPRIS DANS CE PRIX"
            style={{ flex: 1, marginTop: 9 }}
          >
            <Text style={S.encadreTexte}>{d.inclus}</Text>
          </BlocEncadre>

          <View style={{ marginTop: 9 }}>
            <BlocTotaux
              sousTotal={d.sousTotal}
              tvaLibelle={d.tvaLibelle}
              tvaMontant={d.tvaMontant}
              total={d.total}
            />
          </View>
        </View>

        {d.noteTva ? <Text style={S.note}>{d.noteTva}</Text> : null}

        <BlocSection titre="CONDITIONS" />
        <BlocPucesColonnes items={d.conditions} />

        <BlocSignatures
          blocs={[
            { etiquette: 'POUR SUITON', legende: 'Nom, date et signature' },
            {
              etiquette: 'BON POUR ACCORD — LE CLIENT',
              legende: 'Nom, date et signature',
              mention: '(précédé de la mention manuscrite « Bon pour accord »)',
            },
          ]}
        />

        <BlocPied emetteur={d.emetteur} type="devis" page={1} pages={1} />
      </Page>
    </Document>
  );
}
