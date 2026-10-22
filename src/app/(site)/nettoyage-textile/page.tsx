import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, TitreSection, Carte, ListePuces, Faq, FilAriane } from '@/components/site/blocs';
import { DevisTextile } from '@/components/site/devis-textile';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, jsonldFaq, metadonnees } from '@/lib/site/seo';
import {
  CONTENU_VAPEUR_CANAPE,
  PRIX_TAPIS,
  PRIX_TAPIS_SUPPLEMENTAIRE,
  TAILLES_MATELAS,
  VAPEUR_CANAPE,
  calculerCanape,
  AVERTISSEMENT_VAPEUR,
  eur,
} from '@/lib/site/tarifs-secondaires';

/**
 * Nettoyage textile — prestation secondaire.
 *
 * Meme logique que /nettoyage-auto : prix a la piece (tapis, canape,
 * matelas), pas au m². Pas de calculateur, un formulaire de demande.
 */

export const revalidate = 86400;

const PETIT_CANAPE = calculerCanape(2, false);
const PALIERS_CANAPE = [2, 4, 6, 8].map((places) => ({ places, ...calculerCanape(places, false) }));

export const metadata: Metadata = metadonnees({
  title: 'Nettoyage textile — tapis, canapés, matelas — SUITON, Enghien',
  description:
    `Nettoyage en profondeur de tapis, canapés et matelas. Canapés dès ${eur(PETIT_CANAPE.min)} TVAC, matelas dès ${eur(TAILLES_MATELAS[0]!.prixMin)}, tapis ${eur(PRIX_TAPIS)} pièce. Basés à Enghien, sur rendez-vous ou à domicile.`,
  chemin: '/nettoyage-textile',
});

const ARTICLES = [
  {
    titre: 'Tapis',
    detail: 'Shampouinage en profondeur, taches et odeurs traitées, séchage rapide.',
  },
  {
    titre: 'Canapés',
    detail: 'Tissu ou cuir, coussins compris.',
  },
  {
    titre: 'Matelas',
    detail: 'Nettoyage en profondeur, traitement anti-acariens, taches ciblées.',
  },
] as const;

const FAQ = [
  {
    question: 'Combien coûte le nettoyage d’un canapé ?',
    reponse: `${PALIERS_CANAPE.map((p) => `${p.places} places : ${eur(p.min)} à ${eur(p.max)}`).join(' ; ')} TVAC, selon l'état du canapé. Le prix exact est confirmé sur photos avant l'intervention.`,
  },
  {
    question: 'Combien coûte le nettoyage d’un matelas ou d’un tapis ?',
    reponse: `Un matelas 1 place coûte de ${eur(TAILLES_MATELAS[0]!.prixMin)} à ${eur(TAILLES_MATELAS[0]!.prixMax)} TVAC, un 2 places de ${eur(TAILLES_MATELAS[1]!.prixMin)} à ${eur(TAILLES_MATELAS[1]!.prixMax)}, les deux faces, selon l'état. Un tapis de taille courante coûte ${eur(PRIX_TAPIS)} TVAC, ${eur(PRIX_TAPIS + PRIX_TAPIS_SUPPLEMENTAIRE)} pour deux. Le prix exact est confirmé sur photos.`,
  },
  {
    question: 'En quoi consiste l’option total vapeur ?',
    reponse: `${CONTENU_VAPEUR_CANAPE} Elle coûte +${eur(VAPEUR_CANAPE)} TVAC par canapé, quel que soit l'état du canapé, et reste toujours facultative. ${AVERTISSEMENT_VAPEUR}`,
  },
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
            Un nettoyage en profondeur, pièce par pièce. Canapés, matelas et tapis à la pièce :
            simulez votre prix, nous vous rappelons pour confirmer.
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
              'Traitement des taches',
              'Produits adaptés à chaque type de tissu',
              'Séchage rapide, intervention à domicile pour canapés et matelas',
            ]}
          />
        </div>
      </Section>

      <Section fond="mineral" id="devis">
        <DevisTextile />
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
            Un tapis, un canapé, un matelas à faire nettoyer ?
          </h2>
          <p className="text-mineral/70 mt-4 text-base leading-relaxed">
            Une réponse le jour même en semaine.
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
