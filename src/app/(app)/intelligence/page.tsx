import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  experiences as chargerExperiences,
  indicateurs,
  recommandations as chargerRecommandations,
} from '@/lib/services/analytics';
import { gainCumule, raisonAucuneRecommandation } from '@/lib/recommandations';
import { suggererDepuisRecommandation } from '@/lib/experiences';
import { SEUIL_OBSERVATIONS } from '@/lib/alertes';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Confiance } from '@/components/ui/confiance';
import { EmptyState } from '@/components/ui/empty-state';
import { CarteDecision } from './decision';
import { CarteExperience, LancerExperience } from './experience-panneau';
import { formatDate, formatEUR } from '@/lib/format';

export const metadata: Metadata = { title: 'Intelligence' };
export const dynamic = 'force-dynamic';

/**
 * SUITON Intelligence.
 *
 * Un seul ecran, une seule question : que faire cette semaine pour gagner
 * plus d'argent avec moins de temps ?
 *
 * Le systeme PROPOSE, le dirigeant VALIDE, le resultat est MESURE. Aucune
 * fonction de cette page ne modifie la grille tarifaire.
 */
export default async function IntelligencePage() {
  await requireCapability('dashboard.view');
  const supabase = await createClient();

  const [recos, exps, ind, decisions] = await Promise.all([
    chargerRecommandations(),
    chargerExperiences(),
    indicateurs(),
    supabase
      .from('recommandations')
      .select('code, titre, statut, motif_rejet, decide_le, gain_min, gain_max')
      .in('statut', ['acceptee', 'rejetee'])
      .order('decide_le', { ascending: false })
      .limit(8),
  ]);

  const total = gainCumule(recos);

  const opportunites = recos.filter(
    (r) => r.famille === 'prospection' || r.famille === 'tarification',
  );
  const risques = recos.filter((r) => r.famille === 'qualite' || r.famille === 'productivite');

  const suggestions = recos
    .map((r) => suggererDepuisRecommandation(r))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const enCours = exps.filter((e) => e.statut === 'en_cours');
  const terminees = exps.filter((e) => e.statut === 'terminee');
  const acceptees = (decisions.data ?? []).filter((d) => d.statut === 'acceptee');

  return (
    <>
      <PageHeader
        titre="Intelligence"
        description="Ce qu'il faut faire cette semaine pour gagner plus avec moins de temps."
        action={
          <span className="flex items-center gap-2">
            <Confiance niveau={ind.confiance} n={ind.chantiersComplets} />
            <Link href="/donnees">
              <Button variant="secondaire" size="sm">
                Données
              </Button>
            </Link>
          </span>
        }
      />

      {/* ===== Les décisions de la semaine ================================ */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">
            {recos.length > 0
              ? `Les ${recos.length} décision${recos.length > 1 ? 's' : ''} de la semaine`
              : 'Décisions'}
          </h2>
          {recos.length > 0 && total.min > 0 ? (
            <p className="tabular text-ardoise text-[0.8125rem]">
              Gain cumulé estimé :{' '}
              <span className="text-abysse font-semibold">
                {formatEUR(total.min)} à {formatEUR(total.max)}
              </span>{' '}
              par an
            </p>
          ) : null}
        </div>

        {recos.length === 0 ? (
          <Card>
            <CardBody className="py-6">
              <p className="text-ardoise text-sm leading-relaxed">
                {raisonAucuneRecommandation(ind.chantiersComplets)}
              </p>
              {ind.chantiersComplets < SEUIL_OBSERVATIONS ? (
                <p className="text-ardoise mt-3 text-[0.8125rem] leading-relaxed">
                  Ce n&apos;est pas une limite technique. Un moteur qui recommanderait une
                  hausse tarifaire sur trois chantiers vous ferait perdre de l&apos;argent avec
                  assurance — et c&apos;est bien pire que de ne rien dire.
                </p>
              ) : null}
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {recos.map((r, i) => (
              <CarteDecision key={r.code} reco={r} rang={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* ===== Opportunités / Risques ==================================== */}
      {recos.length > 0 ? (
        <div className="mb-8 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader titre="Où gagner plus" description="Tarification et prospection" />
            {opportunites.length === 0 ? (
              <CardBody>
                <p className="text-ardoise text-sm">
                  Aucun levier commercial identifié : vos prix et vos zones correspondent à ce
                  que mesurent vos chantiers.
                </p>
              </CardBody>
            ) : (
              <CardBody className="flex flex-col gap-2.5">
                {opportunites.map((r) => (
                  <div
                    key={r.code}
                    className="border-mineral-dark border-b pb-2.5 last:border-0 last:pb-0"
                  >
                    <p className="text-[0.8125rem] font-medium">{r.titre}</p>
                    <p className="tabular text-ardoise mt-0.5 text-[0.8125rem]">
                      {r.gainMin !== null && r.gainMax !== null
                        ? `${formatEUR(r.gainMin)} à ${formatEUR(r.gainMax)} par an`
                        : 'gain non chiffrable'}
                    </p>
                  </div>
                ))}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader titre="Où vous perdez" description="Qualité et productivité" />
            {risques.length === 0 ? (
              <CardBody>
                <p className="text-ardoise text-sm">
                  Aucune fuite détectée : retouches et temps par étape sont dans les clous.
                </p>
              </CardBody>
            ) : (
              <CardBody className="flex flex-col gap-2.5">
                {risques.map((r) => (
                  <div
                    key={r.code}
                    className="border-mineral-dark border-b pb-2.5 last:border-0 last:pb-0"
                  >
                    <p className="text-[0.8125rem] font-medium">{r.titre}</p>
                    <p className="text-ardoise mt-0.5 text-[0.8125rem]">
                      {r.gainNonMonetaire ??
                        (r.gainMin !== null ? `${formatEUR(r.gainMin)} récupérables` : '')}
                    </p>
                  </div>
                ))}
              </CardBody>
            )}
          </Card>
        </div>
      ) : null}

      {/* ===== Expériences =============================================== */}
      <section className="mb-8">
        <h2 className="font-heading mb-3 text-lg font-semibold">Expériences</h2>

        <Alert ton="info" className="mb-4">
          Le système ne modifie jamais votre grille tarifaire. Il propose, vous validez, le
          résultat est mesuré. Une hausse de prix ne se rebaisse pas sans abîmer l&apos;image :{' '}
          <strong>autant la tester sur un seul gabarit avant d&apos;en faire une règle.</strong>
        </Alert>

        {enCours.length > 0 ? (
          <div className="mb-4 flex flex-col gap-4">
            {enCours.map((e) => (
              <CarteExperience key={e.id} experience={e} />
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader
            titre={
              suggestions.length > 0
                ? 'Ce que les données suggèrent de tester'
                : 'Nouvelle expérience'
            }
          />
          <CardBody className="flex flex-col gap-4">
            {suggestions.length > 0 ? (
              <div className="flex flex-col gap-3">
                {suggestions.slice(0, 2).map((s) => (
                  <div key={s.code} className="rounded-suiton bg-mineral px-3.5 py-3">
                    <p className="text-sm font-medium">{s.titre}</p>
                    <p className="text-ardoise mt-1 text-[0.8125rem] italic">
                      « {s.hypothese} »
                    </p>
                    <p className="text-ardoise mt-1.5 text-[0.8125rem]">{s.justification}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ardoise text-sm">
                Aucune expérience suggérée pour l&apos;instant. Vous pouvez toujours en lancer
                une : nouveau matériel, nouveau processus, nouvelle organisation d&apos;équipe.
              </p>
            )}

            <LancerExperience suggestion={suggestions[0] ?? null} />
          </CardBody>
        </Card>

        {terminees.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {terminees.slice(0, 3).map((e) => (
              <CarteExperience key={e.id} experience={e} />
            ))}
          </div>
        ) : null}
      </section>

      {/* ===== Historique des décisions ================================== */}
      {(decisions.data ?? []).length > 0 ? (
        <Card>
          <CardHeader
            titre="Ce que vous avez décidé"
            description={
              acceptees.length > 0
                ? `${acceptees.length} recommandation${acceptees.length > 1 ? 's appliquées' : ' appliquée'}`
                : undefined
            }
          />
          <CardBody className="flex flex-col gap-2.5">
            {(decisions.data ?? []).map((d) => (
              <div
                key={String(d.code)}
                className="border-mineral-dark flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2.5 last:border-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="text-[0.8125rem] font-medium">{String(d.titre)}</span>
                  {d.motif_rejet ? (
                    <span className="text-ardoise mt-0.5 block text-[0.75rem]">
                      Écartée : {String(d.motif_rejet)}
                    </span>
                  ) : null}
                </span>
                <span className="text-ardoise shrink-0 text-[0.75rem]">
                  {d.statut === 'acceptee' ? 'Appliquée' : 'Écartée'}
                  {d.decide_le ? ` · ${formatDate(String(d.decide_le))}` : ''}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <EmptyState
            titre="Aucune décision enregistrée"
            description="Chaque recommandation acceptée ou écartée est tracée ici, avec son motif. C'est ce qui permet, dans six mois, de savoir ce qu'on a fait d'une proposition — et si c'était la bonne."
          />
        </Card>
      )}
    </>
  );
}
