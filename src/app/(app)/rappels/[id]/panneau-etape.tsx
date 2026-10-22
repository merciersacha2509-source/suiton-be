'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { RAPPEL_STAGE_LABELS } from '@/components/ui/badge';
import { changerEtapeRappelAction, type RappelActionState } from './actions';
import type { RappelStage } from '@/types/database';

function Soumettre() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondaire" disabled={pending}>
      {pending ? 'Enregistrement…' : "Enregistrer l'étape"}
    </Button>
  );
}

function Retour({ etat }: { etat: RappelActionState }) {
  if (etat.error) return <Alert ton="danger">{etat.error}</Alert>;
  if (etat.message) return <Alert ton="succes">{etat.message}</Alert>;
  return null;
}

export function PanneauEtapeRappel({
  rappelId,
  stage,
}: {
  rappelId: string;
  stage: RappelStage;
}) {
  const [etat, action] = useActionState<RappelActionState, FormData>(changerEtapeRappelAction, {});
  const [choisie, setChoisie] = useState<RappelStage>(stage);

  return (
    <Card>
      <CardHeader titre="Étape" description="Suivi de cette demande" />
      <CardBody className="flex flex-col gap-3">
        <Retour etat={etat} />
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="rappelId" value={rappelId} />
          <Field label="Nouvelle étape">
            {(p) => (
              <Select
                {...p}
                name="stage"
                value={choisie}
                onChange={(e) => setChoisie(e.target.value as RappelStage)}
              >
                {(Object.keys(RAPPEL_STAGE_LABELS) as RappelStage[]).map((s) => (
                  <option key={s} value={s}>
                    {RAPPEL_STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {choisie === 'perdu' ? (
            <Field
              label="Pourquoi cette demande est-elle perdue ?"
              required
              hint="Obligatoire. Sans motif, on refait la même erreur."
            >
              {(p) => <Textarea {...p} name="motif" rows={2} maxLength={500} required />}
            </Field>
          ) : null}

          <Soumettre />
        </form>
      </CardBody>
    </Card>
  );
}
