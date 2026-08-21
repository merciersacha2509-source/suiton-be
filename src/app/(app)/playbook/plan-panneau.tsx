'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Confiance } from '@/components/ui/confiance';
import { formatEUR } from '@/lib/format';
import { accepterEtLancerAction, reporterAction, type PlaybookState } from './actions';
import type { Plan } from '@/lib/playbook';
import type { Recommandation } from '@/lib/recommandations';
import { deciderAction, type DecisionState } from '../intelligence/actions';

function Soumettre({
  libelle,
  variant = 'primary',
  disabled,
}: {
  libelle: string;
  variant?: 'primary' | 'secondaire' | 'preuve';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? '…' : libelle}
    </Button>
  );
}

/**
 * Les trois actions : accepter, reporter, ecarter.
 *
 * Accepter LANCE l'experience — c'est le maillon qui fermait mal la boucle.
 * Une recommandation acceptee qui ne devient pas un test mesure n'apprend
 * rien.
 */
export function PanneauActions({ reco, plan }: { reco: Recommandation; plan: Plan }) {
  const [lancement, lancer] = useActionState<PlaybookState, FormData>(
    accepterEtLancerAction,
    {},
  );
  const [report, reporter] = useActionState<PlaybookState, FormData>(reporterAction, {});
  const [rejet, ecarter] = useActionState<DecisionState, FormData>(deciderAction, {});
  const [ouvert, setOuvert] = useState<'aucun' | 'reporter' | 'ecarter'>('aucun');

  const parties = reco.code.split(':');
  const dansUnMois = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const commun = (
    <>
      <input type="hidden" name="code" value={reco.code} />
      <input type="hidden" name="famille" value={reco.famille} />
      <input type="hidden" name="titre" value={reco.titre} />
      <input type="hidden" name="action" value={reco.action} />
    </>
  );

  const etat = lancement.ok ? lancement : report.ok ? report : rejet.ok ? rejet : null;

  if (etat?.ok) {
    return (
      <Alert ton="succes" titre="C’est enregistré">
        {etat.message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader titre="Que décidez-vous ?" />
      <CardBody className="flex flex-col gap-4">
        {lancement.error ? <Alert ton="danger">{lancement.error}</Alert> : null}
        {report.error ? <Alert ton="danger">{report.error}</Alert> : null}
        {rejet.error ? <Alert ton="danger">{rejet.error}</Alert> : null}

        {!plan.viable ? (
          <Alert ton="alerte" titre="Ce test ne pourra pas conclure">
            {plan.obstacle}
          </Alert>
        ) : null}

        {/* --- Accepter : lance l'expérience ---------------------------- */}
        <form action={lancer} className="flex flex-col gap-3.5">
          {commun}
          <input type="hidden" name="modeleCode" value={plan.modele.code} />
          <input type="hidden" name="indicateur" value={plan.indicateur} />
          <input type="hidden" name="seuilEffet" value={plan.seuilEffetPct} />
          <input type="hidden" name="seuilN" value={plan.seuilN} />
          <input type="hidden" name="gainMin" value={reco.gainMin ?? ''} />
          <input type="hidden" name="gainMax" value={reco.gainMax ?? ''} />
          <input type="hidden" name="chantiers" value={reco.chantiersConcernes} />
          <input type="hidden" name="confiance" value={reco.confiance} />
          <input type="hidden" name="service" value={parties[1] ?? ''} />
          <input type="hidden" name="propertyType" value={parties[2] ?? ''} />
          <input type="hidden" name="bande" value={parties[3] ?? ''} />
          <input type="hidden" name="soil" value={parties[4] ?? ''} />

          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <Field label="Ce que vous changez" required>
              {(p) => (
                <Input
                  {...p}
                  name="intervention"
                  defaultValue={plan.intervention}
                  required
                  maxLength={300}
                />
              )}
            </Field>
            <Field label="Durée (jours)">
              {(p) => (
                <Input
                  {...p}
                  name="dureeJours"
                  type="number"
                  min={30}
                  max={365}
                  defaultValue={plan.dureeJours}
                />
              )}
            </Field>
          </div>

          <Field
            label="Hypothèse"
            required
            hint="Formulez-la de façon à pouvoir être démentie."
          >
            {(p) => (
              <Textarea
                {...p}
                name="hypothese"
                rows={2}
                defaultValue={plan.hypothese}
                required
              />
            )}
          </Field>

          <Soumettre libelle="Accepter et lancer l’expérience" variant="preuve" />
        </form>

        <div className="border-mineral-dark flex flex-wrap items-center gap-3 border-t pt-3">
          <button
            type="button"
            onClick={() => setOuvert(ouvert === 'reporter' ? 'aucun' : 'reporter')}
            className="text-ocean text-[0.8125rem] underline-offset-2 hover:underline"
          >
            Reporter
          </button>
          <button
            type="button"
            onClick={() => setOuvert(ouvert === 'ecarter' ? 'aucun' : 'ecarter')}
            className="text-ardoise text-[0.8125rem] underline-offset-2 hover:underline"
          >
            Écarter
          </button>
        </div>

        {ouvert === 'reporter' ? (
          <form
            action={reporter}
            className="rounded-suiton bg-mineral flex flex-col gap-2.5 p-3.5"
          >
            {commun}
            <Field label="Réexaminer le" required>
              {(p) => (
                <Input {...p} type="date" name="date" defaultValue={dansUnMois} required />
              )}
            </Field>
            <p className="text-ardoise text-[0.75rem]">
              Elle disparaîtra de la liste et réapparaîtra à cette date.
            </p>
            <Soumettre libelle="Reporter" variant="secondaire" />
          </form>
        ) : null}

        {ouvert === 'ecarter' ? (
          <form
            action={ecarter}
            className="rounded-suiton bg-mineral flex flex-col gap-2.5 p-3.5"
          >
            {commun}
            <input type="hidden" name="statut" value="rejetee" />
            <input type="hidden" name="gainMin" value={reco.gainMin ?? ''} />
            <input type="hidden" name="gainMax" value={reco.gainMax ?? ''} />
            <input type="hidden" name="chantiers" value={reco.chantiersConcernes} />
            <input type="hidden" name="confiance" value={reco.confiance} />

            <Field label="Pourquoi l’écartez-vous ?" required>
              {(p) => <Textarea {...p} name="motif" rows={2} required maxLength={500} />}
            </Field>
            <p className="text-ardoise text-[0.75rem]">
              Sans motif, dans six mois, on ne saura plus si c’était une mauvaise idée ou juste
              le mauvais moment.
            </p>
            <Soumettre libelle="Confirmer" variant="secondaire" />
          </form>
        ) : null}

        <div className="rounded-suiton bg-mineral px-3.5 py-3">
          <p className="text-ardoise text-[0.75rem] leading-relaxed">
            <strong className="text-abysse">Le système ne touche jamais à votre grille.</strong>{' '}
            Il lance le test, mesure, puis vous proposera de généraliser, prolonger ou arrêter.
            La décision reste la vôtre à chaque étape.
          </p>
        </div>

        {reco.gainMin !== null && reco.gainMax !== null ? (
          <p className="tabular text-ardoise text-[0.8125rem]">
            Gain estimé si le test confirme : {formatEUR(reco.gainMin)} à{' '}
            {formatEUR(reco.gainMax)} par an{' '}
            <Confiance niveau={reco.confiance} n={reco.chantiersConcernes} />
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
