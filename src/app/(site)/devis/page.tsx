import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AppelFinal,
  Carte,
  Faq,
  FilAriane,
  ListePuces,
  Section,
  TitreSection,
} from '@/components/site/blocs';
import { Calculateur } from '@/components/site/calculateur';
import { grillePublique } from '@/lib/site/tarifs';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFaq, jsonldFilAriane, metadonnees } from '@/lib/site/seo';

/**
 * Page « Devis ».
 *
 * Elle ne duplique pas le parcours de reservation : elle explique le prix.
 * Un visiteur qui cherche « devis nettoyage fin de chantier » veut d'abord
 * comprendre ce qui fait varier le montant — ensuite seulement il remplit
 * un formulaire.
 */

export const revalidate = 3600;

const FAQ = [
  {
    question: 'Le devis est-il vraiment gratuit ?',
    reponse:
      "Oui, et sans visite obligatoire. Nous chiffrons sur la base de la surface, du type de bien, du niveau de salissure et de quelques photos. Une visite n'est nécessaire que pour les grandes surfaces ou les configurations atypiques — et elle reste gratuite.",
  },
  {
    question: 'Qu’est-ce qu’un devis ferme ?',
    reponse:
      "Un montant qui ne bouge pas. Si l'état du chantier correspond à ce que vous avez décrit, vous payez le montant du devis, point. Nous ne pratiquons pas le supplément découvert sur place : c'est notre travail d'estimer correctement, pas le vôtre.",
  },
  {
    question: 'Que se passe-t-il si le chantier est plus sale que prévu ?',
    reponse:
      "Nous vous appelons avant de commencer, avec des photos. Vous décidez : on maintient le périmètre au prix convenu, ou on l'élargit avec un avenant chiffré que vous acceptez par écrit. Aucun travail supplémentaire n'est facturé sans votre accord préalable.",
  },
  {
    question: 'Quels éléments font varier le prix ?',
    reponse:
      "Quatre. La surface, d'abord. Le niveau de salissure ensuite — un chantier après ponçage demande deux à trois fois plus de temps qu'une remise en état légère. La configuration : un duplex avec beaucoup de vitrages coûte plus qu'un plateau. Et l'urgence, si vous avez besoin d'une intervention sous 48 heures.",
  },
  {
    question: 'La TVA est-elle comprise dans les montants affichés ?',
    reponse:
      "Non, tous nos prix sont annoncés hors TVA. Pour un particulier, la TVA de 21 % s'ajoute (6 % pour les logements de plus de dix ans, sous conditions). Pour un assujetti belge sur des travaux immobiliers, l'autoliquidation s'applique : nous facturons sans TVA et vous la déclarez.",
  },
];

export const metadata: Metadata = metadonnees({
  title: 'Devis nettoyage de fin de chantier — gratuit et ferme sous 24 h',
  description:
    'Estimation immédiate et devis ferme sous 24 heures ouvrées. Gratuit, sans engagement, sans visite obligatoire. Vitres comprises, garantie retouche 48 h.',
  chemin: '/devis',
});

export default async function PageDevis() {
  const settings = await grillePublique();

  return (
    <>
      <Jsonld
        donnees={[
          jsonldFaq(FAQ),
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Devis', chemin: '/devis' },
          ]),
        ]}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Devis', href: '/devis' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 lg:grid-cols-[1fr_24rem] lg:gap-14">
          <div>
            <h1 className="max-w-2xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
              Un devis ferme, pas une fourchette qui bouge le jour du chantier
            </h1>
            <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              Estimation immédiate ci-contre. Devis écrit sous 24 heures ouvrées, gratuit et
              sans engagement. Le montant vous engage autant qu&apos;il nous engage.
            </p>
            <div className="mt-8 max-w-xl">
              <ListePuces
                items={[
                  'Gratuit et sans engagement, sans visite obligatoire',
                  'Envoyé sous 24 heures ouvrées, en PDF',
                  'Montant ferme pour le périmètre décrit',
                  'Ce qui est compris et ce qui ne l’est pas, écrit noir sur blanc',
                  'Acceptation en ligne, sans impression ni scan',
                ]}
              />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/reservation"
                className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 flex h-12 items-center justify-center px-6 text-sm font-medium transition-colors"
              >
                Démarrer ma demande
              </Link>
              <a
                href={`tel:${ENTREPRISE.telephoneE164}`}
                className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center border px-6 text-sm font-medium transition-colors"
              >
                Ou appeler le {ENTREPRISE.telephone}
              </a>
            </div>
          </div>
          <div className="lg:pt-2">
            <Calculateur settings={settings} compact />
          </div>
        </div>
      </section>

      <Section fond="mineral">
        <TitreSection
          surtitre="Comment nous chiffrons"
          titre="Quatre variables, aucune autre"
          chapeau="Un devis de nettoyage n'a rien de mystérieux. Voici exactement ce que nous regardons — et pourquoi."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              titre: 'La surface',
              detail:
                "Le m² au sol, pas le volume. C'est la base du calcul, mais pas le seul facteur : deux biens de 100 m² peuvent demander des durées très différentes.",
            },
            {
              titre: 'Le niveau de salissure',
              detail:
                "Léger, standard ou lourd. Un chantier après ponçage de plafonnage demande deux à trois fois plus de temps qu'une remise en état légère. C'est la variable qui pèse le plus.",
            },
            {
              titre: 'La configuration',
              detail:
                "Nombre de sanitaires, surface vitrée, escaliers, accès. Un duplex très vitré coûte plus qu'un plateau de même surface, parce que les vitres se comptent à l'unité.",
            },
            {
              titre: 'Le délai',
              detail: `Une intervention sous 48 heures mobilise l'équipe hors planning. Elle est majorée de ${Math.round(settings.majoration_urgence * 100)} %, annoncée à l'avance et jamais appliquée sans votre accord.`,
            },
          ].map((v, i) => (
            <Carte key={v.titre} className="bg-white">
              <span className="font-heading tabular text-aqua-deep text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading mt-3 text-base font-semibold">{v.titre}</h3>
              <p className="text-ardoise mt-2 text-sm leading-relaxed">{v.detail}</p>
            </Carte>
          ))}
        </div>
      </Section>

      <Section>
        <Faq items={FAQ} titre="Le devis, en questions" />
      </Section>

      <AppelFinal />
    </>
  );
}
