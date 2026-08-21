import { cn } from '@/lib/cn';
import { Confiance } from '@/components/ui/confiance';
import type { Alerte, GraviteAlerte } from '@/lib/alertes';

const TONS: Record<GraviteAlerte, { bordure: string; barre: string; etiquette: string }> = {
  critique: {
    bordure: 'border-danger/25 bg-danger-wash',
    barre: 'bg-danger',
    etiquette: 'text-danger',
  },
  attention: {
    bordure: 'border-alerte/25 bg-alerte-wash',
    barre: 'bg-alerte',
    etiquette: 'text-alerte',
  },
  opportunite: {
    bordure: 'border-aqua/40 bg-aqua-wash',
    barre: 'bg-aqua-deep',
    etiquette: 'text-aqua-deep',
  },
};

const LIBELLES: Record<GraviteAlerte, string> = {
  critique: 'À traiter',
  attention: 'À surveiller',
  opportunite: 'Opportunité',
};

export function AlerteCarte({ alerte }: { alerte: Alerte }) {
  const ton = TONS[alerte.gravite];

  return (
    <div className={cn('rounded-suiton flex overflow-hidden border', ton.bordure)}>
      <span aria-hidden className={cn('w-1 shrink-0', ton.barre)} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-[0.6875rem] font-semibold tracking-wide uppercase',
              ton.etiquette,
            )}
          >
            {LIBELLES[alerte.gravite]}
          </span>
          <Confiance niveau={alerte.confiance} n={alerte.n} />
        </div>
        <p className="mt-1.5 text-sm leading-snug font-medium">{alerte.titre}</p>
        <p className="text-ardoise mt-1 text-[0.8125rem] leading-relaxed">{alerte.action}</p>
      </div>
    </div>
  );
}
