import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocChiffres,
  BlocColonnes,
  BlocEncadre,
  BlocEnTete,
  BlocPartie,
  BlocPied,
  BlocSection,
  BlocSignatures,
  BlocTitre,
  Coche,
  S,
} from '@/lib/pdf/blocks';
import type { DonneesAttestation } from '@/lib/pdf/documents/types';

/**
 * Attestation de fin de chantier.
 *
 * Elle sert au client, pas a SUITON : un entrepreneur general la joint a sa
 * reception de chantier, un particulier la transmet a son assurance ou a son
 * syndic. C'est un document court — une page, des faits, une signature.
 *
 * Elle ne remplace pas le rapport photo : elle atteste, il prouve.
 */
export function AttestationDocument({ d }: { d: DonneesAttestation }) {
  return (
    <Document
      title={`Attestation ${d.numero} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Attestation de fin de chantier ${d.reference}`}
      creator="SUITON OS"
      producer="SUITON OS"
    >
      <Page size="A4" style={S.page}>
        <BlocEnTete emetteur={d.emetteur} />

        <BlocTitre
          titre="ATTESTATION DE FIN DE CHANTIER"
          meta={[`N° ${d.numero}`, `Émise le ${d.dateEmission}`, `Chantier ${d.reference}`]}
        />

        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 9.4, lineHeight: 1.6 }}>
            Je soussigné {d.signataire}, agissant pour {d.emetteur.denomination}, atteste que la
            prestation de nettoyage décrite ci-dessous a été réalisée dans son intégralité,
            selon la procédure en six étapes de l&apos;entreprise, et que le chantier a été
            remis en état conformément à l&apos;engagement contractuel.
          </Text>
        </View>

        <BlocColonnes>
          <BlocPartie etiquette="DONNEUR D'ORDRE" partie={d.client} />
          <BlocPartie
            etiquette="LIEU DE LA PRESTATION"
            partie={{
              nom: d.chantier.typePrestation,
              adresse: d.chantier.adresse,
              codePostal: d.chantier.codePostal,
              commune: d.chantier.commune,
            }}
            extras={[`${d.chantier.typeBien} · ${d.chantier.surface}`]}
          />
        </BlocColonnes>

        <BlocSection titre="EXÉCUTION" />
        <BlocChiffres
          blocs={[
            { libelle: 'Date', valeur: d.intervention.date },
            { libelle: 'Début', valeur: d.intervention.debut },
            { libelle: 'Fin', valeur: d.intervention.fin },
            { libelle: 'Durée', valeur: d.intervention.duree },
          ]}
        />
        <Text style={S.note}>Intervenant : {d.intervention.equipe}</Text>

        <BlocSection titre="PRESTATIONS RÉALISÉES" />
        {d.prestationsRealisees.map((p, i) => (
          <View
            key={p}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 5.5,
                paddingHorizontal: 8,
              },
              ...(i % 2 === 1 ? [S.trAlt] : []),
            ]}
            wrap={false}
          >
            <View style={{ width: 16 }}>
              <Coche />
            </View>
            <Text style={{ flex: 1, fontSize: 8.6 }}>{p}</Text>
          </View>
        ))}

        <BlocEncadre ton="succes" titre={`GARANTIE RETOUCHE ${d.garantie.heures} HEURES`}>
          <Text style={S.encadreTexte}>
            Tout point non conforme signalé avant le {d.garantie.expireLe} est repris sans
            frais.
            {d.rapportNumero
              ? ` L'état du chantier avant et après intervention est documenté dans le rapport ${d.rapportNumero}, remis séparément.`
              : ''}
          </Text>
        </BlocEncadre>

        <BlocSignatures
          blocs={[
            { etiquette: 'POUR SUITON', legende: `${d.signataire} — ${d.dateEmission}` },
            {
              etiquette: 'RÉCEPTION — LE CLIENT',
              legende: 'Nom, date et signature',
              mention: '(la signature vaut réception sans réserve)',
            },
          ]}
        />

        <BlocPied emetteur={d.emetteur} type="attestation" page={1} pages={1} />
      </Page>
    </Document>
  );
}
