'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { formatDate, formatEUR, formatRange } from '@/lib/format';
import { accepterDevisAction, refuserDevisAction, type ActionState } from './actions';
import type { JobStage, QuoteStatus } from '@/types/database';

interface Devis {
  id: string;
  numero: string;
  status: QuoteStatus;
  montantHtva: number;
  montantTtc: number;
  autoliquidation: boolean;
  valideJusquAu: string;
  urlPdf: string | null;
}

function BoutonAccepter() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="preuve" size="lg" disabled={pending} className="sm:min-w-52">
      {pending ? 'Enregistrement…' : 'Accepter ce devis'}
    </Button>
  );
}

function BoutonRefuser() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondaire" disabled={pending}>
      {pending ? 'Envoi…' : 'Confirmer le refus'}
    </Button>
  );
}

export function BlocDevis({
  jeton,
  devis,
  estimation,
  stage,
}: {
  jeton: string;
  devis: Devis | null;
  estimation: { min: number | null; max: number | null };
  stage: JobStage;
}) {
  const [acceptation, accepter] = useActionState<ActionState, FormData>(
    accepterDevisAction,
    {},
  );
  const [refus, refuser] = useActionState<ActionState, FormData>(refuserDevisAction, {});
  const [afficheRefus, setAfficheRefus] = useState(false);

  /* --- Pas encore de devis ------------------------------------------------ */
  if (!devis) {
    return (
      <Card>
        <CardHeader titre="Votre devis" description="En cours de préparation" />
        <CardBody>
          {estimation.min !== null && estimation.max !== null ? (
            <>
              <p className="text-ardoise text-[0.8125rem]">Estimation de départ, hors TVA</p>
              <p className="tabular font-heading mt-1 text-xl font-semibold">
                {formatRange(Number(estimation.min), Number(estimation.max))}
              </p>
            </>
          ) : null}
          <p className="text-ardoise mt-3 text-sm">
            {stage === 'nouveau'
              ? 'Nous étudions votre demande. Votre devis ferme arrive sous 24 h ouvrées.'
              : 'Votre devis est en cours de rédaction.'}
          </p>
        </CardBody>
      </Card>
    );
  }

  const accepte = devis.status === 'accepte';
  const refuse = devis.status === 'refuse';
  const expire = !accepte && !refuse && new Date(devis.valideJusquAu) < new Date();
  const decidable = !accepte && !refuse && !expire;

  return (
    <Card>
      <CardHeader
        titre={`Devis ${devis.numero}`}
        description={`Valable jusqu'au ${formatDate(devis.valideJusquAu)}`}
        action={
          accepte ? (
            <Badge ton="succes">Accepté</Badge>
          ) : refuse ? (
            <Badge ton="danger">Refusé</Badge>
          ) : expire ? (
            <Badge ton="alerte">Expiré</Badge>
          ) : (
            <Badge ton="preuve">À valider</Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div>
          <p className="tabular font-heading text-2xl font-semibold">
            {formatEUR(devis.montantTtc)}
          </p>
          <p className="tabular text-ardoise mt-0.5 text-[0.8125rem]">
            {formatEUR(devis.montantHtva)} HTVA
            {devis.autoliquidation
              ? ' · autoliquidation, TVA à votre charge'
              : ' · TVA comprise'}
          </p>
        </div>

        {devis.urlPdf ? (
          <a href={devis.urlPdf} target="_blank" rel="noopener noreferrer">
            <Button variant="secondaire" block>
              Ouvrir le devis (PDF)
            </Button>
          </a>
        ) : null}

        {acceptation.message ? <Alert ton="succes">{acceptation.message}</Alert> : null}
        {acceptation.error ? <Alert ton="danger">{acceptation.error}</Alert> : null}
        {refus.message ? <Alert ton="info">{refus.message}</Alert> : null}
        {refus.error ? <Alert ton="danger">{refus.error}</Alert> : null}

        {expire ? (
          <Alert ton="alerte" titre="Devis expiré">
            Sa date de validité est passée. Appelez le 0489 21 01 24, nous le rééditons aux
            conditions du jour.
          </Alert>
        ) : null}

        {decidable ? (
          <>
            <form action={accepter}>
              <input type="hidden" name="jeton" value={jeton} />
              <BoutonAccepter />
            </form>

            <p className="text-ardoise text-[0.8125rem]">
              L&apos;acceptation vaut commande. Vitres et châssis compris, rapport photo
              avant/après, garantie retouche 48 h.
            </p>

            {!afficheRefus ? (
              <button
                type="button"
                onClick={() => setAfficheRefus(true)}
                className="text-ardoise self-start text-[0.8125rem] underline underline-offset-2"
              >
                Ce devis ne me convient pas
              </button>
            ) : (
              <form
                action={refuser}
                className="rounded-suiton bg-mineral flex flex-col gap-2.5 p-3.5"
              >
                <input type="hidden" name="jeton" value={jeton} />
                <label htmlFor="motif-refus" className="text-[0.8125rem] font-medium">
                  Qu&apos;est-ce qui bloque ?
                </label>
                <Textarea
                  id="motif-refus"
                  name="motif"
                  rows={2}
                  maxLength={500}
                  placeholder="Le prix, le délai, un concurrent moins cher…"
                />
                <p className="text-ardoise text-[0.75rem]">
                  Votre réponse nous sert vraiment. Elle ne vous engage à rien.
                </p>
                <div className="flex gap-2">
                  <BoutonRefuser />
                  <Button variant="discret" onClick={() => setAfficheRefus(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : null}

        {accepte ? (
          <Alert ton="succes" titre="Devis accepté">
            Merci. Nous prenons le relais — vous serez prévenu la veille de l&apos;intervention.
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}
