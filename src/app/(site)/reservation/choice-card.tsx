'use client';

import { cn } from '@/lib/cn';

/**
 * Carte de choix. Un `label` enveloppant un `input radio` visuellement
 * masque : la navigation par fleches, l'annonce du groupe au lecteur d'ecran
 * et la validation native fonctionnent sans code supplementaire — ce qu'une
 * liste de `<div onClick>` ne donne pas.
 */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  titre,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  titre: string;
  description?: string;
}) {
  return (
    <label
      className={cn(
        'rounded-suiton flex cursor-pointer gap-3 border p-3.5 transition-colors',
        'has-[:focus-visible]:outline-aqua-deep has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        checked ? 'border-abysse bg-mineral' : 'border-mineral-dark hover:border-ardoise-clair',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
          checked
            ? 'border-abysse bg-abysse ring-2 ring-white ring-inset'
            : 'border-ardoise-clair',
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titre}</span>
        {description ? (
          <span className="text-ardoise mt-0.5 block text-[0.8125rem] leading-snug">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
