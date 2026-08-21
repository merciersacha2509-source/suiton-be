import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-suiton border-mineral-dark border bg-white', className)}
      {...props}
    />
  );
}

export function CardHeader({
  titre,
  description,
  action,
  className,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-mineral-dark flex items-start justify-between gap-4 border-b px-4 py-3.5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-[0.9375rem] font-semibold">{titre}</h2>
        {description ? (
          <p className="text-ardoise mt-0.5 text-[0.8125rem]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4', className)} {...props} />;
}

/** Bloc de chiffre. Le libelle passe AVANT la valeur pour les lecteurs d'ecran. */
export function StatCard({
  libelle,
  valeur,
  detail,
  accent = false,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  /** Accent aqua : reserve aux indicateurs de preuve. */
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-ardoise text-[0.8125rem] font-medium">{libelle}</p>
      <p
        className={cn(
          'tabular font-heading mt-1.5 text-2xl font-semibold',
          accent ? 'text-aqua-deep' : 'text-abysse',
        )}
      >
        {valeur}
      </p>
      {detail ? <p className="text-ardoise mt-1 text-[0.8125rem]">{detail}</p> : null}
    </Card>
  );
}
