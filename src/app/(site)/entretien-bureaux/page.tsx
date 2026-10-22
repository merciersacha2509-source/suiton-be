import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, TitreSection, ListePuces, Faq, FilAriane } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, jsonldFaq, metadonnees } from '@/lib/site/seo';

/**
 * Entretien de bureaux et de cabinets : contrat recurrent, sur devis apres
 * visite. Aucun prix affiche, aucune duree. La demande de visite passe par le
 * formulaire de rappel (source `contact`), qui arrive dans « Demandes de
 * rappel » avec une ligne de contexte en tete du message.
 */

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: 'Entretien de bureaux et de cabinets, contrat régulier | SUITON',
  description:
    'Entretien régulier de bureaux, commerces, entrepôts et cabinets médicaux autour d’Enghien. Un passage à jour fixe, chaque semaine, toutes les 2 semaines ou chaque mois, avec une fiche de contrôle signée. Devis après visite gratuite.',
  chemin: '/entretien-bureaux',
});

const POUR_QUI = [
  'Bureaux',
  'Commerces',
  'Entrepôts (entretien des sols)',
  'Cabinets médicaux et paramédicaux',
];

const COMPRIS = [
  'Sols : aspiration, puis lavage',
  'Sanitaires',
  'Désinfection des points de contact : poignées, interrupteurs, robinets',
  'Vitrages intérieurs et portes vitrées',
  'Poubelles',
];

const FORMULES = ['Hebdomadaire', 'Toutes les 2 semaines', 'Mensuelle'];

const CONDITIONS = [
  'Contrat à durée indéterminée, résiliable avec un mois de préavis',
  'Facture électronique Peppol en fin de mois',
  'Autoliquidation de la TVA entre assujettis',
];

const FAQ = [
  {
    question: 'Comment le prix est-il fixé ?',
    reponse:
      'Sur devis, après une visite gratuite des locaux. Nous tenons compte de la surface, du type de locaux et de la fréquence choisie. Le devis est écrit et vous savez ce qui est compris avant de vous engager.',
  },
  {
    question: 'À quel moment passez-vous ?',
    reponse:
      'À un jour fixe que nous convenons ensemble, de façon à ne pas perturber votre activité.',
  },
  {
    question: 'Que faites-vous dans un cabinet médical ou paramédical ?',
    reponse:
      'Un bionettoyage selon un protocole écrit. Nous ne manipulons pas le matériel médical ni le matériel informatique, et nous ne prenons pas en charge les déchets de soins.',
  },
  {
    question: 'Comment savoir que le travail a été fait ?',
    reponse:
      'Après chaque passage, nous vous transmettons une fiche de contrôle qualité signée et des photos avant/après.',
  },
  {
    question: 'Puis-je arrêter le contrat ?',
    reponse:
      'Oui. Le contrat est à durée indéterminée et résiliable avec un mois de préavis.',
  },
];

export default function PageEntretienBureaux() {
  return (
    <>
      <Jsonld
        donnees={[
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Entretien de bureaux et de cabinets', chemin: '/entretien-bureaux' },
          ]),
          jsonldFaq(FAQ),
        ]}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Entretien de bureaux et de cabinets', href: '/entretien-bureaux' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Entretien de bureaux et de cabinets
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Un passage à jour fixe, chaque semaine, toutes les 2 semaines ou chaque mois, avec une
            fiche de contrôle signée après chaque passage.
          </p>
          <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
            <div>
              <dt className="text-ardoise-clair text-xs tracking-[0.12em] uppercase">Prix</dt>
              <dd className="font-heading mt-1 text-xl font-semibold">Sur devis après visite</dd>
            </div>
            <div>
              <dt className="text-ardoise-clair text-xs tracking-[0.12em] uppercase">Visite</dt>
              <dd className="font-heading mt-1 text-xl font-semibold">Gratuite</dd>
            </div>
          </dl>
          <div className="mt-8">
            <a
              href="#visite"
              className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 inline-flex h-12 items-center justify-center px-6 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
            >
              Demander une visite gratuite
            </a>
          </div>
        </div>
      </section>

      <Section>
        <TitreSection surtitre="Pour qui" titre="Des locaux utilisés tous les jours" />
        <div className="mt-8 max-w-2xl">
          <ListePuces items={POUR_QUI} />
        </div>
      </Section>

      <Section fond="mineral">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <TitreSection surtitre="Ce qui est compris" titre="À chaque passage" />
            <div className="mt-8">
              <ListePuces items={COMPRIS} />
            </div>
          </div>
          <div>
            <TitreSection surtitre="Formules" titre="Un rythme adapté à vos locaux" />
            <div className="mt-8">
              <ListePuces items={FORMULES} />
            </div>
            <p className="text-ardoise mt-4 text-sm leading-relaxed">
              Le passage a lieu à un jour fixe, convenu ensemble, sans perturber votre activité.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <TitreSection surtitre="Cabinets" titre="Bionettoyage selon un protocole écrit" />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              Pour les cabinets médicaux et paramédicaux, nous suivons un protocole écrit. Le
              matériel médical, le matériel informatique et les déchets de soins ne sont pas
              manipulés.
            </p>
          </div>
          <div>
            <TitreSection surtitre="La preuve" titre="Vous voyez ce qui a été fait" />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              Après chaque passage, nous vous transmettons une fiche de contrôle qualité signée et
              des photos avant/après.
            </p>
          </div>
        </div>
      </Section>

      <Section fond="mineral">
        <TitreSection surtitre="Conditions" titre="Un contrat simple" />
        <div className="mt-8 max-w-2xl">
          <ListePuces items={CONDITIONS} />
        </div>
        <p className="text-ardoise mt-6 text-sm">
          Un besoin ponctuel, après des travaux ?{' '}
          <Link href="/nettoyage-fin-de-chantier" className="text-ocean font-medium underline">
            Voir le nettoyage de fin de travaux
          </Link>
          .
        </p>
      </Section>

      <Section id="visite">
        <div className="mx-auto max-w-2xl">
          <TitreSection
            surtitre="Visite gratuite"
            titre="Parlons de vos locaux"
            chapeau="Décrivez vos locaux et le rythme souhaité. Nous vous rappelons pour fixer une visite gratuite, puis nous vous envoyons un devis écrit."
          />
          <div className="mt-8">
            <FormulaireRappel
              titre="Demander une visite gratuite"
              description="Nous rappelons le jour même en semaine."
              libelleMessage="Vos locaux"
              placeholderMessage="Type de locaux, surface approximative, fréquence souhaitée, commune."
              libelleSubmit="Demander une visite gratuite"
              source="contact"
              avecEmail
              avecAdresse
              resume="Demande de visite gratuite : entretien de bureaux et de cabinets"
            />
          </div>
          <p className="text-ardoise mt-4 text-center text-sm">
            Ou appelez directement le{' '}
            <a href={`tel:${ENTREPRISE.telephoneE164}`} className="font-medium underline">
              {ENTREPRISE.telephone}
            </a>
          </p>
        </div>
      </Section>

      <Faq items={FAQ} />
    </>
  );
}
