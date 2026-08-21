import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageService } from '@/components/site/page-service';
import { SERVICES, parSlug } from '@/lib/site/services';
import { grillePublique } from '@/lib/site/tarifs';
import { metadonnees } from '@/lib/site/seo';

/**
 * Pages de service, hors nettoyage de fin de chantier.
 *
 * Le nettoyage de fin de chantier a son propre repertoire : il porte les
 * huit pages locales en enfant. Next.js donne de toute facon la priorite au
 * segment litteral, mais un lecteur du code doit pouvoir le comprendre sans
 * connaitre cette regle.
 *
 * `dynamicParams` reste a `true`, mais toute valeur inconnue passe par
 * `notFound()` : le visiteur recoit un 404 et la page 404 du site.
 *
 * Le regler a `false` produisait le meme code HTTP mais faisait remonter une
 * `NoFallbackError` dans les journaux du serveur a chaque URL sondee par un
 * robot. Des erreurs internes par centaines pour un comportement nominal
 * finissent par masquer les vraies pannes.
 */

export const dynamicParams = true;
export const revalidate = 86400;

const SERVICES_DYNAMIQUES = SERVICES.filter((s) => s.slug !== 'nettoyage-fin-de-chantier');

export function generateStaticParams() {
  return SERVICES_DYNAMIQUES.map((s) => ({ service: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service: slug } = await params;
  const service = parSlug(slug);
  if (!service) return {};
  return metadonnees({
    title: service.titleSeo,
    description: service.metaDescription,
    chemin: `/${service.slug}`,
  });
}

export default async function PageServiceDynamique({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: slug } = await params;
  const service = parSlug(slug);
  if (!service) notFound();

  const settings = await grillePublique();
  return <PageService service={service} settings={settings} />;
}
