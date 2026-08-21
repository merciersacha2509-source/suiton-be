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
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFaq, jsonldFilAriane, metadonnees } from '@/lib/site/seo';

/**
 * Espace professionnels.
 *
 * Le lecteur n'est pas le meme que sur le reste du site. Un entrepreneur ne
 * cherche pas a etre rassure sur la qualite : il cherche a savoir si nous
 * tenons un planning, si notre facture passe sa comptabilite, et combien il
 * paie a l'annee. La page repond a ces trois questions dans cet ordre.
 */

export const revalidate = 86400;

const FAQ = [
  {
    question: 'Appliquez-vous l’autoliquidation de la TVA ?',
    reponse:
      "Oui, d'office pour les travaux immobiliers entre assujettis établis en Belgique, conformément à l'article 20 de l'arrêté royal n° 1. La facture porte la mention légale « Autoliquidation » et ne contient aucune TVA : c'est vous qui la déclarez et la déduisez dans la même déclaration.",
  },
  {
    question: 'Vos factures sont-elles conformes à l’obligation de facturation électronique ?',
    reponse: `Oui. Depuis le 1er janvier 2026, une facture B2B entre assujettis belges doit être émise au format électronique structuré. Nous émettons via le réseau Peppol, sous l'identifiant ${ENTREPRISE.peppol}. Un PDF envoyé par courriel n'est plus conforme et bloquerait votre déduction de TVA — nous vous envoyons quand même une copie PDF lisible, mais c'est le flux Peppol qui fait foi.`,
  },
  {
    question: 'Proposez-vous des tarifs négociés au volume ?',
    reponse:
      "Oui, à partir d'un engagement de volume annuel. La grille est fixée une fois, valable douze mois, et vous n'avez plus à demander de devis chantier par chantier : vous annoncez une surface et un niveau de salissure, et le prix est connu. Nous restons preneurs d'une révision annuelle, dans les deux sens.",
  },
  {
    question: 'Combien de temps à l’avance faut-il réserver ?',
    reponse:
      "Idéalement une semaine. Mais la réalité d'un chantier n'est jamais celle du planning : nous gardons délibérément des créneaux libres pour les décalages de dernière minute. Prévenez-nous dès que la date bouge, même si vous ne connaissez pas encore la nouvelle.",
  },
  {
    question: 'Le rapport photo est-il transmissible à mon client final ?',
    reponse:
      "Oui, c'est même son intérêt principal. Le rapport est un PDF neutre : checklist horodatée et photos avant/après pièce par pièce. Vous le transmettez tel quel à la réception. Plusieurs de nos clients l'annexent au PV de réception provisoire.",
  },
  {
    question: 'Intervenez-vous sur plusieurs lots le même jour ?',
    reponse:
      "Oui, c'est le cas le plus fréquent en promotion résidentielle : nous enchaînons les appartements d'un même immeuble. Le tarif au m² baisse mécaniquement, parce que le temps de mise en place ne se paie qu'une fois.",
  },
];

export const metadata: Metadata = metadonnees({
  title: 'Nettoyage de fin de chantier pour entrepreneurs et promoteurs',
  description:
    'Pour entrepreneurs, promoteurs, architectes et syndics : grille négociée au volume, autoliquidation TVA, facturation Peppol, rapport photo transmissible.',
  chemin: '/professionnels',
});

export default function PageProfessionnels() {
  return (
    <>
      <Jsonld
        donnees={[
          jsonldFaq(FAQ),
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Professionnels', chemin: '/professionnels' },
          ]),
        ]}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Professionnels', href: '/professionnels' },
        ]}
      />

      <section className="border-mineral-dark bg-abysse text-mineral border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <p className="text-aqua text-xs font-medium tracking-[0.14em] uppercase">
            Entrepreneurs · Promoteurs · Architectes · Syndics
          </p>
          <h1 className="text-mineral mt-5 max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Votre dernier corps de métier avant la remise des clés
          </h1>
          <p className="text-mineral/70 mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
            La réception se joue rarement sur le gros œuvre. Elle se joue sur ce que le client
            voit en entrant. Nous prenons cette dernière étape en charge, avec un planning tenu
            et une preuve écrite du résultat.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={`mailto:${ENTREPRISE.email}?subject=Demande%20de%20grille%20professionnelle`}
              className="rounded-suiton bg-aqua text-abysse flex h-12 items-center justify-center px-6 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Demander une grille annuelle
            </a>
            <a
              href={`tel:${ENTREPRISE.telephoneE164}`}
              className="rounded-suiton text-mineral flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-medium transition-colors hover:bg-white/5"
            >
              {ENTREPRISE.telephone}
            </a>
          </div>
        </div>
      </section>

      <Section>
        <TitreSection
          surtitre="Ce que vous obtenez"
          titre="Trois choses, dans cet ordre"
          chapeau="Un prix connu, un planning tenu, une facture qui passe. Le reste est du confort."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <Carte>
            <h3 className="font-heading text-base font-semibold">
              Un prix connu à l&apos;année
            </h3>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Grille négociée au volume, fixée pour douze mois. Vous annoncez une surface et un
              niveau de salissure : le montant est immédiat, sans aller-retour de devis.
            </p>
            <div className="mt-5">
              <ListePuces
                items={[
                  'Pas de devis chantier par chantier',
                  'Dégressivité sur les lots enchaînés',
                  'Révision annuelle, dans les deux sens',
                ]}
              />
            </div>
          </Carte>

          <Carte>
            <h3 className="font-heading text-base font-semibold">Un planning qui tient</h3>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Nous gardons des créneaux libres en permanence, parce qu&apos;un chantier ne se
              termine jamais le jour prévu. Un décalage annoncé la veille ne nous met pas en
              échec.
            </p>
            <div className="mt-5">
              <ListePuces
                items={[
                  'Créneaux tampons réservés aux décalages',
                  'Confirmation la veille, systématiquement',
                  'Interlocuteur unique, joignable',
                ]}
              />
            </div>
          </Carte>

          <Carte>
            <h3 className="font-heading text-base font-semibold">Une facture conforme</h3>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Autoliquidation appliquée d&apos;office et facturation électronique structurée via
              Peppol, comme l&apos;impose la réglementation belge depuis le 1<sup>er</sup>{' '}
              janvier 2026.
            </p>
            <dl className="border-mineral-dark mt-5 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ardoise">Peppol</dt>
                <dd className="tabular font-medium">{ENTREPRISE.peppol}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ardoise">TVA</dt>
                <dd className="tabular font-medium">{ENTREPRISE.tva}</dd>
              </div>
            </dl>
          </Carte>
        </div>
      </Section>

      <Section fond="mineral">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection
              surtitre="La preuve"
              titre="Un document que vous pouvez transmettre tel quel"
              chapeau="À chaque livraison, un rapport PDF : checklist horodatée poste par poste, photos avant/après au même cadrage, réserves éventuelles consignées."
            />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              Plusieurs de nos clients l&apos;annexent au PV de réception provisoire. C&apos;est
              un document neutre, sans argumentaire commercial : il constate, il ne vend pas.
            </p>
          </div>
          <Carte>
            <h3 className="font-heading text-base font-semibold">
              Ce que vous n&apos;avez plus à faire
            </h3>
            <div className="mt-5">
              <ListePuces
                items={[
                  'Repasser derrière pour vérifier avant la réception',
                  'Expliquer au client final pourquoi les vitres étaient en supplément',
                  'Gérer une reprise de dernière minute la veille de la remise des clés',
                  'Relancer un prestataire injoignable un vendredi après-midi',
                ]}
              />
            </div>
          </Carte>
        </div>
      </Section>

      <Section>
        <Faq items={FAQ} titre="Questions des professionnels" />
      </Section>

      <Section fond="mineral">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">Ouvrir un compte professionnel</h2>
          <p className="text-ardoise mt-4 text-base leading-relaxed">
            Dites-nous votre volume annuel estimé et vos communes d&apos;intervention. Nous vous
            envoyons une grille sous 48 heures.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={`mailto:${ENTREPRISE.email}?subject=Ouverture%20de%20compte%20professionnel`}
              className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 flex h-12 items-center justify-center px-6 text-sm font-medium transition-colors"
            >
              {ENTREPRISE.email}
            </a>
            <Link
              href="/reservation"
              className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center border bg-white px-6 text-sm font-medium transition-colors"
            >
              Ou demander un devis ponctuel
            </Link>
          </div>
        </div>
      </Section>

      <AppelFinal
        titre="Un lot à livrer cette semaine ?"
        texte="Appelez-nous. Si un créneau est libre, nous vous le confirmons dans l'heure."
      />
    </>
  );
}
