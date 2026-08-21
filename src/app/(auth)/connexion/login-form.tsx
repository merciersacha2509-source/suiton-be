'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { loginAction, type LoginState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block disabled={pending}>
      {pending ? 'Connexion…' : 'Se connecter'}
    </Button>
  );
}

export function LoginForm({ suite }: { suite?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}

      {state.error ? <Alert ton="danger">{state.error}</Alert> : null}

      <Field label="Adresse e-mail" required error={state.champs?.email}>
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            required
            invalid={Boolean(state.champs?.email)}
            placeholder="prenom@suiton.be"
          />
        )}
      </Field>

      <Field label="Mot de passe" required error={state.champs?.motDePasse}>
        {(p) => (
          <Input
            {...p}
            name="motDePasse"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            invalid={Boolean(state.champs?.motDePasse)}
          />
        )}
      </Field>

      <Submit />
    </form>
  );
}
