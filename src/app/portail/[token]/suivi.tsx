import { cn } from '@/lib/cn';
import type { JobStage } from '@/types/database';

/**
 * Suivi d'avancement.
 *
 * Quatre jalons seulement. Les onze etapes du pipeline commercial sont un
 * outil interne : montrer « relance » ou « negociation » a un client serait
 * indelicat autant qu'inutile.
 */
const JALONS = [
  { cle: 'demande', libelle: 'Demande reçue' },
  { cle: 'devis', libelle: 'Devis envoyé' },
  { cle: 'planifie', libelle: 'Intervention planifiée' },
  { cle: 'termine', libelle: 'Chantier terminé' },
] as const;

function positionDe(stage: JobStage): number {
  switch (stage) {
    case 'nouveau':
    case 'contacte':
    case 'qualifie':
    case 'devis_a_produire':
      return 0;
    case 'devis_envoye':
    case 'relance':
    case 'negociation':
      return 1;
    case 'gagne':
    case 'planifie':
      return 2;
    case 'termine':
      return 3;
    case 'perdu':
      return -1;
  }
}

export function Suivi({ stage }: { stage: JobStage }) {
  const position = positionDe(stage);

  if (position === -1) {
    return (
      <div className="rounded-suiton border-mineral-dark border bg-white px-4 py-3.5 text-sm">
        Ce dossier est clôturé. Si c&apos;est une erreur, appelez le 0489 21 01 24 — nous le
        rouvrons.
      </div>
    );
  }

  return (
    <ol className="rounded-suiton border-mineral-dark flex flex-col gap-0 border bg-white p-4 sm:flex-row sm:gap-2">
      {JALONS.map((jalon, i) => {
        const fait = i < position;
        const actif = i === position;
        return (
          <li
            key={jalon.cle}
            className="flex flex-1 items-center gap-2.5 py-1.5 sm:flex-col sm:items-start"
          >
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold sm:hidden',
                fait
                  ? 'bg-aqua-deep text-white'
                  : actif
                    ? 'bg-abysse text-mineral'
                    : 'bg-mineral-dark text-ardoise',
              )}
            >
              {fait ? '✓' : i + 1}
            </span>
            <span
              aria-hidden
              className={cn(
                'hidden h-1 w-full rounded-full sm:block',
                fait ? 'bg-aqua-deep' : actif ? 'bg-abysse' : 'bg-mineral-dark',
              )}
            />
            <span
              className={cn(
                'text-[0.8125rem] sm:mt-1.5',
                actif ? 'text-abysse font-semibold' : fait ? 'text-aqua-deep' : 'text-ardoise',
              )}
            >
              {jalon.libelle}
              {actif ? <span className="sr-only"> — étape en cours</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
