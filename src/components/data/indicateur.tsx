import { cn } from '@/lib/cn';
import { Confiance } from '@/components/ui/confiance';
import type { NiveauConfiance } from '@/types/database';

/**
 * Indicateur du cockpit.
 *
 * Trois partis pris, tous destines a empecher une decision fondee sur du
 * bruit :
 *
 *   1. la valeur absente s'affiche « — », jamais « 0 ». « 0 min/m² » se lit
 *      comme une mesure, « — » se lit comme une absence ;
 *   2. l'evolution n'est montree que s'il existe une periode precedente
 *      comparable — sinon « +∞ % » sur un premier trimestre ;
 *   3. l'interpretation dit ce que le chiffre signifie, pas ce qu'il vaut.
 */

export type SensEvolution = 'hausse-bonne' | 'hausse-mauvaise' | 'neutre';

export interface IndicateurProps {
  libelle: string;
  valeur: number | null;
  unite?: string;
  precision?: number;
  /** Valeur de la periode precedente, pour l'evolution. */
  precedent?: number | null;
  /** Une hausse est-elle une bonne nouvelle ? Depend de l'indicateur. */
  sens?: SensEvolution;
  confiance: NiveauConfiance;
  n?: number;
  /** Phrase courte : ce que le chiffre veut dire. */
  interpretation?: string;
}

function formater(valeur: number, precision: number): string {
  return valeur.toLocaleString('fr-BE', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function Indicateur({
  libelle,
  valeur,
  unite,
  precision = 1,
  precedent,
  sens = 'neutre',
  confiance,
  n,
  interpretation,
}: IndicateurProps) {
  const absent = valeur === null || !Number.isFinite(valeur);

  // L'evolution exige DEUX periodes comparables. Sans quoi on afficherait
  // une variation infinie sur le premier trimestre d'activite.
  const evolution =
    !absent &&
    precedent !== null &&
    precedent !== undefined &&
    Number.isFinite(precedent) &&
    precedent !== 0
      ? ((valeur - precedent) / Math.abs(precedent)) * 100
      : null;

  const bonne =
    evolution === null || sens === 'neutre'
      ? null
      : sens === 'hausse-bonne'
        ? evolution > 0
        : evolution < 0;

  return (
    <div className="rounded-suiton border-mineral-dark flex flex-col border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-ardoise text-[0.8125rem] font-medium">{libelle}</p>
        <Confiance niveau={confiance} n={n} />
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-heading text-2xl leading-none font-semibold">
          {absent ? (
            <span className="text-ardoise-clair">—</span>
          ) : (
            <>
              <span className="tabular">{formater(valeur, precision)}</span>
              {unite ? (
                <span className="text-ardoise ml-1 text-base font-normal">{unite}</span>
              ) : null}
            </>
          )}
        </p>

        {evolution !== null && Math.abs(evolution) >= 1 ? (
          <span
            className={cn(
              'tabular text-[0.75rem] font-medium',
              bonne === null ? 'text-ardoise' : bonne ? 'text-succes' : 'text-danger',
            )}
          >
            {evolution > 0 ? '+' : ''}
            {Math.round(evolution)} %
          </span>
        ) : null}
      </div>

      {interpretation ? (
        <p className="text-ardoise mt-2 text-[0.75rem] leading-snug">{interpretation}</p>
      ) : null}
    </div>
  );
}
