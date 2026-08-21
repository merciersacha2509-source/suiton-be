import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BlocChiffres,
  BlocColonnes,
  BlocEncadre,
  BlocEnTete,
  BlocPied,
  BlocSection,
  Case,
  S,
} from '@/lib/pdf/blocks';
import { BlocTitre } from '@/lib/pdf/blocks';
import { COULEURS as C } from '@/lib/pdf/tokens';
import type { DonneesBonIntervention } from '@/lib/pdf/documents/types';

/**
 * Bon d'intervention — remis a l'equipe.
 *
 * Il est concu pour etre imprime, plie en deux et glisse dans une poche.
 * D'ou trois partis pris :
 *   - l'adresse et le telephone sont en gros, en haut : c'est ce qu'on
 *     cherche en arrivant ;
 *   - les points sensibles sont dans un encadre ambre, avant les
 *     prestations : ce qui peut mal tourner se lit avant ce qu'il faut
 *     faire ;
 *   - les cases sont vides, a cocher au stylo. L'application reste la
 *     reference, mais le papier fonctionne sans reseau et sans batterie.
 *
 * AUCUN MONTANT n'y figure. Un bon d'intervention se perd sur un chantier.
 */
export function BonInterventionDocument({ d }: { d: DonneesBonIntervention }) {
  return (
    <Document
      title={`Bon d'intervention ${d.numero} — SUITON`}
      author={d.emetteur.denomination}
      subject={`Bon d'intervention ${d.reference}`}
      creator="SUITON OS"
      producer="SUITON OS"
    >
      <Page size="A4" style={S.page}>
        <BlocEnTete emetteur={d.emetteur} />

        <BlocTitre
          titre="BON D'INTERVENTION"
          meta={[`N° ${d.numero}`, `Chantier ${d.reference}`, d.equipe]}
        />

        <BlocChiffres
          blocs={[
            { libelle: 'Date', valeur: d.date },
            { libelle: 'Créneau', valeur: d.creneau },
            { libelle: 'Durée prévue', valeur: d.dureePrevue },
            { libelle: 'Surface', valeur: d.chantier.surface },
          ]}
        />

        {/* Champs a remplir au stylo, en haut.
            Le bon se deplie a l'arrivee : c'est la qu'on note son nom et son
            heure. Les placer en bas obligerait a le replier deux fois — et
            surtout, en haut le cout en hauteur est FIXE, ce qui garantit que
            le document tient sur une seule feuille quel que soit le nombre
            de points sensibles. */}
        <View
          style={{
            flexDirection: 'row',
            gap: 16,
            marginTop: 1.5,
            backgroundColor: C.mineral,
            paddingVertical: 6,
            paddingHorizontal: 8,
          }}
        >
          {[
            { etiquette: 'INTERVENANT', gabarit: '____________________', poids: 2 },
            { etiquette: 'ARRIVÉE', gabarit: '____ : ____', poids: 1 },
            { etiquette: 'DÉPART', gabarit: '____ : ____', poids: 1 },
          ].map((c) => (
            <View key={c.etiquette} style={{ flex: c.poids }}>
              <Text style={S.chiffreLibelle}>{c.etiquette}</Text>
              <Text style={{ fontSize: 9, color: C.ardoiseClair, marginTop: 2 }}>
                {c.gabarit}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 10 }}>
          <BlocColonnes>
            <View style={S.colonne}>
              <Text style={S.etiquette}>ADRESSE DU CHANTIER</Text>
              <Text style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3 }}>
                {d.chantier.adresse}
              </Text>
              <Text style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3 }}>
                {d.chantier.codePostal} {d.chantier.commune}
              </Text>
              <Text style={[S.note, { marginTop: 4 }]}>{d.chantier.itineraire}</Text>
            </View>

            <View style={S.colonne}>
              <Text style={S.etiquette}>CONTACT SUR PLACE</Text>
              <Text style={{ fontSize: 11, fontWeight: 600 }}>{d.client.nom}</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color: C.ocean }}>
                {d.client.telephone}
              </Text>
              <Text style={[S.ligne, { marginTop: 4 }]}>
                {d.chantier.typeBien} · salissure {d.chantier.salissure}
              </Text>
              <Text style={S.ligne}>{d.chantier.typePrestation}</Text>
            </View>
          </BlocColonnes>
        </View>

        {/* Acces et precisions cote a cote : le bon d'intervention doit tenir
            sur une seule feuille, pliee en deux dans une poche. */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <BlocEncadre ton="neutre" titre="ACCÈS" style={{ flex: 1 }}>
            <Text style={S.encadreTexte}>{d.acces}</Text>
          </BlocEncadre>

          {d.precisionsClient ? (
            <BlocEncadre ton="neutre" titre="PRÉCISIONS DU CLIENT" style={{ flex: 1 }}>
              <Text style={S.encadreTexte}>{d.precisionsClient}</Text>
            </BlocEncadre>
          ) : null}
        </View>

        {d.pointsSensibles.length > 0 ? (
          <BlocEncadre ton="legal" titre="POINTS SENSIBLES — À LIRE AVANT DE COMMENCER">
            {d.pointsSensibles.map((p) => (
              <View key={p} style={S.puce}>
                <Text style={[S.puceTiret, { color: C.ambre }]}>–</Text>
                <Text style={[S.puceTexte, { fontSize: 7.4, lineHeight: 1.4 }]}>{p}</Text>
              </View>
            ))}
          </BlocEncadre>
        ) : null}

        <BlocSection titre="PRESTATIONS À RÉALISER" />
        {d.prestations.map((p, i) => (
          <View
            key={p.libelle}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 4,
                paddingHorizontal: 8,
              },
              ...(i % 2 === 1 ? [S.trAlt] : []),
            ]}
            wrap={false}
          >
            <View style={{ width: 20 }}>
              <Case />
            </View>
            {/* Libelle seul, sans le detail.
                Le detail de chaque etape vit dans l'application, ou le
                technicien travaille reellement ; ici, c'est une liste a
                cocher. Six lignes de detail coutent une seconde feuille, et
                un bon d'intervention sur deux pages se perd. */}
            <Text style={{ flex: 1, fontSize: 8.6, fontWeight: 600 }}>
              {i + 1}. {p.libelle}
            </Text>
            <Text
              style={{ width: 54, textAlign: 'right', fontSize: 7.6, color: C.ardoiseClair }}
            >
              ____ : ____
            </Text>
          </View>
        ))}

        {d.materiel.length > 0 ? (
          <>
            <BlocSection titre="MATÉRIEL SPÉCIFIQUE" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }} wrap={false}>
              {d.materiel.map((m) => (
                <View
                  key={m}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: C.mineral,
                    paddingVertical: 3.5,
                    paddingHorizontal: 7,
                  }}
                >
                  <Case taille={9} />
                  <Text style={{ fontSize: 8.2 }}>{m}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <BlocPied emetteur={d.emetteur} type="bon_intervention" page={1} pages={1} />
      </Page>
    </Document>
  );
}
