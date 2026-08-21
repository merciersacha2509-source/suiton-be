import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  bilanAnnuel,
  experiences as chargerExperiences,
  indicateurs,
  modelesPlaybook,
  planPour,
  recommandations as chargerRecommandations,
} from '@/lib/services/analytics';
import { proposerDecision, raconter, type DecisionFinale } from '@/lib/playbook';
import { raisonAucuneRecommandation } from '@/lib/recommandations';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Confiance } from '@/components/ui/confiance';
import { EmptyState } from '@/components/ui/empty-state';
import { PanneauActions } from './plan-panneau';
import { Trancher } from './trancher';
import { formatDate, formatEUR, formatDuration } from '@/lib/format';

export const metadata: Metadata = { title: 'Playbook' };
export const dynamic = 'force-dynamic';

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  en_cours: { libelle: 'Active', classe: 'text-aqua-deep' },
  terminee: { libelle: 'Terminée', classe: 'text-ardoise' },
  abandonnee: { libelle: 'Abandonnée', classe: 'text-danger' },
  brouillon: { libelle: 'En attente', classe: 'text-alerte' },
};

/**
 * SUITON Playbook.
 *
 *   observation → recommandation → décision → expérience → mesure → référence
 *
 * Cette page ferme la boucle : accepter une recommandation LANCE le test qui
 * la validera ou l'infirmera.
 */
export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  await requireCapability('dashboard.view');
  const { plan: codePlan } = await searchParams;
  const supabase = await createClient();

  const annee = new Date().getFullYear();

  const [recos, exps, ind, modeles, bilan, planDetail, memoire] = await Promise.all([
    chargerRecommandations(),
    chargerExperiences(),
    indicateurs(),
    modelesPlaybook(),
    bilanAnnuel(annee),
    codePlan ? planPour(codePlan) : Promise.resolve(null),
    supabase.from('memoire_entreprise').select('*').limit(15),
  ]);

  const actives = exps.filter((e) => e.statut === 'en_cours');

  return (
    <>
      <PageHeader
        titre="Playbook"
        description="De la recommandation à la preuve, sans rien décider à votre place."
        action={
          <span className="flex items-center gap-2">
            <Confiance niveau={ind.confiance} n={ind.chantiersComplets} />
            <Link href="/intelligence">
              <Button variant="secondaire" size="sm">
                Intelligence
              </Button>
            </Link>
          </span>
        }
      />

      {/* ===== Le plan ouvert ============================================ */}
      {planDetail ? (
        <section className="mb-8">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-aqua-deep text-[0.6875rem] font-semibold tracking-wide uppercase">
                Plan d&apos;exécution
              </p>
              <h2 className="font-heading mt-1 text-xl font-semibold">
                {planDetail.recommandation.titre}
              </h2>
              <p className="text-ardoise mt-1 text-sm">{planDetail.recommandation.action}</p>
            </div>
            <Link href="/playbook">
              <Button variant="discret" size="sm">
                Fermer
              </Button>
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader
                  titre={planDetail.plan.modele.titre}
                  description={planDetail.plan.modele.description}
                />
                <CardBody className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { l: 'Durée', v: `${planDetail.plan.dureeJours} j` },
                      { l: 'Chantiers attendus', v: String(planDetail.plan.chantiersAttendus) },
                      { l: 'Minimum requis', v: String(planDetail.plan.seuilN) },
                      { l: 'Effet significatif', v: `${planDetail.plan.seuilEffetPct} %` },
                    ].map((c) => (
                      <div key={c.l} className="rounded-suiton bg-mineral px-3 py-2.5">
                        <p className="text-ardoise text-[0.6875rem] tracking-wide uppercase">
                          {c.l}
                        </p>
                        <p className="tabular font-heading mt-0.5 text-base font-semibold">
                          {c.v}
                        </p>
                      </div>
                    ))}
                  </div>

                  {planDetail.plan.prerequis.length > 0 ? (
                    <div>
                      <p className="text-ardoise mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
                        À préparer avant de lancer
                      </p>
                      <ul className="flex flex-col gap-1">
                        {planDetail.plan.prerequis.map((p) => (
                          <li key={p} className="flex gap-2 text-[0.8125rem] leading-relaxed">
                            <span
                              aria-hidden
                              className="bg-aqua-deep mt-1.5 h-1 w-1 shrink-0 rounded-full"
                            />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {planDetail.plan.vigilance.length > 0 ? (
                    <div className="rounded-suiton bg-alerte-wash px-3.5 py-3">
                      <p className="text-alerte mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
                        À surveiller pendant
                      </p>
                      <ul className="flex flex-col gap-1">
                        {planDetail.plan.vigilance.map((v) => (
                          <li key={v} className="flex gap-2 text-[0.8125rem] leading-relaxed">
                            <span
                              aria-hidden
                              className="bg-alerte mt-1.5 h-1 w-1 shrink-0 rounded-full"
                            />
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardBody>
              </Card>

              {/* Le dossier : les chantiers derrière la décision */}
              <Card>
                <CardHeader
                  titre="Les chantiers concernés"
                  description="Vérifiez sur pièces avant de décider"
                />
                {planDetail.comparables.length === 0 ? (
                  <CardBody>
                    <p className="text-ardoise text-sm">
                      Aucun chantier facturé sur ce périmètre.
                    </p>
                  </CardBody>
                ) : (
                  <CardBody className="px-0 py-0">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Référence</Th>
                          <Th>Commune</Th>
                          <Th className="text-right">Surface</Th>
                          <Th className="text-right">Durée</Th>
                          <Th className="text-right">Facturé</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {planDetail.comparables.slice(0, 10).map((c) => (
                          <tr key={String(c.job_id)}>
                            <Td>
                              <Link
                                href={`/chantiers/${String(c.job_id)}`}
                                className="tabular text-ocean font-medium underline-offset-2 hover:underline"
                              >
                                {String(c.reference)}
                              </Link>
                            </Td>
                            <Td>{String(c.commune)}</Td>
                            <Td className="tabular text-right">{Number(c.surface_m2)} m²</Td>
                            <Td className="tabular text-right">
                              {formatDuration(Number(c.duree_reelle_min ?? 0))}
                            </Td>
                            <Td className="tabular text-right">
                              {c.facture_htva !== null
                                ? formatEUR(Number(c.facture_htva))
                                : '—'}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardBody>
                )}
              </Card>
            </div>

            <PanneauActions reco={planDetail.recommandation} plan={planDetail.plan} />
          </div>
        </section>
      ) : (
        <>
          {/* ===== Recommandations à exécuter ============================ */}
          <section className="mb-8">
            <h2 className="font-heading mb-3 text-lg font-semibold">À décider</h2>

            {recos.length === 0 ? (
              <Card>
                <CardBody className="py-6">
                  <p className="text-ardoise text-sm leading-relaxed">
                    {raisonAucuneRecommandation(ind.chantiersComplets)}
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recos.map((r) => (
                  <Link
                    key={r.code}
                    href={`/playbook?plan=${encodeURIComponent(r.code)}`}
                    className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex flex-wrap items-center justify-between gap-3 border bg-white px-4 py-3.5 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.titre}</span>
                      <span className="tabular text-ardoise mt-0.5 block text-[0.8125rem]">
                        {r.gainMin !== null && r.gainMax !== null
                          ? `${formatEUR(r.gainMin)} à ${formatEUR(r.gainMax)} par an`
                          : (r.gainNonMonetaire ?? '—')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Confiance niveau={r.confiance} n={r.chantiersConcernes} />
                      <span className="text-ocean text-[0.8125rem] font-medium">
                        Ouvrir le plan
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ===== Expériences ================================================ */}
      <section className="mb-8">
        <h2 className="font-heading mb-3 text-lg font-semibold">Expériences</h2>

        {exps.length === 0 ? (
          <Card>
            <EmptyState
              titre="Aucune expérience"
              description="Accepter une recommandation lance automatiquement le test qui la validera. Rien n'est appliqué sans mesure."
            />
          </Card>
        ) : (
          <Card>
            <CardBody className="px-0 py-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Objectif</Th>
                    <Th>Statut</Th>
                    <Th className="text-right">Observations</Th>
                    <Th>Confiance</Th>
                    <Th>Décision</Th>
                  </tr>
                </thead>
                <tbody>
                  {exps.map((e) => (
                    <tr key={e.id}>
                      <Td>
                        <span className="block font-medium">{e.titre}</span>
                        <span className="text-ardoise block text-[0.75rem]">
                          depuis le {formatDate(e.testDebut)}
                        </span>
                      </Td>
                      <Td>
                        <span className={STATUTS[e.statut]?.classe ?? 'text-ardoise'}>
                          {STATUTS[e.statut]?.libelle ?? e.statut}
                        </span>
                      </Td>
                      <Td className="tabular text-right">
                        {e.resultat.reference.n} → {e.resultat.test.n}
                      </Td>
                      <Td>
                        <Confiance
                          niveau={e.resultat.confiance}
                          n={Math.min(e.resultat.reference.n, e.resultat.test.n)}
                        />
                      </Td>
                      <Td className="text-[0.8125rem]">{e.resultat.conclusion}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        )}

        {actives.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {actives.map((e) => (
              <Card key={e.id}>
                <CardHeader titre={e.titre} description={`« ${e.hypothese} »`} />
                <CardBody>
                  <Trancher
                    experienceId={e.id}
                    proposition={proposerDecision({
                      resultat: e.resultat,
                      gainAttenduMin: null,
                      gainAttenduMax: null,
                    })}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      {/* ===== Ce que SUITON a changé ===================================== */}
      <section className="mb-8">
        <Card>
          <CardHeader
            titre={`Ce que SUITON Intelligence a changé en ${annee}`}
            description="Le logiciel mesure sa propre valeur — et dit ce que cette mesure vaut"
          />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { l: 'Généralisées', v: String(bilan.experiencesGeneralisees) },
                { l: 'Arrêtées', v: String(bilan.experiencesArretees) },
                { l: 'Recommandations écartées', v: String(bilan.recommandationsEcartees) },
                {
                  l: 'Valeur attribuée',
                  v: bilan.valeurAnnuelle > 0 ? formatEUR(bilan.valeurAnnuelle) : '—',
                },
              ].map((c) => (
                <div key={c.l} className="rounded-suiton bg-mineral p-4">
                  <p className="text-ardoise text-[0.8125rem] font-medium">{c.l}</p>
                  <p className="font-heading mt-1.5 text-2xl font-semibold">{c.v}</p>
                </div>
              ))}
            </div>

            <p className="text-sm leading-relaxed">{bilan.qualification}</p>

            {bilan.reserve ? (
              <Alert ton="alerte" titre="Ce que ce chiffre ne prouve pas">
                {bilan.reserve}
              </Alert>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {/* ===== Mémoire d'entreprise ======================================= */}
      <Card>
        <CardHeader
          titre="Mémoire d'entreprise"
          description="Ce que vous avez testé, et ce que vous en avez appris"
        />
        {(memoire.data ?? []).length === 0 ? (
          <EmptyState
            titre="Rien à relire encore"
            description="Chaque expérience close laissera ici une ligne, lisible dans trois ans : ce qui a été testé, sur quoi, avec quel résultat et quelle décision."
          />
        ) : (
          <CardBody className="flex flex-col gap-3">
            {(memoire.data ?? []).map((m) => (
              <p
                key={String(m.id)}
                className="border-mineral-dark border-b pb-3 text-[0.8125rem] leading-relaxed last:border-0 last:pb-0"
              >
                {raconter({
                  titre: String(m.titre),
                  perimetre: m.perimetre ? String(m.perimetre) : null,
                  intervention: m.intervention ? String(m.intervention) : null,
                  testDebut: String(m.test_debut),
                  testFin: m.test_fin ? String(m.test_fin) : null,
                  decision: String(m.decision) as DecisionFinale,
                  conclusion: m.conclusion ? String(m.conclusion) : null,
                  valeurAnnuelle: m.valeur_annuelle !== null ? Number(m.valeur_annuelle) : null,
                })}
              </p>
            ))}
          </CardBody>
        )}
      </Card>

      {/* ===== Modèles réutilisables ====================================== */}
      <Card className="mt-5">
        <CardHeader
          titre="Playbooks disponibles"
          description="Des trames éprouvées, pour ne pas réinventer la méthode à chaque test"
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {modeles.map((m) => (
            <div key={m.code} className="rounded-suiton border-mineral-dark border p-3.5">
              <p className="text-[0.8125rem] font-semibold">{m.titre}</p>
              <p className="text-ardoise mt-1 text-[0.8125rem] leading-relaxed">
                {m.description}
              </p>
              <p className="tabular text-ardoise mt-1.5 text-[0.75rem]">
                {m.duree_jours} jours · effet significatif à partir de {m.seuil_effet_pct} % ·{' '}
                {m.seuil_n} chantiers minimum
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <p className="text-ardoise mt-5 text-[0.75rem] leading-relaxed">
        SUITON OS ne modifie jamais votre grille tarifaire, votre planning ou vos procédures. Il
        observe, propose, mesure et documente. Chaque décision reste la vôtre — et chaque
        décision est enregistrée, pour qu&apos;on puisse la relire dans trois ans.
      </p>
    </>
  );
}
