import type { ReactNode } from 'react';

/**
 * Etat vide.
 *
 * Un ecran vide doit dire ce qui manque ET ce qu'il faut faire. « Aucune
 * donnee » laisse l'utilisateur devant une impasse.
 */
export function EmptyState({
  titre,
  description,
  action,
}: {
  titre: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="font-heading text-abysse text-base font-semibold">{titre}</p>
      <p className="text-ardoise mt-1.5 max-w-sm text-sm">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
