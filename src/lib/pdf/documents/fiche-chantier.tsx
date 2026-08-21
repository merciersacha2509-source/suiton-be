import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocChiffres,
  BlocColonnes,
  BlocEncadre,
  BlocEnTete,
  BlocPartie,
  BlocPied,
  BlocSection,
  BlocTableau,
  BlocTitre,
  Case,
  Coche,
  S,
} from '@/lib/pdf/blocks';
import { COULEURS as C } from '@/lib/pdf/tokens';
import type { DonneesFicheChantier } from '@/lib/pdf/documents/types';

/**
 * Fiche chantier — INTERNE.
 *
 * Elle contient ce qu'aucun autre document ne montre : le score du client,
 * l'ecart entre durée estimee et reelle, la marge implicite. Elle ne quitte
 * jamais l'entreprise, d'où le bandeau et le pied de page explicites.
 *
 * Elle sert a deux moments : avant, pour preparer ; apres, pour comprendre
 * pourquoi un chantier a pris deux heures de plus que prevu.
 */
export function FicheChantierDocument({ d }: { d: DonneesFicheChantier }) {
  return (
    <Document
      title={`Fiche chantier ${d.reference} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Fiche interne ${d.reference}`}
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
            DOCUMENT INTERNE — NE PAS TRANSMETTRE AU CLIENT
          </Text>
        </View>

        <BlocTitre
          titre="FICHE CHANTIER"
          meta={[d.reference, `Éditée le ${d.editeeLe}`, `Étape : ${d.etape}`]}
        />

        <BlocColonnes>
          <BlocPartie
            etiquette="CLIENT"
            partie={d.client}
            extras={[
              `Type : ${d.client.kind}`,
              `Score : ${d.client.score} (bande ${d.client.bande})`,
            ]}
          />
          <BlocPartie
            etiquette="CHANTIER"
            partie={{ nom: d.chantier.typePrestation, commune: d.chantier.commune }}
            extras={[
              `${d.chantier.typeBien} · ${d.chantier.surface}`,
              `Salissure ${d.chantier.salissure}`,
              `Zone ${d.chantier.zone}${d.chantier.urgent ? ' · URGENT' : ''}`,
            ]}
          />
        </BlocColonnes>

        <BlocSection titre="ÉCONOMIE DU CHANTIER" />
        <BlocChiffres
          blocs={[
            { libelle: 'Estimation', valeur: d.economie.estimation },
            { libelle: 'Devis', valeur: d.economie.devis ?? '—' },
            { libelle: 'Facturé', valeur: d.economie.facture ?? '—' },
            { libelle: 'Durée réelle', valeur: d.economie.dureeReelle ?? '—' },
          ]}
        />
        {d.economie.ecartDuree ? (
          <Text style={S.note}>
            Durée estimée {d.economie.dureeEstimee} · écart : {d.economie.ecartDuree}
          </Text>
        ) : (
          <Text style={S.note}>
            Durée estimée {d.economie.dureeEstimee} — chantier non réalisé.
          </Text>
        )}

        <BlocSection titre="PROCÉDURE" />
        {d.checklist.map((e, i) => (
          <View
            key={e.ordre}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 5,
                paddingHorizontal: 8,
              },
              ...(i % 2 === 1 ? [S.trAlt] : []),
            ]}
            wrap={false}
          >
            <View style={{ width: 16 }}>{e.faitA ? <Coche /> : <Case taille={9} />}</View>
            <Text style={{ flex: 1, fontSize: 8.4 }}>
              {e.ordre}. {e.libelle}
            </Text>
            <Text style={{ width: 46, textAlign: 'right', fontSize: 8, color: C.ardoise }}>
              {e.faitA ?? '—'}
            </Text>
          </View>
        ))}

        <BlocSection titre="HISTORIQUE" />
        <BlocTableau
          colonnes={[
            { cle: 'date', entete: 'DATE', largeur: 96 },
            { cle: 'type', entete: 'ÉVÉNEMENT', largeur: 132 },
            { cle: 'detail', entete: 'DÉTAIL' },
          ]}
          rangees={d.historique as never}
          repeterEntete
        />

        {d.notes ? (
          <BlocEncadre ton="neutre" titre="NOTES">
            <Text style={S.encadreTexte}>{d.notes}</Text>
          </BlocEncadre>
        ) : null}

        <BlocPied emetteur={d.emetteur} type="fiche_chantier" page={1} pages={1} />
      </Page>
    </Document>
  );
}
