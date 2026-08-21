import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const BASE =
  'w-full rounded-suiton border bg-white px-3 text-sm text-abysse ' +
  'placeholder:text-ardoise-clair transition-colors ' +
  'disabled:cursor-not-allowed disabled:bg-mineral disabled:text-ardoise';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        BASE,
        'h-touch',
        invalid ? 'border-danger' : 'border-mineral-dark focus:border-aqua-deep',
        className,
      )}
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        BASE,
        'h-touch appearance-none pr-8',
        invalid ? 'border-danger' : 'border-mineral-dark focus:border-aqua-deep',
        className,
      )}
      {...props}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        BASE,
        'border-mineral-dark focus:border-aqua-deep min-h-[6rem] resize-y py-2.5',
        className,
      )}
      {...props}
    />
  );
});
