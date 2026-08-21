'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/cn';
import { cocherEtapeAction, type TerrainState } from './actions';
import type { ChecklistStep } from '@/types/database';

const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

function Bascule({ fait, libelle }: { fait: boolean; libelle: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={fait}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
        fait ? 'border-aqua-deep bg-aqua-deep' : 'border-ardoise-clair bg-white',
        pending && 'opacity-50',
      )}
    >
      <span className="sr-only">
        {fait ? 'Décocher' : 'Cocher'} : {libelle}
      </span>
      {fait ? (
        <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2 6.4 L4.6 9 L10 3"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ) : null}
    </button>
  );
}

/**
 * Checklist de chantier.
 *
 * Chaque etape est un formulaire independant : cocher la troisieme ne
 * recharge pas les cinq autres, et un reseau mobile capricieux ne fait
 * perdre qu'une seule action.
 *
 * L'horodatage vient du serveur. Six etapes validees a la meme minute
 * signalent une checklist cochee apres coup — et c'est precisement cet
 * horodatage qui rend la procedure opposable en cas de litige.
 */
export function Checklist({
  interventionId,
  etapes,
  faites,
  verrouille,
}: {
  interventionId: string;
  etapes: ChecklistStep[];
  faites: Map<number, string>;
  verrouille: boolean;
}) {
  const [, action] = useActionState<TerrainState, FormData>(cocherEtapeAction, {});
  const total = etapes.length;
  const nbFaites = etapes.filter((e) => faites.has(e.ordre)).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-ardoise text-[0.8125rem]">
          {nbFaites} sur {total} étapes
        </p>
        <div className="bg-mineral-dark h-1.5 w-28 overflow-hidden rounded-full">
          <div
            className="bg-aqua-deep h-full transition-all"
            style={{ width: `${(nbFaites / total) * 100}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-1.5">
        {etapes.map((e) => {
          const fait = faites.get(e.ordre);
          return (
            <li key={e.ordre}>
              <form action={action}>
                <input type="hidden" name="interventionId" value={interventionId} />
                <input type="hidden" name="ordre" value={e.ordre} />
                <input type="hidden" name="decocher" value={fait ? 'true' : 'false'} />

                <div
                  className={cn(
                    'min-h-touch rounded-suiton flex items-start gap-3 border p-3',
                    fait ? 'border-aqua/40 bg-aqua-wash' : 'border-mineral-dark bg-white',
                  )}
                >
                  {verrouille ? (
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                        fait ? 'border-aqua-deep bg-aqua-deep' : 'border-mineral-dark',
                      )}
                    />
                  ) : (
                    <span className="mt-0.5">
                      <Bascule fait={Boolean(fait)} libelle={e.libelle} />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {e.ordre}. {e.libelle}
                    </span>
                    <span className="text-ardoise mt-0.5 block text-[0.8125rem] leading-snug">
                      {e.detail}
                    </span>
                    {e.photo_requise && !fait ? (
                      <span className="text-aqua-deep mt-1 block text-[0.75rem] font-medium">
                        Photo attendue à cette étape
                      </span>
                    ) : null}
                  </span>

                  {fait ? (
                    <span className="tabular text-aqua-deep shrink-0 text-[0.75rem]">
                      {HEURE.format(new Date(fait))}
                    </span>
                  ) : null}
                </div>
              </form>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
