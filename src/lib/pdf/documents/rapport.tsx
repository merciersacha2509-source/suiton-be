import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocChiffres,
  BlocColonnes,
  BlocEncadre,
  BlocEnTete,
  BlocPaires,
  BlocPartie,
  BlocPied,
  BlocSection,
  BlocTitre,
  Coche,
  S,
} from '@/lib/pdf/blocks';
import { COULEURS as C } from '@/lib/pdf/tokens';
import type { DonneesRapport } from '@/lib/pdf/documents/types';

/**
 * Rapport d'intervention.
 *
 * C'est le document qui tient la promesse commerciale : « nous ne nettoyons
 * pas simplement, nous prouvons le resultat ». Il part AVANT la facture — un
 * client qui a vu le resultat paie sans discuter, un client qui recoit
 * d'abord une facture cherche ce qui cloche.
 *
 * La section « Observations » protege SUITON : un degat preexistant
 * photographie et signale le jour meme ne peut plus lui etre impute trois
 * semaines plus tard.
 */
export function RapportDocument({ d }: { d: DonneesRapport }) {
  // Deterministe : une page, plus une seconde si le rapport porte des photos.
  const pages = d.paires.length > 0 ? 2 : 1;

  return (
    <Document
      title={`Rapport ${d.numero} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Rapport d'intervention ${d.numero}`}
      creator="SUITON OS"
      producer="SUITON OS"
    >
      <Page size="A4" style={S.page}>
        <BlocEnTete emetteur={d.emetteur} />

        <BlocTitre
          titre="RAPPORT D'INTERVENTION"
          meta={[`N° ${d.numero}`, d.dateIntervention, `Chantier ${d.chantier.reference}`]}
        />

        <BlocColonnes>
          <BlocPartie
            etiquette="CLIENT"
            partie={{
              nom: d.client.nom,
              adresse: d.chantier.adresse,
              codePostal: d.chantier.codePostal,
              commune: d.chantier.commune,
            }}
          />
          <BlocPartie
            etiquette="PRESTATION"
            partie={{ nom: d.chantier.typePrestation }}
            extras={[
              `${d.chantier.typeBien} · ${d.chantier.surface}`,
              `Salissure ${d.chantier.salissure}`,
              `Équipe : ${d.execution.equipe}`,
            ]}
          />
        </BlocColonnes>

        <BlocSection titre="DÉROULEMENT" />
        <BlocChiffres
          blocs={[
            { libelle: 'Arrivée', valeur: d.execution.debut },
            { libelle: 'Fin', valeur: d.execution.fin },
            { libelle: 'Durée réelle', valeur: d.execution.dureeReelle },
            { libelle: 'Estimée', valeur: d.execution.dureeEstimee },
          ]}
        />
        <Text style={S.note}>Écart par rapport à l&apos;estimation : {d.execution.ecart}</Text>

        <BlocSection titre="PROCÉDURE SUIVIE" />
        {d.etapes.map((e, i) => (
          <View
            key={e.ordre}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                paddingHorizontal: 8,
              },
              ...(i % 2 === 1 ? [S.trAlt] : []),
            ]}
            wrap={false}
          >
            <View style={{ width: 16 }}>
              <Coche />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8.6, fontWeight: 600 }}>
                {e.ordre}. {e.libelle}
              </Text>
              <Text style={S.detail}>{e.detail}</Text>
            </View>
            <Text style={{ width: 46, textAlign: 'right', fontSize: 8.4, color: C.ardoise }}>
              {e.faitA}
            </Text>
          </View>
        ))}

        <BlocSection titre="OBSERVATIONS" />
        <View
          style={{ borderWidth: 0.8, borderColor: C.mineralSombre, padding: 10, minHeight: 40 }}
          wrap={false}
        >
          <Text style={{ fontSize: 8.4, lineHeight: 1.55 }}>{d.observations}</Text>
        </View>

        <BlocEncadre ton="preuve" titre={`GARANTIE RETOUCHE ${d.garantie.heures} HEURES`}>
          <Text style={S.encadreTexte}>
            Un point non conforme signalé avant le {d.garantie.expireLe} est repris sans frais
            et sans discussion. Un appel au {d.emetteur.telephone} suffit.
          </Text>
        </BlocEncadre>

        <View style={{ marginTop: 16, marginBottom: 6 }} wrap={false}>
          <Text style={S.etiquette}>VALIDÉ PAR</Text>
          <Text style={S.ligneFort}>{d.signataire}</Text>
          <Text style={S.ligne}>Le {d.signeLe}</Text>
        </View>

        <BlocPied emetteur={d.emetteur} type="rapport" page={1} pages={pages} />
      </Page>

      {d.paires.length > 0 ? (
        <Page size="A4" style={S.page}>
          <BlocEnTete emetteur={d.emetteur} />
          <BlocTitre
            titre="AVANT / APRÈS"
            meta={[
              d.chantier.reference,
              `${d.paires.length} comparaison${d.paires.length > 1 ? 's' : ''}`,
            ]}
          />
          <BlocPaires paires={d.paires} />
          <BlocPied emetteur={d.emetteur} type="rapport" page={2} pages={pages} />
        </Page>
      ) : null}
    </Document>
  );
}
