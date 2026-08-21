'use client';

import { cn } from '@/lib/cn';
import { ETAPES } from './types';

export function Stepper({ courante }: { courante: number }) {
  return (
    <nav aria-label="Progression" className="mb-6">
      <p className="text-ardoise mb-2 text-[0.8125rem]">
        Étape {courante} sur {ETAPES.length} · {ETAPES[courante - 1]?.court}
      </p>
      <ol className="flex gap-1.5">
        {ETAPES.map((e) => {
          const faite = e.numero < courante;
          const active = e.numero === courante;
          return (
            <li key={e.numero} className="flex-1">
              <span
                className={cn(
                  'block h-1 rounded-full',
                  faite ? 'bg-aqua-deep' : active ? 'bg-abysse' : 'bg-mineral-dark',
                )}
              />
              <span className="sr-only">
                {e.court}
                {faite ? ' — terminée' : active ? ' — en cours' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
