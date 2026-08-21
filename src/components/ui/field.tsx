import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  children: (props: { id: string; 'aria-describedby': string | undefined }) => ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * Champ de formulaire.
 *
 * Le rendu par fonction garantit que le label, l'aide et le message d'erreur
 * sont reellement relies au controle par id / aria-describedby. Un champ ou
 * l'erreur n'est pas annoncee au lecteur d'ecran est un champ inaccessible,
 * meme si elle est visible a l'oeil.
 */
export function Field({ label, children, hint, error, required, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-abysse text-[0.8125rem] font-medium">
        {label}
        {required ? <span className="text-danger ml-1">*</span> : null}
      </label>

      {children({ id, 'aria-describedby': describedBy })}

      {error ? (
        <p id={errorId} role="alert" className="text-danger text-[0.8125rem]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-ardoise text-[0.8125rem]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
