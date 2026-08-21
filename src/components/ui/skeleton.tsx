import { cn } from '@/lib/cn';

/** Squelette de chargement. Les dimensions doivent egaler celles du contenu
 *  final, sinon le remplacement provoque un decalage et fait exploser le CLS. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('rounded-suiton bg-mineral-dark/60 animate-pulse', className)}
    />
  );
}
