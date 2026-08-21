'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/input';
import { Confiance } from '@/components/ui/confiance';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import { deciderAction, type DecisionState } from './actions';
import type { Recommandation, Urgence } from '@/lib/recommandations';

const URGENCES: Record<Urgence, { libelle: string; classe: string }> = {
  immediate: { libelle: 'Maintenant', classe: 'text-danger' },
  ce_mois: { libelle: 'Ce mois', classe: 'text-alerte' },
  quand_possible: { libelle: 'Quand possible', classe: 'text-ardoise' },
};

const FAMILLES: Record<string, string> = {
  tarification: 'Tarification',
  planning: 'Planning',
  prospection: 'Prospection',
  qualite: 'Qualité',
  productivite: 'Productivité',
};

function Bouton({
  libelle,
  enCours,
  variant,
}: {
  libelle: string;
  enCours: string;
  variant: 'preuve' | 'secondaire';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? enCours : libelle}
    </Button>
  );
}

/**
 * Carte de decision.
 *
 * Le gain est affiche en FOURCHETTE, jamais en chiffre unique. L'ecart entre
 * les deux bornes est l'information la plus utile de la carte : il dit ce
 * qu'on ignore.
 *
 * Le raisonnement est depliable mais present : une recommandation qu'on ne
 * peut pas contester finit par etre suivie aveuglement ou ignoree — les deux
 * sont mauvais.
 */
export function CarteDecision({ reco, rang }: { reco: Recommandation; rang: number }) {
  const [etat, action] = useActionState<DecisionState, FormData>(deciderAction, {});
  const [motifOuvert, setMotifOuvert] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState(false);

  const champs = (
    <>
      <input type="hidden" name="code" value={reco.code} />
      <input type="hidden" name="famille" value={reco.famille} />
      <input type="hidden" name="titre" value={reco.titre} />
      <input type="hidden" name="action" value={reco.action} />
      <input type="hidden" name="gainMin" value={reco.gainMin ?? ''} />
      <input type="hidden" name="gainMax" value={reco.gainMax ?? ''} />
      <input type="hidden" name="chantiers" value={reco.chantiersConcernes} />
      <input type="hidden" name="confiance" value={reco.confiance} />
      <input
        type="hidden"
        name="contexte"
        value={JSON.stringify({ explication: reco.explication, hypotheses: reco.hypotheses })}
      />
    </>
  );

  if (etat.ok) {
    return (
      <div className="rounded-suiton border-mineral-dark bg-mineral border px-4 py-3">
        <p className="text-ardoise text-sm">{etat.message}</p>
      </div>
    );
  }

  return (
    <article className="rounded-suiton border-mineral-dark overflow-hidden border bg-white">
      <div className="border-mineral-dark border-b px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="bg-abysse text-mineral flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold">
            {rang}
          </span>
          <span className="text-aqua-deep text-[0.6875rem] font-semibold tracking-wide uppercase">
            {FAMILLES[reco.famille] ?? reco.famille}
          </span>
          <span
            className={cn(
              'text-[0.6875rem] font-semibold tracking-wide uppercase',
              URGENCES[reco.urgence].classe,
            )}
          >
            {URGENCES[reco.urgence].libelle}
          </span>
          <Confiance niveau={reco.confiance} n={reco.chantiersConcernes} />
        </div>

        <h3 className="font-heading mt-2 text-base leading-snug font-semibold">{reco.titre}</h3>
        <p className="text-ardoise mt-1 text-sm leading-relaxed">{reco.action}</p>
      </div>

      {/* --- Gain --------------------------------------------------------- */}
      <div className="bg-mineral flex flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-3">
        <div>
          <p className="text-ardoise text-[0.6875rem] tracking-wide uppercase">
            Gain estimé par an
          </p>
          <p className="tabular font-heading mt-0.5 text-lg font-semibold">
            {reco.gainMin !== null && reco.gainMax !== null ? (
              <>
                {formatEUR(reco.gainMin)} <span className="text-ardoise">à</span>{' '}
                {formatEUR(reco.gainMax)}
              </>
            ) : (
              <span className="text-ardoise-clair">non chiffrable</span>
            )}
          </p>
        </div>

        {reco.gainNonMonetaire ? (
          <div>
            <p className="text-ardoise text-[0.6875rem] tracking-wide uppercase">Aussi</p>
            <p className="mt-0.5 text-sm font-medium">{reco.gainNonMonetaire}</p>
          </div>
        ) : null}
      </div>

      {/* --- Raisonnement -------------------------------------------------- */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setDetailOuvert((v) => !v)}
          aria-expanded={detailOuvert}
          className="text-ocean text-[0.8125rem] font-medium underline-offset-2 hover:underline"
        >
          {detailOuvert ? 'Masquer le raisonnement' : 'Sur quoi repose ce chiffre ?'}
        </button>

        {detailOuvert ? (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="text-ardoise mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
                Ce que disent vos chantiers
              </p>
              <ul className="flex flex-col gap-1">
                {reco.explication.map((e) => (
                  <li key={e} className="flex gap-2 text-[0.8125rem] leading-relaxed">
                    <span
                      aria-hidden
                      className="bg-aqua-deep mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-suiton bg-alerte-wash px-3 py-2.5">
              <p className="text-alerte mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
                Ce que le calcul suppose
              </p>
              <ul className="flex flex-col gap-1">
                {reco.hypotheses.map((h) => (
                  <li key={h} className="flex gap-2 text-[0.8125rem] leading-relaxed">
                    <span
                      aria-hidden
                      className="bg-alerte mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      {/* --- Décision ------------------------------------------------------ */}
      <div className="border-mineral-dark flex flex-wrap items-center gap-2 border-t px-4 py-3">
        {etat.error ? (
          <Alert ton="danger" className="mb-2 w-full">
            {etat.error}
          </Alert>
        ) : null}

        <form action={action}>
          {champs}
          <input type="hidden" name="statut" value="acceptee" />
          <Bouton libelle="J'applique" enCours="…" variant="preuve" />
        </form>

        {reco.experience ? (
          <span className="text-ardoise text-[0.75rem]">
            ou testez-la {reco.experience.dureeJours} jours avant de généraliser
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => setMotifOuvert((v) => !v)}
          className="text-ardoise ml-auto text-[0.8125rem] underline-offset-2 hover:underline"
        >
          Écarter
        </button>
      </div>

      {motifOuvert ? (
        <form action={action} className="bg-mineral flex flex-col gap-2.5 px-4 py-3">
          {champs}
          <input type="hidden" name="statut" value="rejetee" />
          <label htmlFor={`motif-${reco.code}`} className="text-[0.8125rem] font-medium">
            Pourquoi l&apos;écartez-vous ?
          </label>
          <Textarea
            id={`motif-${reco.code}`}
            name="motif"
            rows={2}
            maxLength={500}
            required
            placeholder="Le marché ne le supporterait pas · déjà tenté l'an dernier · pas la priorité…"
          />
          <p className="text-ardoise text-[0.75rem]">
            Un rejet sans motif ne s&apos;apprend pas : dans six mois, on ne saura plus si
            c&apos;était une mauvaise idée ou juste le mauvais moment.
          </p>
          <div className="flex gap-2">
            <Bouton libelle="Confirmer" enCours="…" variant="secondaire" />
            <Button variant="discret" size="sm" onClick={() => setMotifOuvert(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
