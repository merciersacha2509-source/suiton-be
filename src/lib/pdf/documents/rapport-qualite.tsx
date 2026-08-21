import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocChiffres,
  BlocEncadre,
  BlocEnTete,
  BlocPied,
  BlocSection,
  BlocTableau,
  BlocTitre,
  S,
} from '@/lib/pdf/blocks';
import { COULEURS as C } from '@/lib/pdf/tokens';
import type { DonneesRapportQualite } from '@/lib/pdf/documents/types';

/**
 * Rapport qualite — INTERNE.
 *
 * Il ne s'adresse pas au client mais a SUITON : il repond a « ou est parti
 * le temps ? » et « qu'est-ce qui n'a pas ete photographie ? ».
 *
 * Son interet n'apparait qu'au dixieme chantier, quand les ecarts par etape
 * commencent a dessiner une tendance. C'est pour cela qu'il est produit des
 * le premier : sans historique, pas de tendance.
 */
export function RapportQualiteDocument({ d }: { d: DonneesRapportQualite }) {
  return (
    <Document
      title={`Rapport qualité ${d.numero} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Analyse qualité ${d.reference}`}
      creator="SUITON OS"
      producer="SUITON OS"
    >
      <Page size="A4" style={S.page}>
        <BlocEnTete emetteur={d.emetteur} />

        <View
          style={{
            backgroundColor: C.abysse,
            paddingVertical: 4,
            paddingHorizontal: 8,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 7, color: C.mineral, letterSpacing: 1.4, fontWeight: 600 }}>
            DOCUMENT INTERNE — ANALYSE D&apos;EXÉCUTION
          </Text>
        </View>

        <BlocTitre
          titre="RAPPORT QUALITÉ"
          meta={[`N° ${d.numero}`, d.reference, `Édité le ${d.editeLe}`]}
        />

        <BlocSection titre="RENDEMENT" />
        <BlocChiffres
          blocs={[
            { libelle: 'Durée réelle', valeur: d.execution.dureeReelle },
            { libelle: 'Estimée', valeur: d.execution.dureeEstimee },
            { libelle: 'Min / m²', valeur: d.rendement.minutesParM2 },
            { libelle: 'Référence', valeur: d.rendement.reference },
          ]}
        />
        <Text style={S.note}>
          {d.rendement.appreciation} · {d.execution.ecartLibelle}
        </Text>

        <BlocSection titre="CHRONOLOGIE PAR ÉTAPE" />
        <BlocTableau
          colonnes={[
            { cle: 'ordre', entete: '#', largeur: 24, alignement: 'center' },
            { cle: 'libelle', entete: 'ÉTAPE' },
            { cle: 'faitA', entete: 'VALIDÉE À', largeur: 66, alignement: 'right' },
            { cle: 'ecart', entete: 'DEPUIS LA PRÉCÉDENTE', largeur: 118, alignement: 'right' },
          ]}
          rangees={d.etapes.map((e) => ({
            ordre: String(e.ordre),
            libelle: e.libelle,
            faitA: e.faitA,
            ecart: e.ecartMinutes === null ? '—' : `${e.ecartMinutes} min`,
          }))}
        />

        <BlocSection titre="COUVERTURE PHOTO" />
        <BlocChiffres
          blocs={[
            { libelle: 'Paires complètes', valeur: String(d.couverturePhoto.pairesCompletes) },
            { libelle: 'Incomplètes', valeur: String(d.couverturePhoto.pairesIncompletes) },
            {
              libelle: 'Pièces couvertes',
              valeur: String(d.couverturePhoto.piecesCouvertes.length),
            },
          ]}
        />
        {d.couverturePhoto.piecesCouvertes.length > 0 ? (
          <Text style={S.note}>{d.couverturePhoto.piecesCouvertes.join(' · ')}</Text>
        ) : (
          <Text style={S.note}>
            Aucune comparaison avant/après. C&apos;est précisément ce qui prouve le résultat au
            client — et ce qui alimente les réalisations publiées.
          </Text>
        )}

        <BlocSection titre="OBSERVATIONS DU TERRAIN" />
        <View
          style={{ borderWidth: 0.8, borderColor: C.mineralSombre, padding: 10, minHeight: 34 }}
          wrap={false}
        >
          <Text style={{ fontSize: 8.4, lineHeight: 1.55 }}>{d.observations}</Text>
        </View>

        {d.pointsVigilance.length > 0 ? (
          <BlocEncadre ton="legal" titre="POINTS DE VIGILANCE">
            {d.pointsVigilance.map((p) => (
              <View key={p} style={S.puce}>
                <Text style={[S.puceTiret, { color: C.ambre }]}>–</Text>
                <Text style={S.puceTexte}>{p}</Text>
              </View>
            ))}
          </BlocEncadre>
        ) : (
          <BlocEncadre ton="succes" titre="AUCUN POINT DE VIGILANCE">
            <Text style={S.encadreTexte}>
              Chantier conforme : durée dans la fourchette, procédure complète, couverture photo
              suffisante.
            </Text>
          </BlocEncadre>
        )}

        <BlocPied emetteur={d.emetteur} type="rapport_qualite" page={1} pages={1} />
      </Page>
    </Document>
  );
}
