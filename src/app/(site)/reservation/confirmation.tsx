'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatRange } from '@/lib/format';

export function Confirmation({
  succes,
  delaiHeures,
}: {
  succes: {
    reference: string;
    url_portail: string;
    estimation: { min: number; max: number; surDevis: boolean };
    courriel_envoye: boolean;
  };
  delaiHeures: number;
}) {
  return (
    <div className="flex flex-col gap-5 py-4">
      <div>
        <p className="text-aqua-deep text-[0.8125rem] font-medium">Demande enregistrée</p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">Merci, c&apos;est noté.</h1>
        <p className="tabular text-ardoise mt-2 text-sm">
          Référence <strong className="text-abysse">{succes.reference}</strong>
        </p>
      </div>

      <div className="rounded-suiton border-mineral-dark border p-4">
        <p className="text-ardoise text-[0.8125rem]">
          {succes.estimation.surDevis ? 'Chiffrage' : 'Estimation, hors TVA'}
        </p>
        <p className="tabular font-heading mt-1 text-xl font-semibold">
          {succes.estimation.surDevis
            ? 'Sur devis'
            : formatRange(succes.estimation.min, succes.estimation.max)}
        </p>
        <p className="text-ardoise mt-1.5 text-[0.8125rem]">
          Votre devis ferme arrive sous {delaiHeures} heures ouvrées.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Votre dossier</p>
        <p className="text-ardoise mb-3 text-sm">
          Ce lien suit votre chantier de bout en bout : devis, dates, photos, rapport.
          Conservez-le.
        </p>
        <a href={succes.url_portail}>
          <Button variant="preuve" size="lg" block>
            Ouvrir mon dossier
          </Button>
        </a>
        <p className="text-ardoise mt-2 text-[0.75rem] break-all">{succes.url_portail}</p>
      </div>

      {succes.courriel_envoye ? (
        <Alert ton="succes">
          Le lien vous a également été envoyé par e-mail. Vérifiez vos indésirables si vous ne
          le voyez pas.
        </Alert>
      ) : (
        <Alert ton="alerte" titre="E-mail non envoyé">
          Nous n&apos;avons pas pu vous envoyer le lien par e-mail. Votre demande est bien
          enregistrée — notez le lien ci-dessus, ou appelez le 0489 21 01 24.
        </Alert>
      )}
    </div>
  );
}
