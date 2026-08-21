'use client';

import { useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { envoyerMessageAction, type ActionState } from './actions';

function Envoyer() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Envoi…' : 'Envoyer'}
    </Button>
  );
}

export function BlocMessages({
  jeton,
  messages,
}: {
  jeton: string;
  messages: { id: string; corps: string; sortant: boolean; auteur: string; date: string }[];
}) {
  const [etat, action] = useActionState<ActionState, FormData>(envoyerMessageAction, {});
  const formulaire = useRef<HTMLFormElement>(null);

  // Vider le champ apres un envoi reussi. Sans cela, l'utilisateur croit que
  // le message n'est pas parti et le renvoie.
  useEffect(() => {
    if (etat.ok) formulaire.current?.reset();
  }, [etat.ok]);

  return (
    <Card>
      <CardHeader titre="Nous écrire" description="Réponse sous 24 h ouvrées" />
      <CardBody className="flex flex-col gap-4">
        {messages.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-suiton max-w-[85%] px-3.5 py-2.5 text-sm',
                  m.sortant ? 'bg-mineral self-start' : 'bg-abysse text-mineral self-end',
                )}
              >
                <p className="whitespace-pre-wrap">{m.corps}</p>
                <p
                  className={cn(
                    'mt-1 text-[0.6875rem]',
                    m.sortant ? 'text-ardoise' : 'text-mineral/60',
                  )}
                >
                  {m.auteur} · {formatDateTime(m.date)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {etat.message ? <Alert ton="succes">{etat.message}</Alert> : null}
        {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

        <form ref={formulaire} action={action} className="flex flex-col gap-2.5">
          <input type="hidden" name="jeton" value={jeton} />
          <label htmlFor="message-portail" className="sr-only">
            Votre message
          </label>
          <Textarea
            id="message-portail"
            name="corps"
            rows={3}
            maxLength={2000}
            required
            placeholder="Une question, une précision sur l'accès, un changement de date…"
          />
          <Envoyer />
        </form>
      </CardBody>
    </Card>
  );
}
