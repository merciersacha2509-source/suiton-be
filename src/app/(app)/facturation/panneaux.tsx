'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  envoyerFactureAction,
  genererFactureAction,
  marquerPayeeAction,
  type FactureState,
} from './actions';

function Bouton({
  libelle,
  enCours,
  variant = 'primary',
  taille = 'md',
}: {
  libelle: string;
  enCours: string;
  variant?: 'primary' | 'secondaire' | 'preuve';
  taille?: 'sm' | 'md';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={taille} disabled={pending}>
      {pending ? enCours : libelle}
    </Button>
  );
}

function Retour({ etat }: { etat: FactureState }) {
  if (etat.error) return <Alert ton="alerte">{etat.error}</Alert>;
  if (etat.message)
    return (
      <Alert ton="succes">
        {etat.message}
        {etat.pdfUrl ? (
          <>
            {' '}
            <a
              href={etat.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              Ouvrir le PDF
            </a>
          </>
        ) : null}
      </Alert>
    );
  return null;
}

export function BoutonFacturer({ jobId, estPro }: { jobId: string; estPro: boolean }) {
  const [etat, action] = useActionState<FactureState, FormData>(genererFactureAction, {});

  return (
    <div className="flex flex-col gap-2">
      <Retour etat={etat} />
      <form action={action}>
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="brouillon" value={estPro ? 'true' : 'false'} />
        <Bouton
          libelle={estPro ? 'Produire le brouillon' : 'Facturer'}
          enCours="Génération…"
          taille="sm"
          variant={estPro ? 'secondaire' : 'primary'}
        />
      </form>
    </div>
  );
}

export function BoutonEnvoyer({ invoiceId }: { invoiceId: string }) {
  const [etat, action] = useActionState<FactureState, FormData>(envoyerFactureAction, {});
  return (
    <div className="flex flex-col gap-2">
      <Retour etat={etat} />
      <form action={action}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Bouton libelle="Envoyer" enCours="Envoi…" taille="sm" variant="preuve" />
      </form>
    </div>
  );
}

export function BoutonPayee({ invoiceId }: { invoiceId: string }) {
  const [etat, action] = useActionState<FactureState, FormData>(marquerPayeeAction, {});
  return (
    <div className="flex flex-col gap-2">
      <Retour etat={etat} />
      <form action={action}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Bouton libelle="Payée" enCours="…" taille="sm" variant="secondaire" />
      </form>
    </div>
  );
}
