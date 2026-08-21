'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { trancherAction, type PlaybookState } from './actions';
import type { PropositionDecision } from '@/lib/playbook';

const TONS = {
  generaliser: 'border-succes/25 bg-succes-wash',
  prolonger: 'border-alerte/25 bg-alerte-wash',
  arreter: 'border-danger/25 bg-danger-wash',
  en_attente: 'border-mineral-dark bg-mineral',
} as const;

function Soumettre({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? '…' : libelle}
    </Button>
  );
}

/**
 * Décision finale sur une expérience close.
 *
 * Le systeme PROPOSE — la proposition est pre-selectionnee, mais les trois
 * options restent ouvertes. Il ne modifie jamais la grille tarifaire : le
 * message final le rappelle explicitement.
 */
export function Trancher({
  experienceId,
  proposition,
}: {
  experienceId: string;
  proposition: PropositionDecision;
}) {
  const [etat, action] = useActionState<PlaybookState, FormData>(trancherAction, {});
  const [choix, setChoix] = useState(proposition.decision);

  if (etat.ok) {
    return <Alert ton="succes">{etat.message}</Alert>;
  }

  return (
    <div className={cn('rounded-suiton border p-4', TONS[proposition.decision])}>
      <p className="text-ardoise text-[0.6875rem] font-semibold tracking-wide uppercase">
        Le système propose
      </p>
      <p className="font-heading mt-1 text-base font-semibold">{proposition.titre}</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed">{proposition.justification}</p>

      {proposition.reserveAttribution ? (
        <p className="text-ardoise mt-2 text-[0.75rem] leading-relaxed">
          {proposition.reserveAttribution}
        </p>
      ) : null}

      {etat.error ? (
        <Alert ton="danger" className="mt-3">
          {etat.error}
        </Alert>
      ) : null}

      <form action={action} className="mt-3.5 flex flex-col gap-3">
        <input type="hidden" name="id" value={experienceId} />

        <fieldset className="flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">Votre décision</legend>
          {(
            [
              ['generaliser', 'Généraliser'],
              ['prolonger', 'Prolonger'],
              ['arreter', 'Arrêter'],
            ] as const
          ).map(([valeur, libelle]) => (
            <label
              key={valeur}
              className={cn(
                'rounded-suiton flex h-9 cursor-pointer items-center border px-3 text-[0.8125rem]',
                choix === valeur
                  ? 'border-abysse bg-abysse text-mineral'
                  : 'border-mineral-dark bg-white',
              )}
            >
              <input
                type="radio"
                name="decision"
                value={valeur}
                checked={choix === valeur}
                onChange={() => setChoix(valeur)}
                className="sr-only"
              />
              {libelle}
            </label>
          ))}
        </fieldset>

        <Field label="Ce que vous retenez" required>
          {(p) => (
            <Textarea
              {...p}
              name="conclusion"
              rows={2}
              required
              maxLength={600}
              defaultValue={proposition.justification}
            />
          )}
        </Field>

        {choix === 'generaliser' ? (
          <Field
            label="Valeur annuelle attribuée (€)"
            hint="Seule une généralisation porte une valeur. Laissez vide si le gain n’est pas chiffrable."
          >
            {(p) => (
              <Input
                {...p}
                name="valeur"
                type="number"
                min={0}
                step={100}
                defaultValue={proposition.valeurMin ?? ''}
              />
            )}
          </Field>
        ) : null}

        <Soumettre libelle="Enregistrer la décision" />
      </form>
    </div>
  );
}
