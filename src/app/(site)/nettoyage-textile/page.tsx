import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, TitreSection, Carte, ListePuces, Faq, FilAriane } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, jsonldFaq, metadonnees } from '@/lib/site/seo';

/**
 * Nettoyage textile — prestation secondaire.
 *
 * Meme logique que /nettoyage-auto : prix a la piece (tapis, canape,
 * matelas), pas au m². Pas de calculateur, un formulaire de demande.
 */

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: 'Nettoyage textile — tapis, canapés, matelas — SUITON, Enghien',
  description:
    'Nettoyage en profondeur de tapis, canapés et matelas. Traitement des taches et odeurs. Basés à Enghien, sur rendez-vous ou à domicile.',
  chemin: '/nettoyage-textile',
});

const ARTICLES = [
  {
    titre: 'Tapis',
    detail: 'Shampouinage en profondeur, taches et odeurs traitées, séchage rapide.',
  },
  {
    titre: 'Canapés',
    detail: 'Tissu ou cuir, coussins compris, désodorisation incluse.',
  },
  {
    titre: 'Matelas',
    detail: 'Nettoyage en profondeur, traitement anti-acariens, taches ciblées.',
  },
] as const;

const FAQ = [
  {
    question: 'Le nettoyage se fait-il chez moi ?',
    reponse:
      'Oui pour les canapés et matelas, sur place. Pour les tapis, à domicile ou en atelier selon la taille et l’état — nous vous conseillons au moment du rendez-vous.',
  },
  {
    question: 'Combien de temps avant de pouvoir réutiliser le meuble ?',
    reponse:
      'Le séchage prend généralement quelques heures. Nous vous donnons un délai précis selon le tissu et la méthode utilisée.',
  },
  {
    question: 'Et si la tache ne part pas complètement ?',
    reponse:
      "Certaines taches anciennes ou certains pigments ne partent jamais entièrement. Nous vous le disons honnêtement avant d'intervenir, pas après.",
  },
];

export default function PageNettoyageTextile() {
  return (
    <>
      <Jsonld
        donnees={[
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Nettoyage textile', chemin: '/nettoyage-textile' },
          ]),
          jsonldFaq(FAQ),
        ]}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Nettoyage textile', href: '/nettoyage-textile' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Nettoyage textile — tapis, canapés, matelas
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Un nettoyage en profondeur, pièce par pièce. Décrivez ce que vous avez, nous vous
            rappelons avec un prix.
          </p>
        </div>
      </section>

      <Section>
        <TitreSection surtitre="Ce que nous traitons" titre="Tapis, canapés, matelas" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {ARTICLES.map((a) => (
            <Carte key={a.titre}>
              <h3 className="font-heading text-base font-semibold">{a.titre}</h3>
              <p className="text-ardoise mt-2 text-sm leading-relaxed">{a.detail}</p>
            </Carte>
          ))}
        </div>
        <div className="mt-8 max-w-2xl">
          <ListePuces
            items={[
              'Traitement des taches et odeurs',
              'Produits adaptés à chaque type de tissu',
              'Séchage rapide, intervention à domicile pour canapés et matelas',
            ]}
          />
        </div>
      </Section>

      <Section fond="mineral" id="devis">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <FormulaireRappel
            titre="Demander un devis textile"
            description="Dites-nous ce qu'il faut nettoyer. Nous rappelons le jour même en semaine."
            libelleMessage="Ce que vous voulez faire nettoyer"
            placeholderMessage="Un canapé 3 places en tissu, quelques taches, et un tapis 200x300."
          />

          <div className="rounded-suiton border-aqua-deep/25 bg-aqua-wash border p-6">
            <h2 className="font-heading text-base font-semibold">Pourquoi pas de prix affiché ?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed">
              Le prix dépend de la taille, du tissu et de l&apos;état de chaque pièce — pas
              d&apos;une surface. Décrivez-nous ce que vous avez, nous vous rappelons avec un
              chiffrage précis.
            </p>
            <p className="text-ardoise mt-5 text-sm">
              Besoin d&apos;un nettoyage de fin de travaux ? Le{' '}
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
            Un tapis, un canapé, un matelas à faire nettoyer ?
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
