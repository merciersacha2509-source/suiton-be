import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { COMMUNES, communeParSlug } from '@/lib/site/communes';
import { parSlug } from '@/lib/site/services';
import { ENTREPRISE, GARANTIES } from '@/lib/site/entreprise';
import { grillePublique } from '@/lib/site/tarifs';
import { Jsonld, jsonldFaq, jsonldFilAriane, metadonnees } from '@/lib/site/seo';

/**
 * Pages locales.
 *
 * Huit pages, huit contenus. Le gabarit est partage — la mise en page d'une
 * page locale n'a aucune raison de varier — mais chaque paragraphe est
 * redige pour sa commune dans `COMMUNES`.
 *
 * La FAQ est construite ici plutot que stockee : trois questions sur quatre
 * ont la meme forme d'une commune a l'autre (delai, frais de deplacement,
 * zone couverte) mais des reponses reellement differentes, parce qu'elles
 * dependent de la distance, de la zone tarifaire et du parc immobilier.
 * Les stocker en dur produirait huit copies a maintenir.
 */

// Voir la note sur dynamicParams dans src/app/(site)/[service]/page.tsx :
// une commune inconnue passe par notFound(), sans erreur interne.
export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return COMMUNES.map((c) => ({ commune: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ commune: string }>;
}): Promise<Metadata> {
  const { commune: slug } = await params;
  const commune = communeParSlug(slug);
  if (!commune) return {};
  return metadonnees({
    title: commune.titleSeo,
    description: commune.metaDescription,
    chemin: `/nettoyage-fin-de-chantier/${commune.slug}`,
  });
}

export default async function PageCommune({
  params,
}: {
  params: Promise<{ commune: string }>;
}) {
  const { commune: slug } = await params;
  const commune = communeParSlug(slug);
  if (!commune) notFound();

  const settings = await grillePublique();
  const voisines = COMMUNES.filter((c) => commune.voisines.includes(c.slug));
  const services = commune.servicesPhares.map(parSlug).filter((s) => s !== undefined);
  const gratuit = commune.zone === 'principale';

  const faq = [
    {
      question: `Intervenez-vous vraiment à ${commune.nom} ?`,
      reponse:
        commune.distanceKm === 0
          ? `Oui — SUITON est basée à ${commune.nom}, ${ENTREPRISE.adresse}. C'est notre commune : nous y intervenons sans frais de déplacement et parfois le jour même quand un créneau se libère.`
          : `Oui, régulièrement. ${commune.nom} est à ${commune.distanceKm} km d'Enghien, soit ${commune.trajet} de trajet. Nous partons à 7 h pour être sur place à l'ouverture du chantier.`,
    },
    {
      question: `Y a-t-il des frais de déplacement pour ${commune.nom} ?`,
      reponse: gratuit
        ? `Non. ${commune.nom} est dans notre zone principale : aucun frais de déplacement n'est appliqué.`
        : `Oui, un forfait de ${settings.zones.secondaire?.frais ?? 25} € HTVA, annoncé sur le devis et jamais ajouté après coup. C'est un montant fixe, pas un calcul au kilomètre qui varie selon l'itinéraire pris.`,
    },
    {
      question: `Combien coûte un nettoyage de fin de chantier à ${commune.nom} ?`,
      reponse: `Le tarif est le même que partout ailleurs dans notre zone : de ${settings.prix_m2.fin_de_chantier?.standard?.min ?? 7} à ${settings.prix_m2.fin_de_chantier?.lourd?.max ?? 14} € HTVA le m² selon le niveau de salissure${gratuit ? '' : `, plus le forfait de déplacement de ${settings.zones.secondaire?.frais ?? 25} €`}. Le calculateur en haut de page donne une fourchette immédiate ; le devis, envoyé sous 24 heures ouvrées, donne un montant ferme.`,
    },
    {
      question: `Sous quel délai pouvez-vous intervenir à ${commune.nom} ?`,
      reponse: `Sous 5 à 10 jours ouvrés en temps normal. Pour une remise de clés serrée, une intervention sous 48 heures est possible avec une majoration de ${Math.round(settings.majoration_urgence * 100)} %. Dites-nous la date de réception : c'est elle qui commande.`,
    },
  ];

  return (
    <>
      <Jsonld
        donnees={[
          jsonldFaq(faq),
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Nettoyage de fin de chantier', chemin: '/nettoyage-fin-de-chantier' },
            { nom: commune.nom, chemin: `/nettoyage-fin-de-chantier/${commune.slug}` },
          ]),
        ]}
      />

      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Nettoyage de fin de chantier', href: '/nettoyage-fin-de-chantier' },
          { nom: commune.nom, href: `/nettoyage-fin-de-chantier/${commune.slug}` },
        ]}
      />

      {/* Premier ecran ------------------------------------------------- */}
      <section className="border-mineral-dark border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 lg:grid-cols-[1fr_24rem] lg:gap-14">
          <div>
            <p className="text-aqua-deep text-xs font-medium tracking-[0.12em] uppercase">
              {commune.codePostal} · {commune.province}
              {commune.nomNl ? ` · ${commune.nomNl}` : ''}
            </p>
            <h1 className="mt-4 max-w-2xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
              {commune.h1}
            </h1>

            <div className="text-ardoise mt-6 max-w-2xl space-y-4 text-base leading-relaxed">
              {commune.contexte.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>

            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">
                  Depuis Enghien
                </dt>
                <dd className="font-heading mt-1 text-lg font-semibold">
                  {commune.distanceKm === 0
                    ? 'Sur place'
                    : `${commune.distanceKm} km · ${commune.trajet}`}
                </dd>
              </div>
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Déplacement</dt>
                <dd className="font-heading mt-1 text-lg font-semibold">
                  {gratuit
                    ? 'Sans frais'
                    : `${settings.zones.secondaire?.frais ?? 25} € forfait`}
                </dd>
              </div>
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Devis</dt>
                <dd className="font-heading mt-1 text-lg font-semibold">Sous 24 h</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/reservation?cp=${commune.codePostal}`}
                className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 flex h-12 items-center justify-center px-6 text-sm font-medium transition-colors"
              >
                Devis gratuit à {commune.nom}
              </Link>
              <a
                href={`tel:${ENTREPRISE.telephoneE164}`}
                className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center border px-6 text-sm font-medium transition-colors"
              >
                {ENTREPRISE.telephone}
              </a>
            </div>
          </div>

          <div className="lg:pt-2">
            <Calculateur settings={settings} codePostalInitial={commune.codePostal} compact />
          </div>
        </div>
      </section>

      {/* Parc immobilier ------------------------------------------------ */}
      <Section fond="mineral">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection
              surtitre="Le terrain"
              titre={`Ce que nous rencontrons à ${commune.nom}`}
            />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              {commune.parcImmobilier}
            </p>
            {commune.quartiers.length > 0 ? (
              <div className="mt-8">
                <h3 className="text-ardoise text-xs font-medium tracking-[0.1em] uppercase">
                  Quartiers desservis
                </h3>
                <p className="mt-3 text-sm">{commune.quartiers.join(' · ')}</p>
              </div>
            ) : null}
          </div>

          <Carte>
            <h2 className="font-heading text-base font-semibold">
              Ce qui change concrètement ici
            </h2>
            <div className="mt-5">
              <ListePuces items={commune.specificites} />
            </div>
          </Carte>
        </div>
      </Section>

      {/* Services -------------------------------------------------------- */}
      <Section>
        <TitreSection
          surtitre="Prestations"
          titre={`Les plus demandées à ${commune.nom}`}
          chapeau="Toutes nos prestations sont disponibles dans la commune. Celles-ci reviennent le plus souvent, compte tenu du parc immobilier local."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className="group rounded-suiton border-mineral-dark hover:border-ardoise-clair flex flex-col border p-6 transition-colors"
            >
              <h3 className="font-heading group-hover:text-ocean text-lg font-semibold">
                {s.nom}
              </h3>
              <p className="text-ardoise mt-3 flex-1 text-sm leading-relaxed">{s.accroche}</p>
              <p className="border-mineral-dark mt-5 border-t pt-4 text-sm">
                {s.slug === 'nettoyage-de-vitres' ? (
                  <span className="font-heading text-lg font-semibold">Sur devis</span>
                ) : (
                  <>
                    <span className="font-heading tabular text-lg font-semibold">
                      dès {s.prixDepuis} €
                    </span>
                    <span className="text-ardoise text-xs"> / m² HTVA</span>
                  </>
                )}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Garanties ------------------------------------------------------- */}
      <Section fond="abysse">
        <TitreSection
          surtitre="Nos engagements"
          titre={`Les mêmes garanties à ${commune.nom} qu'ailleurs`}
          chapeau="Une garantie qui varie selon la distance n'est pas une garantie. Celles-ci figurent sur chaque devis, quelle que soit la commune."
          inverse
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {GARANTIES.map((g) => (
            <div key={g.titre}>
              <span className="bg-aqua block h-px w-8" aria-hidden />
              <h3 className="font-heading text-mineral mt-4 text-base font-semibold">
                {g.titre}
              </h3>
              <p className="text-mineral/60 mt-2 text-sm leading-relaxed">{g.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ ------------------------------------------------------------- */}
      <Section>
        <Faq
          items={faq}
          titre={`Nettoyage de fin de chantier à ${commune.nom} : vos questions`}
        />
      </Section>

      {/* Maillage -------------------------------------------------------- */}
      {voisines.length > 0 ? (
        <Section fond="mineral">
          <h2 className="font-heading text-lg font-semibold">
            Nous intervenons aussi à proximité
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {voisines.map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/nettoyage-fin-de-chantier/${v.slug}`}
                  className="group rounded-suiton border-mineral-dark hover:border-ardoise-clair flex items-baseline justify-between gap-4 border bg-white p-4 transition-colors"
                >
                  <span className="group-hover:text-ocean text-sm font-medium">{v.nom}</span>
                  <span className="text-ardoise shrink-0 text-xs">{v.codePostal}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-ardoise mt-8 text-sm">
            Votre commune n&apos;est pas listée ? Nous intervenons dans un rayon de{' '}
            {ENTREPRISE.rayonKm} km autour d&apos;Enghien.{' '}
            <a href={`tel:${ENTREPRISE.telephoneE164}`} className="text-ocean underline">
              Appelez-nous
            </a>
            , nous vous dirons en une minute si nous couvrons votre adresse.
          </p>
        </Section>
      ) : null}

      <AppelFinal titre={`Un chantier à livrer à ${commune.nom} ?`} />
    </>
  );
}
