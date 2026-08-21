import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { DossierClient } from '@/lib/services/portal';

/**
 * Nouvelle demande depuis le portail.
 *
 * Un client qui a deja ete livre est le lead le moins cher qui existe : il
 * connait le prix, il a vu le rapport, il n'a plus a etre convaincu. Le
 * portail restant valable douze mois, c'est aussi la page ou il revient
 * naturellement — c'est donc la qu'il faut lui laisser un chemin.
 *
 * Le lien pre-remplit le service, le type de bien et la commune du chantier
 * precedent. Il ne pre-remplit PAS la surface : un second chantier a rarement
 * la meme, et un champ pre-rempli faux est pire qu'un champ vide.
 *
 * Le bloc n'apparait qu'au stade « termine ». Le proposer pendant que le
 * premier chantier est en cours donnerait l'impression qu'on cherche a vendre
 * avant d'avoir fini — exactement ce qu'un client se rappelle.
 */
export function BlocNouvelleDemande({ dossier }: { dossier: DossierClient }) {
  if (dossier.stage !== 'termine') return null;

  const parametres = new URLSearchParams({
    service: dossier.service,
    bien: dossier.propertyType,
    ...(dossier.codePostal ? { cp: dossier.codePostal } : {}),
  });

  return (
    <Card>
      <CardHeader
        titre="Un autre chantier ?"
        description="Nous connaissons déjà votre dossier"
      />
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed">
          Votre demande arrive pré-remplie avec le type de bien et la commune de ce chantier.
          Vous n&apos;avez qu&apos;à indiquer la nouvelle surface — et vous recevez une
          estimation immédiate, puis un devis ferme sous 24 heures ouvrées.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/reservation?${parametres.toString()}`}
            className="rounded-suiton bg-abysse hover:bg-abysse-90 text-mineral h-touch flex items-center justify-center px-5 text-sm font-medium transition-colors"
          >
            Demander un nouveau devis
          </Link>
          <a
            href="tel:+32489210124"
            className="border-mineral-dark hover:border-ardoise-clair rounded-suiton h-touch flex items-center justify-center border px-5 text-sm font-medium transition-colors"
          >
            0489 21 01 24
          </a>
        </div>
      </CardBody>
    </Card>
  );
}
