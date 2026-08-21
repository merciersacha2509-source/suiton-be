'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

/**
 * Frontiere d'erreur globale.
 *
 * Le message technique n'est jamais affiche : il est journalise. Ce que
 * l'utilisateur voit doit lui dire quoi faire, pas ce qui a casse.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] erreur non rattrapee', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6">
      <Alert ton="danger" titre="Une erreur est survenue" className="max-w-md">
        <p>Reessayez dans un instant. Si le probleme persiste, prevenez la direction.</p>
        {error.digest ? (
          <p className="tabular text-ardoise mt-2 text-[0.75rem]">Reference : {error.digest}</p>
        ) : null}
      </Alert>
      <Button onClick={reset}>Reessayer</Button>
    </main>
  );
}
