import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, TitreSection, Carte, ListePuces, Faq, FilAriane } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, jsonldFaq, metadonnees } from '@/lib/site/seo';

/**
 * Nettoyage auto — prestation secondaire.
 *
 * Pas de calculateur : le prix d'un nettoyage auto depend du vehicule et de
 * son etat, pas d'une surface en m². Le formulaire de rappel existant sert
 * de parcours de demande — deux champs, une reponse humaine, plutot qu'un
 * chiffrage automatique qui devrait de toute facon etre confirme au
 * telephone.
 */

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: 'Nettoyage auto intérieur et extérieur — SUITON, Enghien',
  description:
    "Nettoyage auto en formule intérieur ou intérieur et extérieur. Sièges, plastiques, tapis, carrosserie. Basés à Enghien, sur rendez-vous.",
  chemin: '/nettoyage-auto',
});

const FAQ = [
  {
    question: 'Quelle est la différence entre les deux formules ?',
    reponse:
      "La formule intérieur traite l'habitacle : sièges, tapis, plastiques, vitres intérieures. La formule intérieur et extérieur y ajoute le lavage de la carrosserie, des jantes et des vitres extérieures.",
  },
  {
    question: 'Faut-il apporter le véhicule ?',
    reponse:
      "Oui, sur rendez-vous à notre adresse à Enghien. Contactez-nous pour un créneau — nous confirmons le prix au vu de l'état et du type de véhicule.",
  },
  {
    question: 'Les taches anciennes partent-elles ?',
    reponse:
      "La plupart des taches et odeurs oui, avec un traitement adapté au tissu. Décrivez-nous le cas dans le formulaire ci-dessous, ça nous aide à préparer l'intervention.",
  },
];

export default function PageNettoyageAuto() {
  return (
    <>
      <Jsonld
        donnees={[
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Nettoyage auto', chemin: '/nettoyage-auto' },
          ]),
          jsonldFaq(FAQ),
        ]}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Nettoyage auto', href: '/nettoyage-auto' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Nettoyage auto intérieur et extérieur
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Deux formules, du siège au coffre. Sur rendez-vous à Enghien — décrivez votre véhicule,
            nous vous rappelons avec un prix.
          </p>
        </div>
      </section>

      <Section>
        <TitreSection surtitre="Les formules" titre="Intérieur, ou intérieur et extérieur" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Carte>
            <h3 className="font-heading text-base font-semibold">Formule Intérieur</h3>
            <p className="text-ardoise mt-2 text-sm leading-relaxed">
              L&apos;habitacle remis à neuf, sans toucher à l&apos;extérieur.
            </p>
            <div className="mt-5">
              <ListePuces
                items={[
                  'Aspiration complète — sièges, tapis, coffre',
                  'Shampouinage des sièges tissu',
                  'Dépoussiérage et traitement des plastiques',
                  'Vitres intérieures',
                  'Désodorisation',
                ]}
              />
            </div>
          </Carte>

          <Carte>
            <h3 className="font-heading text-base font-semibold">
              Formule Intérieur et Extérieur
            </h3>
            <p className="text-ardoise mt-2 text-sm leading-relaxed">
              La formule intérieur, complétée par la carrosserie.
            </p>
            <div className="mt-5">
              <ListePuces
                items={[
                  'Tout le contenu de la formule Intérieur',
                  'Lavage carrosserie',
                  'Jantes et passages de roue',
                  'Vitres extérieures',
                  'Finition — séchage et lustrage rapide',
                ]}
              />
            </div>
          </Carte>
        </div>
      </Section>

      <Section fond="mineral" id="devis">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <FormulaireRappel
            titre="Demander un devis auto"
            description="Dites-nous le véhicule et la formule souhaitée. Nous rappelons le jour même en semaine."
            libelleMessage="Votre véhicule et la formule voulue"
            placeholderMessage="Berline, formule intérieur et extérieur, sièges tissu avec quelques taches."
          />

          <div className="rounded-suiton border-aqua-deep/25 bg-aqua-wash border p-6">
            <h2 className="font-heading text-base font-semibold">Pourquoi pas de prix affiché ?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed">
              Un nettoyage auto dépend du véhicule et de son état — pas d&apos;une surface. Plutôt
              qu&apos;un prix générique qu&apos;il faudrait de toute façon ajuster au téléphone,
              nous préférons vous rappeler directement avec un chiffrage précis.
            </p>
            <p className="text-ardoise mt-5 text-sm">
              Besoin d&apos;un nettoyage de fin de chantier ou après rénovation ? Le{' '}
              <Link href="/reservation" className="text-ocean font-medium underline">
                parcours en ligne
              </Link>{' '}
              affiche un prix immédiat pour ces prestations-là.
            </p>
          </div>
        </div>
      </Section>

      <Faq items={FAQ} />

      <Section fond="abysse">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-mineral text-2xl font-semibold sm:text-3xl">
            Un véhicule à faire nettoyer ?
          </h2>
          <p className="text-mineral/70 mt-4 text-base leading-relaxed">
            Deux champs, une réponse le jour même en semaine.
          </p>
          <div className="mt-8">
            <a
              href="#devis"
              className="rounded-suiton bg-aqua text-abysse inline-flex h-12 items-center justify-center px-6 text-sm font-semibold shadow-sm transition-[opacity,transform,box-shadow] duration-200 hover:-translate-y-px hover:opacity-90 hover:shadow-md active:translate-y-0"
            >
              Demander un devis
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
