'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { modifierClientAction, type ClientActionState } from './actions';

function Soumettre() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondaire" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  );
}

function Retour({ etat }: { etat: ClientActionState }) {
  if (etat.error) return <Alert ton="danger">{etat.error}</Alert>;
  if (etat.message) return <Alert ton="succes">{etat.message}</Alert>;
  return null;
}

export function PanneauFiche({
  clientId,
  nom,
  email,
  telephone,
  adresse,
  commune,
  codePostal,
}: {
  clientId: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string | null;
  commune: string | null;
  codePostal: string | null;
}) {
  const [etat, action] = useActionState<ClientActionState, FormData>(modifierClientAction, {});

  return (
    <Card>
      <CardHeader titre="Coordonnées" description="Modifiable en cas d'erreur ou de changement" />
      <CardBody className="flex flex-col gap-3">
        <Retour etat={etat} />
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Nom">{(p) => <Input {...p} name="nom" defaultValue={nom} required />}</Field>
          <Field label="E-mail">
            {(p) => <Input {...p} name="email" type="email" defaultValue={email} required />}
          </Field>
          <Field label="Téléphone">
            {(p) => <Input {...p} name="telephone" defaultValue={telephone} required />}
          </Field>
          <Field label="Adresse">
            {(p) => <Input {...p} name="adresse" defaultValue={adresse ?? ''} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commune">
              {(p) => <Input {...p} name="commune" defaultValue={commune ?? ''} />}
            </Field>
            <Field label="Code postal">
              {(p) => <Input {...p} name="code_postal" defaultValue={codePostal ?? ''} />}
            </Field>
          </div>
          <Soumettre />
        </form>
      </CardBody>
    </Card>
  );
}
