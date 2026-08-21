import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AppelFinal,
  Carte,
  Coche,
  FilAriane,
  Section,
  TitreSection,
} from '@/components/site/blocs';
import { Comparaison } from '@/components/site/comparaison';
import { realisationParSlug, slugsPublies, realisations } from '@/lib/site/realisations';
import { LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { COMMUNES } from '@/lib/site/communes';
import { SERVICES } from '@/lib/site/services';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, metadonnees, url } from '@/lib/site/seo';

/**
 * Fiche d'un chantier publie.
 *
 * C'est la page la plus utile du site au referencement long : elle contient
 * une commune, une surface, un type de bien et un texte redige a la main.
 * Aucune page de service ne peut couvrir « nettoyage apres renovation
 * appartement 90 m² Waterloo » — celle-ci, oui.
 *
 * Elle n'existe que si le chantier a ete publie depuis l'espace de gestion,
 * avec l'accord du client. Rien n'est publie automatiquement : ni les photos,
 * ni le resume.
 */

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const publies = await slugsPublies();
  return publies.map((p) => ({ slug: p.slug }));
}

const LIBELLES_BIEN: Record<string, string> = {
  studio: 'Studio',
  appartement: 'Appartement',
  maison: 'Maison',
  villa: 'Villa',
  bureaux: 'Bureaux',
  commerce: 'Commerce',
  autre: 'Bien',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await realisationParSlug(slug);
  if (!c) return {};

  const bien = LIBELLES_BIEN[c.propertyType] ?? 'Bien';
  const titre = `${LIBELLES_SERVICE[c.service]} — ${bien.toLowerCase()} de ${c.surface} m² à ${c.commune}`;

  return metadonnees({
    title:
      titre.length > 65
        ? `${LIBELLES_SERVICE[c.service]} à ${c.commune} — ${c.surface} m²`
        : titre,
    description: c.resume.slice(0, 160).trim(),
    chemin: `/realisations/${c.slug}`,
    image: c.paires[0]?.apres.url ?? undefined,
  });
}

export default async function PageRealisation({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await realisationParSlug(slug);
  if (!c) notFound();

  const bien = LIBELLES_BIEN[c.propertyType] ?? 'Bien';
  const commune = COMMUNES.find(
    (x) => x.nom.toLowerCase() === c.commune.toLowerCase() || x.codePostal === c.codePostal,
  );
  const service = SERVICES.find((s) => s.type === c.service);
  const autres = (await realisations()).filter((x) => x.slug !== c.slug).slice(0, 3);

  const heures = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
  };

  return (
    <>
      <Jsonld
        donnees={[
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: 'Réalisations', chemin: '/realisations' },
            { nom: `${c.commune} — ${c.surface} m²`, chemin: `/realisations/${c.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: `${LIBELLES_SERVICE[c.service]} — ${bien.toLowerCase()} de ${c.surface} m² à ${c.commune}`,
            description: c.resume,
            datePublished: c.publieeLe,
            url: url(`/realisations/${c.slug}`),
            author: { '@type': 'Organization', name: ENTREPRISE.nom },
            publisher: { '@type': 'Organization', name: ENTREPRISE.nom },
            ...(c.photos.length > 0 ? { image: c.photos.map((p) => p.url) } : {}),
            about: {
              '@type': 'Service',
              name: LIBELLES_SERVICE[c.service],
              areaServed: { '@type': 'City', name: c.commune },
            },
          },
        ]}
      />

      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Réalisations', href: '/realisations' },
          { nom: `${c.commune} — ${c.surface} m²`, href: `/realisations/${c.slug}` },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-12">
          <p className="text-aqua-deep text-xs font-medium tracking-[0.12em] uppercase">
            {c.commune}
            {c.codePostal ? ` · ${c.codePostal}` : ''} · Chantier {c.reference}
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            {LIBELLES_SERVICE[c.service]} — {bien.toLowerCase()} de {c.surface} m² à {c.commune}
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            {c.resume}
          </p>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Surface</dt>
              <dd className="font-heading tabular mt-1 text-lg font-semibold">
                {c.surface} m²
              </dd>
            </div>
            <div>
              <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Type de bien</dt>
              <dd className="font-heading mt-1 text-lg font-semibold">{bien}</dd>
            </div>
            {c.dureeMin ? (
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">
                  Durée réelle
                </dt>
                <dd className="font-heading mt-1 text-lg font-semibold">
                  {heures(c.dureeMin)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Livré le</dt>
              <dd className="font-heading mt-1 text-lg font-semibold">
                {new Date(c.publieeLe).toLocaleDateString('fr-BE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {c.paires.length > 0 ? (
        <Section>
          <TitreSection
            surtitre="Avant / après"
            titre="Le même cadrage, avant et après"
            chapeau="Faites glisser le curseur. Les deux photos sont prises au même endroit, à la même focale : c'est ce qui rend la comparaison honnête."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {c.paires.map((p) => (
              <Comparaison key={p.avant.id} avant={p.avant} apres={p.apres} piece={p.piece} />
            ))}
          </div>
        </Section>
      ) : null}

      {c.photos.filter((p) => p.paire === null).length > 0 ? (
        <Section fond="mineral">
          <TitreSection titre="Autres vues du chantier" niveau={2} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.photos
              .filter((p) => p.paire === null)
              .map((p) => (
                <li
                  key={p.id}
                  className="rounded-suiton border-mineral-dark overflow-hidden border bg-white"
                >
                  <img
                    src={p.url}
                    alt={p.legende ?? `${p.piece} — ${c.commune}`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {p.legende ? (
                    <p className="border-mineral-dark text-ardoise border-t px-4 py-3 text-sm">
                      {p.legende}
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
        </Section>
      ) : null}

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Carte>
            <h2 className="font-heading text-base font-semibold">Ce qui a été fait</h2>
            <div className="mt-5 space-y-2.5">
              {(service?.inclus ?? []).slice(0, 6).map((t) => (
                <p key={t} className="flex gap-3 text-sm leading-relaxed">
                  <Coche className="text-aqua-deep" />
                  <span>{t}</span>
                </p>
              ))}
            </div>
            <p className="border-mineral-dark text-ardoise mt-5 border-t pt-4 text-xs leading-relaxed">
              Protocole identique sur chaque chantier, dans le même ordre. C&apos;est ce qui
              rend le résultat reproductible.
            </p>
          </Carte>

          <div>
            <h2 className="font-heading text-lg font-semibold">
              Un chantier comparable à {c.commune} ?
            </h2>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Ce chantier faisait {c.surface} m². Décrivez le vôtre en deux minutes : vous
              recevez une estimation immédiate, puis un devis ferme sous 24 heures ouvrées.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/reservation?service=${c.service}&surface=${c.surface}&bien=${c.propertyType}${c.codePostal ? `&cp=${c.codePostal}` : ''}`}
                className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 flex h-12 items-center justify-center px-6 text-sm font-medium transition-colors"
              >
                Devis pour un chantier similaire
              </Link>
              <a
                href={`tel:${ENTREPRISE.telephoneE164}`}
                className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center border px-6 text-sm font-medium transition-colors"
              >
                {ENTREPRISE.telephone}
              </a>
            </div>

            <ul className="border-mineral-dark mt-8 space-y-2 border-t pt-6 text-sm">
              {service ? (
                <li>
                  <Link href={`/${service.slug}`} className="text-ocean hover:underline">
                    Tout savoir sur le {service.nom.toLowerCase()}
                  </Link>
                </li>
              ) : null}
              {commune ? (
                <li>
                  <Link
                    href={`/nettoyage-fin-de-chantier/${commune.slug}`}
                    className="text-ocean hover:underline"
                  >
                    Nettoyage de fin de chantier à {commune.nom}
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href="/realisations" className="text-ocean hover:underline">
                  Voir toutes nos réalisations
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {autres.length > 0 ? (
        <Section fond="mineral">
          <h2 className="font-heading text-lg font-semibold">Autres chantiers</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {autres.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/realisations/${a.slug}`}
                  className="group rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-full flex-col border bg-white p-5 transition-colors"
                >
                  <span className="text-aqua-deep text-xs font-medium tracking-[0.1em] uppercase">
                    {a.commune} · {a.surface} m²
                  </span>
                  <span className="font-heading group-hover:text-ocean mt-2 text-sm font-semibold">
                    {LIBELLES_SERVICE[a.service]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <AppelFinal titre={`Un chantier à livrer à ${c.commune} ?`} />
    </>
  );
}
