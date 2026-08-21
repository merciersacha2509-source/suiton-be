import { cn } from '@/lib/cn';
import type { JobStage, ScoreBand, AutomationState } from '@/types/database';

type Ton = 'neutre' | 'ocean' | 'preuve' | 'succes' | 'alerte' | 'danger';

const TONS: Record<Ton, string> = {
  neutre: 'bg-mineral text-ardoise border-mineral-dark',
  ocean: 'bg-white text-ocean border-ocean/25',
  preuve: 'bg-aqua-wash text-aqua-deep border-aqua/40',
  succes: 'bg-succes-wash text-succes border-succes/25',
  alerte: 'bg-alerte-wash text-alerte border-alerte/25',
  danger: 'bg-danger-wash text-danger border-danger/25',
};

export function Badge({
  children,
  ton = 'neutre',
  className,
}: {
  children: React.ReactNode;
  ton?: Ton;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.75rem] font-medium',
        TONS[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const STAGE_LABELS: Record<JobStage, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  qualifie: 'Qualifié',
  devis_a_produire: 'Devis à produire',
  devis_envoye: 'Devis envoyé',
  relance: 'Relance',
  negociation: 'Négociation',
  gagne: 'Gagné',
  planifie: 'Planifié',
  termine: 'Terminé',
  perdu: 'Perdu',
};

const STAGE_TONS: Record<JobStage, Ton> = {
  nouveau: 'ocean',
  contacte: 'ocean',
  qualifie: 'ocean',
  devis_a_produire: 'alerte',
  devis_envoye: 'alerte',
  relance: 'alerte',
  negociation: 'alerte',
  gagne: 'succes',
  planifie: 'succes',
  termine: 'preuve',
  perdu: 'danger',
};

export function StageBadge({ stage }: { stage: JobStage }) {
  return <Badge ton={STAGE_TONS[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

const BAND_TONS: Record<ScoreBand, Ton> = {
  'A+': 'succes',
  A: 'succes',
  B: 'ocean',
  C: 'neutre',
};

export function ScoreBadge({ band, score }: { band: ScoreBand; score: number }) {
  return (
    <Badge ton={BAND_TONS[band]} className="tabular">
      {band} · {score}
    </Badge>
  );
}

const AUTOMATION_TONS: Record<AutomationState, Ton> = {
  actif: 'succes',
  suspendu: 'alerte',
  desactive: 'danger',
};

const AUTOMATION_LABELS: Record<AutomationState, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  desactive: 'Désactivé',
};

export function AutomationBadge({ state }: { state: AutomationState }) {
  return <Badge ton={AUTOMATION_TONS[state]}>{AUTOMATION_LABELS[state]}</Badge>;
}
