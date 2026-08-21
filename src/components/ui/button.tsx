import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondaire' | 'discret' | 'preuve' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Occupe toute la largeur. Par defaut sur mobile pour les actions primaires. */
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-abysse text-mineral hover:bg-abysse-90 active:bg-abysse-80',
  secondaire: 'bg-white text-abysse border border-mineral-dark hover:bg-mineral',
  discret: 'bg-transparent text-ocean hover:bg-mineral',
  // L'aqua est reserve a la preuve : rapport, photos, garantie.
  preuve: 'bg-aqua-deep text-white hover:bg-[#195c65]',
  danger: 'bg-danger text-white hover:bg-[#963126]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[0.8125rem]',
  // 44 px : cible tactile minimale, utilisable avec des gants.
  md: 'h-touch px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', block = false, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'rounded-suiton inline-flex items-center justify-center gap-2',
        'font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  );
});
