'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { majConsentementAction, type ActionState } from './actions';

function Bascule({ accorde }: { accorde: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={accorde ? 'secondaire' : 'preuve'}
      disabled={pending}
      className="sm:min-w-48"
    >
      {pending ? 'Enregistrement…' : accorde ? 'Retirer mon accord' : 'Donner mon accord'}
    </Button>
  );
}

/**
 * Consentement photo.
 *
 * Le retrait doit etre aussi simple que l'octroi : un bouton, un clic, effet
 * immediat. C'est une obligation (RGPD art. 7 §3), pas une courtoisie.
 */
export function BlocConsentement({ jeton, accorde }: { jeton: string; accorde: boolean }) {
  const [etat, action] = useActionState<ActionState, FormData>(majConsentementAction, {});

  return (
    <Card>
      <CardHeader titre="Publication des photos" />
      <CardBody className="flex flex-col gap-3.5">
        <p className="text-ardoise text-sm">
          {accorde
            ? 'Vous nous autorisez à publier les photos de votre chantier sur notre site. Ni votre nom ni votre adresse exacte n’apparaissent — uniquement la commune.'
            : 'Vos photos ne sont pas publiées. Elles servent uniquement à votre devis et à votre rapport.'}
        </p>

        {etat.message ? <Alert ton="succes">{etat.message}</Alert> : null}
        {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

        <form action={action}>
          <input type="hidden" name="jeton" value={jeton} />
          <input type="hidden" name="accorde" value={accorde ? 'false' : 'true'} />
          <Bascule accorde={accorde} />
        </form>

        <p className="text-ardoise text-[0.75rem]">
          Ce choix est révocable à tout moment et n&apos;a aucun effet sur le prix ni sur la
          prestation. Un retrait dépublie les photos dans l&apos;heure.
        </p>
      </CardBody>
    </Card>
  );
}
