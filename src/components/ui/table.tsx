import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tableau.
 *
 * Le conteneur defile horizontalement et porte tabIndex : sans cela, un
 * tableau large est inatteignable au clavier sur mobile.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0" tabIndex={0} role="region">
      <table
        className={cn('w-full min-w-[38rem] border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-mineral-dark border-b px-3 py-2.5 text-left text-[0.75rem] font-semibold',
        'text-ardoise tracking-wide uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('border-mineral-dark border-b px-3 py-2.5 align-middle', className)}
      {...props}
    />
  );
}
