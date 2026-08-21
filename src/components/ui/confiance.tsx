import { cn } from '@/lib/cn';
import { LIBELLES_CONFIANCE } from '@/lib/intelligence';
import type { NiveauConfiance } from '@/types/database';

const TONS: Record<NiveauConfiance, string> = {
  aucune: 'border-mineral-dark bg-mineral text-ardoise',
  faible: 'border-alerte/25 bg-alerte-wash text-alerte',
  moyenne: 'border-ocean/25 bg-white text-ocean',
  bonne: 'border-aqua/40 bg-aqua-wash text-aqua-deep',
  elevee: 'border-succes/25 bg-succes-wash text-succes',
};

/**
 * Pastille de confiance.
 *
 * Elle accompagne TOUT chiffre statistique de l'application. Sans elle, une
 * mediane sur trois chantiers a la meme apparence qu'une mediane sur cent —
 * et c'est ainsi qu'on prend une decision de tarification sur du bruit.
 */
export function Confiance({
  niveau,
  n,
  className,
}: {
  niveau: NiveauConfiance;
  n?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium',
        TONS[niveau],
        className,
      )}
    >
      {LIBELLES_CONFIANCE[niveau]}
      {n !== undefined ? <span className="tabular opacity-70">· {n}</span> : null}
    </span>
  );
}

/**
 * Valeur statistique.
 *
 * Affiche un tiret plutot qu'un zero quand la donnee manque : « 0 min/m² »
 * se lit comme une mesure, « — » se lit comme une absence.
 */
export function ValeurStat({
  valeur,
  unite,
  suffixe,
}: {
  valeur: number | null;
  unite?: string;
  suffixe?: string;
}) {
  if (valeur === null || !Number.isFinite(valeur)) {
    return <span className="text-ardoise-clair">—</span>;
  }
  return (
    <span className="tabular">
      {valeur.toLocaleString('fr-BE', { maximumFractionDigits: 1 })}
      {unite ? <span className="text-ardoise"> {unite}</span> : null}
      {suffixe ?? ''}
    </span>
  );
}
