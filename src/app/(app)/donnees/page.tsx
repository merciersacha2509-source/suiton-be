import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  alertes as chargerAlertes,
  indicateurs,
  perfGlobale,
  quelleCommuneLaPlusRentable,
  quelleEquipeLaPlusEfficace,
  quelleMargeMoyenne,
  quelTypeGenereLePlusDeRecommandations,
  combienDeTempsChantierSimilaire,
} from '@/lib/services/analytics';
import { raisonAucuneAlerte, SEUIL_OBSERVATIONS } from '@/lib/alertes';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Confiance } from '@/components/ui/confiance';
import { EmptyState } from '@/components/ui/empty-state';
import { Indicateur } from '@/components/data/indicateur';
import { AlerteCarte } from '@/components/data/alerte-carte';
import { Matrice, type CelluleMatrice } from '@/components/data/matrice';
import {
  GraphiqueEtapesLazy,
  GraphiqueEvolutionLazy,
  type DonneeEtape,
  type PointEvolution,
} from '@/components/data/graphiques';
import { formatEUR } from '@/lib/format';
import { LIBELLES_SERVICE } from '@/lib/pdf/compose';
import type { NiveauConfiance, ServiceType } from '@/types/database';

export const metadata: Metadata = { title: 'Données' };
export const dynamic = 'force-dynamic';

const BANDES = [
  { cle: 'xs', libelle: '< 60 m²' },
  { cle: 's', libelle: '60–110' },
  { cle: 'm', libelle: '110–180' },
  { cle: 'l', libelle: '180–300' },
  { cle: 'xl', libelle: '> 300' },
];

/**
 * Cockpit du dirigeant.
 *
 * Chaque chiffre porte son niveau de confiance, sans exception. C'est la
 * seule protection contre la decision fondee sur du bruit : une mediane sur
 * trois chantiers a exactement la meme apparence qu'une mediane sur cent, et
 * c'est ainsi qu'on repricie une gamme entiere sur un hasard.
 */
export default async function DonneesPage() {
  await requireCapability('dashboard.view');
  const supabase = await createClient();

  const [perf, ind, listeAlertes, etapes, matrice, communes, equipes, evolution, questions] =
    await Promise.all([
      perfGlobale(),
      indicateurs(),
      chargerAlertes(),
      supabase.from('stats_par_etape').select('*'),
      supabase.from('rentabilite_matrice').select('*'),
      supabase
        .from('opportunites_communes')
        .select('*')
        .order('ca_horaire', { ascending: false }),
      supabase.from('stats_par_equipe').select('*'),
      supabase.from('evolution_trimestrielle').select('*'),
      Promise.all([
        combienDeTempsChantierSimilaire({
          propertyType: 'maison',
          surface: 140,
          soil: 'standard',
        }),
        quelleMargeMoyenne(),
        quelleEquipeLaPlusEfficace(),
        quelleCommuneLaPlusRentable(),
        quelTypeGenereLePlusDeRecommandations(),
      ]),
    ]);

  const vierge = ind.chantiersComplets === 0;

  const donneesEtapes: DonneeEtape[] = (etapes.data ?? [])
    .filter((e) => e.mediane_min !== null)
    .map((e) => ({
      ordre: Number(e.ordre),
      libelle: String(e.libelle ?? `Étape ${e.ordre}`),
      mediane: Number(e.mediane_min),
      p90: Number(e.p90_min ?? e.mediane_min),
      observations: Number(e.observations),
    }));

  const services = Array.from(
    new Set((matrice.data ?? []).map((m) => String(m.service))),
  ) as ServiceType[];

  const cellules: CelluleMatrice[] = (matrice.data ?? []).map((m) => ({
    ligne: String(m.service),
    colonne: String(m.bande),
    valeur: m.ca_horaire !== null ? Number(m.ca_horaire) : null,
    n: Number(m.n),
    confiance: m.confiance as NiveauConfiance,
  }));

  const pointsEvolution: PointEvolution[] = (evolution.data ?? []).map((e) => ({
    periode: String(e.trimestre),
    chantiers: Number(e.chantiers),
    cadence: e.cadence !== null ? Number(e.cadence) : null,
    caHoraire: e.ca_horaire !== null ? Number(e.ca_horaire) : null,
    panier: e.panier !== null ? Number(e.panier) : null,
  }));

  const [tempsRef, marge, equipe, commune, fidelisation] = questions;

  return (
    <>
      <PageHeader
        titre="Données"
        description="Où vous gagnez de l'argent, où vous en perdez, et quoi faire aujourd'hui."
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Confiance niveau={ind.confiance} n={ind.chantiersComplets} />
            <Link href="/donnees/references">
              <Button variant="secondaire" size="sm">
                Références
              </Button>
            </Link>
            <Link href="/donnees/estimation">
              <Button size="sm">Estimer un chantier</Button>
            </Link>
          </span>
        }
      />

      {vierge ? (
        <Alert ton="info" titre="Le cockpit est prêt, il attend vos chantiers" className="mb-6">
          Tout ce que vous voyez ci-dessous se remplira à partir des chantiers{' '}
          <strong>terminés et facturés</strong> — les seuls dont on connaît à la fois la durée
          réelle et le montant.
          <br />
          <br />
          D&apos;ici là, les estimations reposent sur le catalogue, et c&apos;est signalé
          partout. Les premières comparaisons fiables arrivent vers {SEUIL_OBSERVATIONS}{' '}
          chantiers par segment ; les alertes de tarification, vers 10.
        </Alert>
      ) : null}

      {/* ================= Bloc 2 — Alertes (en premier : c'est ce qui appelle une décision) */}
      <section className="mb-7">
        <h2 className="font-heading mb-3 text-base font-semibold">À traiter</h2>

        {listeAlertes.length === 0 ? (
          <Card>
            <CardBody className="py-5">
              <p className="text-ardoise text-sm">
                {raisonAucuneAlerte(ind.chantiersComplets)}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {listeAlertes.map((a) => (
              <AlerteCarte key={a.code} alerte={a} />
            ))}
          </div>
        )}
      </section>

      {/* ================= Bloc 1 — Performance globale */}
      <section className="mb-7">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">Performance</h2>
          <p className="text-ardoise text-[0.75rem]">
            90 derniers jours
            {perf.nPrecedent > 0 ? ' · évolution vs 90 précédents' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicateur
            libelle="Cadence médiane"
            valeur={perf.cadence}
            unite="min/m²"
            precedent={perf.cadencePrecedente}
            sens="hausse-mauvaise"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Temps de travail par m². Plus bas = plus efficace."
          />
          <Indicateur
            libelle="CA horaire"
            valeur={perf.caHoraire}
            unite="€/h"
            precision={0}
            precedent={perf.caHorairePrecedent}
            sens="hausse-bonne"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Le seul chiffre qui compare un petit chantier rapide à un gros chantier lent."
          />
          <Indicateur
            libelle="Précision estimation"
            valeur={perf.precision}
            unite="%"
            precision={0}
            precedent={perf.precisionPrecedente}
            sens="hausse-bonne"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Part des chantiers tenus dans la fourchette annoncée."
          />
          <Indicateur
            libelle="Taux de retouche"
            valeur={perf.tauxRetouche}
            unite="%"
            precision={0}
            precedent={perf.tauxRetouchePrecedent}
            sens="hausse-mauvaise"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Chantiers ayant nécessité un repassage sous garantie."
          />
          <Indicateur
            libelle="Couverture photo"
            valeur={perf.couverture}
            unite="%"
            precision={0}
            precedent={perf.couverturePrecedente}
            sens="hausse-bonne"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Paires avant/après complètes. Votre preuve et votre protection."
          />
          <Indicateur
            libelle="Note moyenne"
            valeur={perf.note}
            unite="/5"
            precision={1}
            precedent={perf.notePrecedente}
            sens="hausse-bonne"
            confiance={ind.confiance}
            n={perf.n}
          />
          <Indicateur
            libelle="Délai de signature"
            valeur={perf.delaiSignatureH}
            unite="h"
            precision={0}
            precedent={perf.delaiSignaturePrecedent}
            sens="hausse-mauvaise"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Entre l'envoi du devis et son acceptation."
          />
          <Indicateur
            libelle="Délai de paiement"
            valeur={perf.delaiPaiementJ}
            unite="j"
            precision={0}
            precedent={perf.delaiPaiementPrecedent}
            sens="hausse-mauvaise"
            confiance={ind.confiance}
            n={perf.n}
            interpretation="Entre l'émission de la facture et son encaissement."
          />
        </div>
      </section>

      {/* ================= Bloc 3 — Où part le temps */}
      <section className="mb-7">
        <Card>
          <CardHeader
            titre="Où part le temps"
            description="Médiane et p90 par étape — le p90 dit ce qui dérape"
          />
          {donneesEtapes.length === 0 ? (
            <EmptyState
              titre="Aucune mesure"
              description="Le temps par étape se calcule depuis les heures de validation de la checklist, sur le terrain. Il apparaîtra dès le premier chantier coché au fur et à mesure."
            />
          ) : (
            <CardBody>
              <GraphiqueEtapesLazy donnees={donneesEtapes} />
            </CardBody>
          )}
        </Card>
      </section>

      {/* ================= Bloc 4 — Rentabilité */}
      <section className="mb-7">
        <Card>
          <CardHeader
            titre="Rentabilité"
            description="CA horaire médian par service et taille de chantier"
          />
          {cellules.length === 0 ? (
            <EmptyState
              titre="Aucun chantier facturé"
              description="La matrice se remplit dès la première facture encaissée. Chaque case indiquera combien vous gagnez par heure sur ce type de chantier."
            />
          ) : (
            <CardBody>
              <Matrice
                cellules={cellules}
                lignes={services.map((s) => ({ cle: s, libelle: LIBELLES_SERVICE[s] ?? s }))}
                colonnes={BANDES}
                libelleLigne="Service"
                libelleColonne="Surface"
              />
            </CardBody>
          )}
        </Card>
      </section>

      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        {/* ================= Bloc 7 — Opportunités */}
        <Card>
          <CardHeader titre="Où prospecter" description="Communes classées par CA horaire" />
          {(communes.data ?? []).length === 0 ? (
            <EmptyState
              titre="Aucune commune évaluée"
              description="Il faut au moins trois chantiers facturés dans une commune pour la classer honnêtement."
            />
          ) : (
            <CardBody className="px-0 py-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Commune</Th>
                    <Th className="text-right">CA/h</Th>
                    <Th className="text-right">Panier</Th>
                    <Th className="text-right">Retour</Th>
                    <Th>Confiance</Th>
                  </tr>
                </thead>
                <tbody>
                  {(communes.data ?? []).map((c) => (
                    <tr key={String(c.commune)}>
                      <Td className="font-medium">{String(c.commune)}</Td>
                      <Td className="tabular text-right">
                        {c.ca_horaire !== null ? formatEUR(Number(c.ca_horaire)) : '—'}
                      </Td>
                      <Td className="tabular text-right">
                        {c.panier !== null ? formatEUR(Number(c.panier)) : '—'}
                      </Td>
                      <Td className="tabular text-right">
                        {c.recurrence_pct !== null
                          ? `${Math.round(Number(c.recurrence_pct))} %`
                          : '—'}
                      </Td>
                      <Td>
                        <Confiance
                          niveau={c.confiance as NiveauConfiance}
                          n={Number(c.chantiers)}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>

        {/* ================= Bloc 8 — Équipes */}
        <Card>
          <CardHeader
            titre="Équipes"
            description="Comparaison uniquement si les seuils le permettent"
          />
          {(equipes.data ?? []).filter((e) => Number(e.chantiers) >= SEUIL_OBSERVATIONS)
            .length < 2 ? (
            <EmptyState
              titre="Données insuffisantes"
              description={`Comparer deux équipes exige au moins ${SEUIL_OBSERVATIONS} chantiers chacune. En dessous, l'écart mesure le hasard des chantiers attribués, pas l'efficacité.`}
            />
          ) : (
            <CardBody className="px-0 py-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Équipe</Th>
                    <Th className="text-right">min/m²</Th>
                    <Th className="text-right">Photo</Th>
                    <Th className="text-right">Suspectes</Th>
                    <Th>Confiance</Th>
                  </tr>
                </thead>
                <tbody>
                  {(equipes.data ?? [])
                    .filter((e) => Number(e.chantiers) >= SEUIL_OBSERVATIONS)
                    .map((e) => (
                      <tr key={String(e.team_id)}>
                        <Td className="font-medium">{String(e.equipe)}</Td>
                        <Td className="tabular text-right">
                          {e.mediane_min_m2 !== null
                            ? Number(e.mediane_min_m2).toFixed(1)
                            : '—'}
                        </Td>
                        <Td className="tabular text-right">
                          {e.couverture_photo !== null
                            ? `${Math.round(Number(e.couverture_photo))} %`
                            : '—'}
                        </Td>
                        <Td className="tabular text-right">
                          {Number(e.checklists_suspectes) > 0 ? (
                            <span className="text-alerte">
                              {Number(e.checklists_suspectes)}
                            </span>
                          ) : (
                            '0'
                          )}
                        </Td>
                        <Td>
                          <Confiance
                            niveau={e.confiance as NiveauConfiance}
                            n={Number(e.chantiers)}
                          />
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>
      </div>

      {/* ================= Bloc 9 — Historique */}
      <section className="mb-7">
        <Card>
          <CardHeader
            titre="Évolution"
            description="Par trimestre — à ce volume, une courbe mensuelle ne montrerait que du bruit"
          />
          {pointsEvolution.length < 2 ? (
            <EmptyState
              titre="Pas encore d'historique"
              description="Une évolution demande au moins deux trimestres d'activité. Le premier point apparaîtra à la fin du trimestre en cours."
            />
          ) : (
            <CardBody className="grid gap-6 lg:grid-cols-3">
              {[
                { serie: 'caHoraire' as const, titre: 'CA horaire' },
                { serie: 'cadence' as const, titre: 'Cadence' },
                { serie: 'panier' as const, titre: 'Panier médian' },
              ].map((g) => (
                <div key={g.serie}>
                  <p className="mb-2 text-[0.8125rem] font-medium">{g.titre}</p>
                  <GraphiqueEvolutionLazy donnees={pointsEvolution} serie={g.serie} />
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      </section>

      {/* ================= Base de connaissances */}
      <Card>
        <CardHeader
          titre="Ce que vous pouvez déjà savoir"
          description="Chaque réponse porte le nombre d'observations qui la fonde"
        />
        <CardBody className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
          {[
            { q: 'Combien de temps pour une maison de 140 m² ?', r: tempsRef },
            { q: 'Quelle marge horaire ?', r: marge },
            { q: 'Quelle équipe est la plus efficace ?', r: equipe },
            { q: 'Quelle commune est la plus rentable ?', r: commune },
            { q: 'Quel service fidélise le plus ?', r: fidelisation },
          ].map(({ q, r }) => (
            <div key={q}>
              <p className="text-ardoise text-[0.8125rem] font-medium">{q}</p>
              <p className="mt-0.5 text-sm">{r.phrase}</p>
              <div className="mt-1.5">
                <Confiance niveau={r.confiance} n={r.n} />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <p className="text-ardoise mt-5 text-[0.75rem] leading-relaxed">
        Seuls les chantiers <strong>terminés et facturés</strong> entrent dans ces statistiques.
        Les chantiers dont la checklist a été cochée après coup en sont exclus : leurs durées ne
        mesurent rien.
      </p>
    </>
  );
}
