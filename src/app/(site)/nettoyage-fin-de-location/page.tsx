import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Faq, FilAriane, ListePuces } from '@/components/site/blocs';
import { DevisFinLocation } from '@/components/site/devis-fin-location';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, jsonldFaq, metadonnees } from '@/lib/site/seo';
import { FIN_LOCATION, eur } from '@/lib/site/tarifs-secondaires';

/**
 * Nettoyage de fin de location.
 *
 * Meme logique que /nettoyage-auto et /nettoyage-textile : un prix TVAC pour
 * un particulier, un formulaire de rappel, pas de reservation en ligne. Un
 * forfait pour un logement jusqu'a 90 m², devis au-dela. Aucune duree
 * affichee. Montants dans `lib/site/tarifs-secondaires.ts`.
 */

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: `Nettoyage de fin de location — ${eur(FIN_LOCATION.forfaitTvac)} TVAC jusqu'à ${FIN_LOCATION.surfaceMax} m² — SUITON`,
  description: `Nettoyage complet de votre logement avant l'état des lieux de sortie : forfait de ${eur(FIN_LOCATION.forfaitTvac)} TVAC jusqu'à ${FIN_LOCATION.surfaceMax} m². Électroménager non compris (réfrigérateur et textiles en option). Autour d'Enghien.`,
  chemin: '/nettoyage-fin-de-location',
});

const FAQ = [
  {
    question: 'Combien coûte un nettoyage de fin de location ?',
    reponse: `Un forfait de ${eur(FIN_LOCATION.forfaitTvac)} TVAC pour un logement jusqu'à ${FIN_LOCATION.surfaceMax} m², électroménager non compris. Au-delà, nous chiffrons sur devis après votre description et vos photos.`,
  },
  {
    question: 'Que comprend le forfait ?',
    reponse:
      "Le nettoyage complet du logement pour l'état des lieux de sortie : sols, cuisine, salle de bains et sanitaires, portes, plinthes et surfaces. Le nettoyage de l'électroménager n'est pas compris, ni celui des textiles : ils sont hors forfait. Le réfrigérateur et les textiles peuvent être ajoutés en option.",
  },
  {
    question: 'Combien coûtent le réfrigérateur et les textiles ?',
    reponse:
      "Ils sont en option, hors forfait, et chiffrés sur demande selon leur état. Indiquez-les dans le formulaire : nous vous donnons le prix au rappel. Pour les canapés, matelas et tapis, les tarifs de la page nettoyage textile s'appliquent.",
  },
  {
    question: "Le nettoyage garantit-il le résultat de l'état des lieux ?",
    reponse:
      "Nous remettons le logement propre et prêt pour l'état des lieux. Les remarques sur l'état du logement lui-même (dégradations, usure) ne relèvent pas du nettoyage, et nous ne pouvons pas garantir la décision du propriétaire.",
  },
];

export default function PageNettoyageFinLocation() {
  return (
    <>
      <Jsonld
        donnees={[
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Nettoyage de fin de location', chemin: '/nettoyage-fin-de-location' },
          ]),
          jsonldFaq(FAQ),
        ]}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Nettoyage de fin de location', href: '/nettoyage-fin-de-location' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Nettoyage de fin de location
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Vous quittez votre logement : nous le remettons propre pour l&apos;état des lieux de
            sortie. Un forfait de {eur(FIN_LOCATION.forfaitTvac)} TVAC jusqu&apos;à{' '}
            {FIN_LOCATION.surfaceMax} m².
          </p>
          <div className="mt-6 max-w-2xl">
            <ListePuces
              items={[
                'Un prix annoncé avant, pas une fourchette qui bouge sur place',
                'Électroménager et textiles non compris : réfrigérateur et textiles en option, chiffrés sur demande',
                'Sur rendez-vous, autour d’Enghien',
              ]}
            />
          </div>
        </div>
      </section>

      <Section fond="mineral" id="devis">
        <DevisFinLocation />
        <p className="text-ardoise mt-6 text-sm">
          Un chantier de construction ou de rénovation ? Découvrez notre{' '}
          <Link href="/nettoyage-fin-de-chantier" className="text-ocean font-medium underline">
            nettoyage de fin de travaux
          </Link>
          . Des canapés, matelas ou tapis à faire nettoyer ?{' '}
          <Link href="/nettoyage-textile" className="text-ocean font-medium underline">
            Le nettoyage textile
          </Link>
          .
        </p>
      </Section>

      <Faq items={FAQ} />

      <Section fond="abysse">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-mineral text-2xl font-semibold sm:text-3xl">
            Un état des lieux de sortie à préparer ?
          </h2>
          <p className="text-mineral/70 mt-4 text-base leading-relaxed">
            Une réponse le jour même en semaine.
          </p>
          <div className="mt-8">
            <a
              href="#devis"
              className="rounded-suiton bg-aqua text-abysse inline-flex h-12 items-center justify-center px-6 text-sm font-semibold shadow-sm transition-[opacity,transform,box-shadow] duration-200 hover:-translate-y-px hover:opacity-90 hover:shadow-md active:translate-y-0"
            >
              Demander ce nettoyage
            </a>
          </div>
          <p className="text-mineral/60 mt-4 text-sm">
            Ou appelez directement le{' '}
            <a href={`tel:${ENTREPRISE.telephoneE164}`} className="font-medium underline">
              {ENTREPRISE.telephone}
            </a>
          </p>
        </div>
      </Section>
    </>
  );
}
