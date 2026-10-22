import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Faq, FilAriane } from '@/components/site/blocs';
import { DevisVehicule } from '@/components/site/devis-vehicule';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, jsonldFaq, metadonnees } from '@/lib/site/seo';
import {
  AVERTISSEMENT_VAPEUR,
  PRIX_APPEL_VEHICULE,
  TAILLES_VEHICULE,
  eur,
} from '@/lib/site/tarifs-secondaires';

/**
 * Nettoyage auto — prestation secondaire.
 *
 * Pas de calculateur au m² : une base (nettoyage interieur, selon la taille du
 * vehicule) et trois options cumulables, chacune avec son prix. Montants et contenus dans
 * `lib/site/tarifs-secondaires.ts`. Le choix est transmis par le formulaire
 * de rappel existant — une reponse humaine, pas un paiement en ligne.
 */

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: `Nettoyage auto — intérieur dès ${eur(PRIX_APPEL_VEHICULE)} TVAC — SUITON`,
  description: `Nettoyage auto : intérieur dès ${eur(PRIX_APPEL_VEHICULE)} TVAC, avec options au choix — shampouinage des sièges, total vapeur. Sur rendez-vous.`,
  chemin: '/nettoyage-auto',
});

const FAQ = [
  {
    question: 'Combien coûte le nettoyage de mon véhicule ?',
    reponse: `Le nettoyage intérieur coûte ${eur(TAILLES_VEHICULE[0]!.prixTvac)} TVAC pour une citadine ou une compacte, ${eur(TAILLES_VEHICULE[1]!.prixTvac)} TVAC pour un SUV, un monospace ou un utilitaire. Les options (shampouinage, total vapeur) ont le même prix quelle que soit la taille.`,
  },
  {
    question: 'Les options sont-elles obligatoires ?',
    reponse:
      "Non. Le nettoyage intérieur est la base ; le shampouinage des sièges et le total vapeur sont deux options indépendantes, que vous prenez ensemble, séparément ou pas du tout. Nous ne proposons pas de lavage extérieur.",
  },
  {
    question: 'Le total vapeur convient-il à toutes les matières ?',
    reponse: AVERTISSEMENT_VAPEUR,
  },
  {
    question: 'Faut-il apporter le véhicule ?',
    reponse:
      'Oui, sur rendez-vous à notre adresse. Contactez-nous pour fixer un créneau.',
  },
  {
    question: 'Les taches anciennes partent-elles ?',
    reponse:
      "La plupart des taches et odeurs oui, avec un traitement adapté au tissu. Décrivez-nous le cas dans le formulaire, ça nous aide à préparer l'intervention.",
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
            Nettoyage auto
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Le nettoyage intérieur selon la taille de votre véhicule, puis les options que vous choisissez : shampouinage des
            sièges, total vapeur. Sur rendez-vous.
          </p>
        </div>
      </section>

      <Section fond="mineral" id="devis">
        <DevisVehicule />
        <p className="text-ardoise mt-6 text-sm">
          Besoin d&apos;un nettoyage de fin de travaux ? Le{' '}
          <Link href="/reservation" className="text-ocean font-medium underline">
            parcours en ligne
          </Link>{' '}
          affiche un prix immédiat pour ces prestations-là.
        </p>
      </Section>

      <Faq items={FAQ} />

      <Section fond="abysse">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-mineral text-2xl font-semibold sm:text-3xl">
            Un véhicule à faire nettoyer ?
          </h2>
          <p className="text-mineral/70 mt-4 text-base leading-relaxed">
            Composez votre nettoyage, nous vous rappelons le jour même en semaine.
          </p>
          <div className="mt-8">
            <a
              href="#devis"
              className="rounded-suiton bg-aqua text-abysse inline-flex h-12 items-center justify-center px-6 text-sm font-semibold shadow-sm transition-[opacity,transform,box-shadow] duration-200 hover:-translate-y-px hover:opacity-90 hover:shadow-md active:translate-y-0"
            >
              Composer mon nettoyage
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
