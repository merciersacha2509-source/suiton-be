import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageService } from '@/components/site/page-service';
import { parSlug } from '@/lib/site/services';
import { grillePublique } from '@/lib/site/tarifs';
import { metadonnees } from '@/lib/site/seo';

/**
 * Nettoyage de fin de chantier — page mere.
 *
 * C'est la page la plus disputee du site : elle porte la requete principale
 * et sert de parent aux huit pages communales. Elle a donc son propre
 * segment litteral plutot que de passer par [service].
 */

export const revalidate = 86400;

const SERVICE = parSlug('nettoyage-fin-de-chantier');

export const metadata: Metadata = SERVICE
  ? metadonnees({
      title: SERVICE.titleSeo,
      description: SERVICE.metaDescription,
      chemin: '/nettoyage-fin-de-chantier',
    })
  : {};

export default async function PageFinDeChantier() {
  if (!SERVICE) notFound();
  const settings = await grillePublique();
  return <PageService service={SERVICE} settings={settings} />;
}
