import Link from 'next/link';
import type { Metadata } from 'next';
import { Calculateur } from '@/components/site/calculateur';
import { EnVue } from '@/components/site/en-vue';
import {
  AppelFinal,
  Carte,
  Coche,
  Faq,
  ListePuces,
  Section,
  TitreSection,
} from '@/components/site/blocs';
import { grillePublique } from '@/lib/site/tarifs';
import { ENTREPRISE, GARANTIES, ETAPES_CLIENT } from '@/lib/site/entreprise';
import { SERVICES } from '@/lib/site/services';
import { COMMUNES } from '@/lib/site/communes';
import { Jsonld, jsonldFaq, metadonnees } from '@/lib/site/seo';

/**
 * Accueil.
 *
 * Une page d'accueil de societe de nettoyage se juge sur une chose : au bout
 * de six secondes, le visiteur sait-il combien ca coute et quand il aura son
 * devis. Tout le reste — le recit, les garanties, la preuve — sert a
 * transformer cette information en confiance, pas a la remplacer.
 *
 * Le calculateur est place dans le premier ecran, a droite sur grand ecran
 * et immediatement sous l'accroche sur mobile. C'est l'element qui convertit ;
 * il ne descend pas sous la ligne de flottaison.
 */

export const revalidate = 3600;

/**
 * Message pre-rempli du lien WhatsApp.
 *
 * Un fil qui s'ouvre vide fait porter au visiteur la charge de formuler sa
 * demande. Une premiere phrase deja ecrite leve cette friction, et nous
 * arrivons avec un debut de qualification plutot qu'un « bonjour ».
 */
const MESSAGE_WHATSAPP = encodeURIComponent(
  'Bonjour, je souhaite un devis pour un nettoyage de fin de chantier.',
);

const FAQ_ACCUEIL = [
  {
    question: 'Combien coûte un nettoyage de fin de chantier ?',
    reponse:
      'Entre 5 et 14 € HTVA le m² selon le niveau de salissure. Un appartement de 90 m² après ponçage se situe généralement entre 630 et 720 € HTVA. Le calculateur ci-dessus donne une fourchette immédiate ; le devis, envoyé sous 24 heures ouvrées, donne un montant ferme.',
  },
  {
    question: 'Les vitres sont-elles vraiment comprises ?',
    reponse:
      "Oui, vitres, châssis et seuils, à l'intérieur comme à l'extérieur au rez-de-chaussée. Nous ne les facturons jamais en supplément. C'est le poste que la plupart des sociétés sortent du devis pour afficher un prix au m² plus bas — puis le refacturent une fois sur place.",
  },
  {
    question: 'Sous quel délai pouvez-vous intervenir ?',
    reponse:
      "En temps normal, sous 5 à 10 jours ouvrés. Pour une remise de clés serrée, nous proposons une intervention sous 48 heures avec une majoration de 25 %. Dites-nous la date de réception : c'est elle qui commande, pas notre planning.",
  },
  {
    question: 'Que se passe-t-il si le résultat ne me convient pas ?',
    reponse:
      'Vous nous appelez dans les 48 heures et nous repassons sans frais, sans discussion et sans expertise contradictoire. Cette garantie est écrite sur le devis, pas seulement sur le site.',
  },
  {
    question: 'Travaillez-vous avec les entreprises et les syndics ?',
    reponse:
      "Oui. Pour les entrepreneurs, promoteurs et syndics, nous appliquons l'autoliquidation de la TVA (article 20 de l'AR n° 1) et facturons par voie électronique structurée via Peppol, comme l'impose la réglementation belge depuis le 1er janvier 2026. Un espace dédié existe : voir la page Professionnels.",
  },
  {
    question: 'Dans quelles communes intervenez-vous ?',
    reponse:
      "Depuis Enghien, dans un rayon de 45 km : Hal, Tubize, Nivelles, Braine-l'Alleud, Waterloo, Saint-Pieters-Leeuw et Bruxelles. Aucun frais de déplacement dans un rayon de 20 km ; 25 € au-delà, annoncés sur le devis et jamais ajoutés après coup.",
  },
];

export const metadata: Metadata = metadonnees({
  title: 'Nettoyage de fin de chantier et après rénovation à Enghien',
  description:
    'Nettoyage de fin de chantier et après rénovation à Enghien, Hal, Nivelles, Waterloo et Bruxelles. Vitres comprises, rapport photo avant/après, devis ferme sous 24 h. Dès 5 €/m².',
  chemin: '/',
});

export default async function Accueil() {
  const settings = await grillePublique();

  return (
    <>
      <Jsonld donnees={jsonldFaq(FAQ_ACCUEIL)} />

      {/* ---------------------------------------------------------------- */}
      {/* Premier ecran                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-mineral-dark bg-mineral relative overflow-hidden border-b">
        {/* Motif discret : quelques lignes fines inspirees de l'onde du
            logo. Opacite quasi imperceptible, jamais au-dessus du texte. */}
        <svg
          className="pointer-events-none absolute top-0 right-0 hidden h-full w-[28rem] opacity-[0.04] lg:block"
          viewBox="0 0 400 500"
          fill="none"
          aria-hidden
        >
          <circle cx="380" cy="60" r="60" stroke="#0B2239" strokeWidth="1.5" />
          <circle cx="380" cy="60" r="120" stroke="#0B2239" strokeWidth="1.5" />
          <circle cx="380" cy="60" r="180" stroke="#0B2239" strokeWidth="1.5" />
          <circle cx="380" cy="60" r="240" stroke="#0B2239" strokeWidth="1.5" />
        </svg>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_26rem] lg:gap-16 lg:py-20">
          <div className="lg:pt-6">
            <p className="border-aqua-deep/25 bg-aqua-wash text-aqua-deep anime-apparition inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <span className="bg-aqua-deep h-1.5 w-1.5 rounded-full" aria-hidden />
              Enghien · Brabant wallon · Hainaut · Bruxelles
            </p>

            <h1 className="anime-apparition mt-6 text-3xl leading-[1.15] font-bold [animation-delay:60ms] sm:text-4xl lg:text-[2.75rem]">
              Le chantier est fini.
              <br />
              Nous le rendons livrable.
            </h1>

            <p className="text-ardoise anime-apparition mt-5 max-w-xl text-base leading-relaxed [animation-delay:120ms] sm:text-lg">
              Nettoyage de fin de chantier et d&apos;après-rénovation. Vitres et châssis
              compris, jamais en supplément. Rapport photo avant/après remis à chaque livraison.
              Devis ferme sous 24 heures.
            </p>

            <ul className="anime-apparition mt-8 grid gap-3 [animation-delay:180ms] sm:grid-cols-2">
              {[
                'Vitres et châssis compris',
                'Devis ferme, pas une fourchette',
                'Rapport photo horodaté',
                'Garantie retouche 48 h',
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-sm font-medium">
                  <Coche className="text-aqua-deep" />
                  {t}
                </li>
              ))}
            </ul>

            {/*
              Trois actions, jamais une seule. Un visiteur sur un chantier veut
              appeler ; un entrepreneur en reunion prefere WhatsApp ; un
              particulier le soir remplit un formulaire. Proposer un seul
              chemin, c'est perdre les deux autres.
            */}
            <div className="anime-apparition mt-8 grid gap-3 [animation-delay:240ms] sm:grid-cols-3">
              <Link
                href="/reservation"
                className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 flex h-12 items-center justify-center px-5 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
              >
                Devis gratuit
              </Link>
              <a
                href={`tel:${ENTREPRISE.telephoneE164}`}
                className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center gap-2 border bg-white px-5 text-sm font-medium transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm active:translate-y-0"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M4.5 3h3l1.5 3.5-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2L17 12.5v3a1.5 1.5 0 0 1-1.6 1.5A13 13 0 0 1 3 4.6 1.5 1.5 0 0 1 4.5 3Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
                {ENTREPRISE.telephone}
              </a>
              <a
                href={`https://wa.me/${ENTREPRISE.whatsapp}?text=${MESSAGE_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center gap-2 border bg-white px-5 text-sm font-medium transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm active:translate-y-0"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M10 2.5a7.5 7.5 0 0 0-6.4 11.4L2.5 17.5l3.7-1.1A7.5 7.5 0 1 0 10 2.5Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7.4 7.2c.3-.1.6 0 .8.3l.5.9c.1.2.1.4 0 .6l-.3.4c.4.8 1 1.4 1.8 1.8l.4-.3c.2-.1.4-.1.6 0l.9.5c.3.2.4.5.3.8-.2.5-.7.9-1.3.9-2 0-4.2-2.2-4.2-4.2 0-.6.3-1.1.9-1.3Z"
                    fill="currentColor"
                  />
                </svg>
                WhatsApp
              </a>
            </div>

            <p className="text-ardoise mt-4 text-xs">
              Réponse sous 24 h · Devis ferme · Rapport photo avant/après
            </p>
          </div>

          <div className="anime-apparition lg:sticky lg:top-24 [animation-delay:150ms]">
            <Calculateur settings={settings} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Le probleme                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection
              surtitre="Ce qui se passe habituellement"
              titre="Un chantier propre n'est pas un chantier livrable"
              chapeau="Le gros œuvre est terminé, les corps de métier sont partis, et il reste la poussière de ponçage dans les rainures, les projections de peinture sur les châssis, le film plastique collé aux vitres depuis six mois et les résidus de silicone dans les angles de douche."
            />
            <div className="border-aqua-deep/20 text-ardoise mt-8 space-y-4 border-l pl-5 text-sm leading-relaxed">
              <p>
                Un nettoyage domestique classique ne suffit pas : ce n&apos;est pas de la
                saleté, c&apos;est du matériau. Une trace de ciment sur du grès cérame ne part
                pas au détergent ménager, elle part à l&apos;acide dilué, avec le bon temps de
                pose — ou elle abîme le carrelage définitivement.
              </p>
              <p>
                Et pendant ce temps, la remise de clés approche. C&apos;est là que la plupart
                des litiges de réception se jouent : pas sur la qualité du chantier, sur son
                état de présentation le jour J.
              </p>
            </div>
          </div>

          <EnVue className="grid gap-4 sm:grid-cols-2">
            {[
              {
                chiffre: '5 €',
                label: 'le m² HTVA',
                detail: 'Salissure légère, tarif de départ',
              },
              {
                chiffre: '24 h',
                label: 'pour le devis',
                detail: 'Jours ouvrés, montant ferme',
              },
              {
                chiffre: '48 h',
                label: 'de garantie',
                detail: 'Retouche gratuite, sans discussion',
              },
              {
                chiffre: '45 km',
                label: 'autour d’Enghien',
                detail: 'Hainaut, Brabant, Bruxelles',
              },
            ].map((s) => (
              <Carte key={s.label} className="bg-mineral">
                <p className="font-heading text-abysse text-3xl font-semibold">{s.chiffre}</p>
                <p className="mt-1 text-sm font-medium">{s.label}</p>
                <p className="text-ardoise mt-2 text-xs leading-relaxed">{s.detail}</p>
              </Carte>
            ))}
          </EnVue>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Services                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Section fond="mineral">
        <TitreSection
          surtitre="Nos prestations"
          titre="Cinq métiers, une seule exigence"
          chapeau="Chaque prestation a son protocole, ses produits et sa durée type. Nous ne facturons pas un nettoyage de fin de chantier au tarif d'un entretien, et l'inverse est vrai aussi."
        />
        <EnVue className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className="group rounded-suiton border-mineral-dark hover:border-aqua-deep/40 flex flex-col border bg-white p-6 shadow-sm transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-heading group-hover:text-ocean text-lg font-semibold">
                {s.nom}
              </h3>
              <p className="text-ardoise mt-3 flex-1 text-sm leading-relaxed">{s.accroche}</p>
              <p className="border-mineral-dark mt-5 flex items-baseline gap-2 border-t pt-4">
                <span className="font-heading tabular text-xl font-semibold">
                  dès {s.prixDepuis} €
                </span>
                <span className="text-ardoise text-xs">/ m² HTVA</span>
              </p>
              <p className="text-ardoise mt-1 text-xs">{s.dureeType}</p>
            </Link>
          ))}
        </EnVue>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Garanties                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <TitreSection
          surtitre="Nos engagements"
          titre="Quatre promesses écrites sur le devis"
          chapeau="Une promesse qui n'apparaît que sur le site n'engage personne. Celles-ci figurent sur chaque devis SUITON, à la ligne."
        />
        <EnVue className="mt-10 grid gap-4 sm:grid-cols-2">
          {GARANTIES.map((g) => (
            <Carte key={g.titre}>
              <div className="flex gap-3">
                <Coche className="text-aqua-deep" />
                <div>
                  <h3 className="font-heading text-base font-semibold">{g.titre}</h3>
                  <p className="text-ardoise mt-2 text-sm leading-relaxed">{g.detail}</p>
                </div>
              </div>
            </Carte>
          ))}
        </EnVue>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Deroulement                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section fond="abysse">
        <TitreSection
          surtitre="Comment ça se passe"
          titre="De la demande au rapport photo"
          chapeau="Cinq étapes, aucune surprise entre les deux. Vous savez à tout moment où en est votre chantier."
          inverse
        />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {ETAPES_CLIENT.map((e) => (
            <li key={e.numero} className="relative lg:pr-4">
              <span className="font-heading text-aqua tabular text-sm font-semibold">
                {String(e.numero).padStart(2, '0')}
              </span>
              <span className="mt-3 block h-px w-full bg-white/15" aria-hidden />
              <h3 className="font-heading text-mineral mt-4 text-base font-semibold">
                {e.titre}
              </h3>
              <p className="text-mineral/60 mt-2 text-sm leading-relaxed">{e.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Preuve                                                            */}
      {/* ---------------------------------------------------------------- */}
      <Section fond="mineral">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <TitreSection
              surtitre="La preuve"
              titre="Vous ne nous croyez pas sur parole. Vous regardez."
              chapeau="À la fin de chaque chantier, vous recevez un rapport : la checklist suivie pièce par pièce avec l'heure de chaque étape, et les photos avant/après cadrées au même endroit."
            />
            <div className="mt-8">
              <ListePuces
                items={[
                  'Checklist horodatée, poste par poste',
                  'Photos avant/après au même cadrage',
                  'Réserves éventuelles consignées, pas dissimulées',
                  'Document PDF conservé et consultable dans votre espace client',
                ]}
              />
            </div>
            <Link
              href="/realisations"
              className="h-touch rounded-suiton border-mineral-dark hover:border-ardoise-clair mt-8 inline-flex items-center border bg-white px-5 text-sm font-medium transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm active:translate-y-0"
            >
              Voir nos réalisations
            </Link>
          </div>

          <div className="rounded-suiton border-mineral-dark border bg-white p-6 shadow-sm">
            <p className="text-ardoise inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
              <span className="bg-aqua-deep h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Extrait d&apos;un rapport de chantier
            </p>
            <dl className="divide-mineral-dark mt-5 divide-y">
              {[
                ['Cuisine — plans et crédence', '09:24', 'Conforme'],
                ['Salle de bain — silicone et joints', '10:05', 'Conforme'],
                ['Séjour — sols et plinthes', '10:48', 'Conforme'],
                ['Châssis et vitrages', '11:32', 'Conforme'],
                ['Menuiseries et poignées', '12:10', 'Conforme'],
              ].map(([poste, heure, etat]) => (
                <div key={poste} className="flex items-center gap-3 py-3">
                  <Coche className="text-aqua-deep" />
                  <dt className="flex-1 text-sm">{poste}</dt>
                  <dd className="tabular text-ardoise text-xs">{heure}</dd>
                  <dd className="bg-aqua-wash text-aqua-deep rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
                    {etat}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="border-mineral-dark text-ardoise mt-5 border-t pt-4 text-xs leading-relaxed">
              Chaque ligne est horodatée au moment où elle est cochée sur le terrain, pas
              reconstituée le soir au bureau.
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Zones                                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <TitreSection
          surtitre="Zone d'intervention"
          titre="Huit communes, un rayon de 45 km"
          chapeau="Nous sommes basés à Enghien, à la frontière linguistique. C'est un avantage opérationnel : le Hainaut, le Brabant wallon, le Brabant flamand et Bruxelles sont tous à moins de quarante minutes."
        />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMMUNES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/nettoyage-fin-de-chantier/${c.slug}`}
                className="group rounded-suiton border-mineral-dark hover:border-aqua-deep/40 flex h-full flex-col border bg-white p-4 shadow-sm transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="font-heading group-hover:text-ocean text-base font-medium">
                  {c.nom}
                </span>
                <span className="text-ardoise mt-1 text-xs">
                  {c.codePostal} · {c.trajet}
                </span>
                <span className="text-aqua-deep mt-3 text-xs">
                  {c.zone === 'principale' ? 'Sans frais de déplacement' : 'Frais de 25 €'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Professionnels                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Section fond="mineral">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
          <div>
            <TitreSection
              surtitre="Entrepreneurs, promoteurs, syndics"
              titre="Un partenaire de livraison, pas un prestataire de plus"
              chapeau="Vous livrez plusieurs lots par mois. Vous n'avez pas besoin d'un devis à chaque fois : vous avez besoin d'un prix connu, d'un planning tenu et d'une facture conforme."
            />
            <div className="mt-8">
              <ListePuces
                items={[
                  'Grille tarifaire négociée au volume, valable à l’année',
                  'Autoliquidation TVA (art. 20, AR n° 1) appliquée d’office',
                  'Facturation électronique structurée Peppol — conforme depuis le 1ᵉʳ janvier 2026',
                  'Rapport photo transmissible tel quel à votre client final',
                  'Interlocuteur unique, joignable, qui connaît vos chantiers',
                ]}
              />
            </div>
            <Link
              href="/professionnels"
              className="h-touch rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 mt-8 inline-flex items-center px-5 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
            >
              Espace professionnels
            </Link>
          </div>

          <Carte>
            <p className="text-ardoise inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
              <span className="bg-aqua-deep h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Facturation électronique
            </p>
            <p className="mt-4 text-sm leading-relaxed">
              Depuis le 1<sup>er</sup> janvier 2026, une facture B2B entre assujettis belges
              doit être émise au format électronique structuré. Un PDF envoyé par courriel
              n&apos;est plus conforme — et bloque votre déduction de TVA.
            </p>
            <dl className="border-mineral-dark mt-6 space-y-3 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ardoise">Identifiant Peppol</dt>
                <dd className="tabular font-medium">{ENTREPRISE.peppol}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ardoise">Numéro de TVA</dt>
                <dd className="tabular font-medium">{ENTREPRISE.tva}</dd>
              </div>
            </dl>
          </Carte>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ                                                               */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <Faq items={FAQ_ACCUEIL} />
      </Section>

      <AppelFinal />
    </>
  );
}
