import { eur, retirerTva } from '@/lib/site/tarifs-secondaires';
import { cn } from '@/lib/cn';

/**
 * Prix pour un particulier : TVAC en evidence, HTVA en petit dessous.
 * `prefixe` sert aux options (« + »).
 */
export function PrixTvac({
  tvac,
  prefixe = '',
  avecHtva = true,
  className,
}: {
  tvac: number;
  prefixe?: string;
  /** HTVA en petit dessous. Utile sur un total, du bruit sur chaque option. */
  avecHtva?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('tabular block text-right', className)}>
      <span>
        {prefixe}
        {eur(tvac)} TVAC
      </span>
      {avecHtva ? (
        <span className="text-ardoise block text-xs font-normal">
          {prefixe}
          {eur(retirerTva(tvac))} HTVA
        </span>
      ) : null}
    </span>
  );
}
