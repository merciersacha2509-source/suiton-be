import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Ton = 'info' | 'succes' | 'alerte' | 'danger';

const TONS: Record<Ton, string> = {
  info: 'border-ocean/25 bg-white text-abysse',
  succes: 'border-succes/25 bg-succes-wash text-abysse',
  alerte: 'border-alerte/25 bg-alerte-wash text-abysse',
  danger: 'border-danger/25 bg-danger-wash text-abysse',
};

const BARRES: Record<Ton, string> = {
  info: 'bg-ocean',
  succes: 'bg-succes',
  alerte: 'bg-alerte',
  danger: 'bg-danger',
};

export function Alert({
  ton = 'info',
  titre,
  children,
  className,
}: {
  ton?: Ton;
  titre?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={ton === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-suiton flex overflow-hidden border', TONS[ton], className)}
    >
      <span aria-hidden className={cn('w-1 shrink-0', BARRES[ton])} />
      <div className="px-3.5 py-3 text-sm">
        {titre ? <p className="mb-0.5 font-semibold">{titre}</p> : null}
        <div className="text-[0.875rem] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
