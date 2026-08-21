import type { MetadataRoute } from 'next';
import { SERVICES } from '@/lib/site/services';
import { COMMUNES } from '@/lib/site/communes';
import { SITE_URL } from '@/lib/site/seo';
import { slugsPublies } from '@/lib/site/realisations';

/**
 * Sitemap.
 *
 * Genere depuis les memes donnees que les pages : une page ajoutee au
 * catalogue editorial entre automatiquement dans le sitemap. Un sitemap
 * maintenu a la main finit toujours par mentir.
 *
 * Les priorites reflètent l'intention commerciale, pas la profondeur : les
 * pages locales portent le referencement, elles priment sur « à propos ».
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const maintenant = new Date();

  const fixes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/devis`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/reservation`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/professionnels`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/realisations`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/a-propos`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.6 },
  ];

  const services: MetadataRoute.Sitemap = SERVICES.map((s) => ({
    url: `${SITE_URL}/${s.slug}`,
    changeFrequency: 'monthly',
    priority: 0.9,
  }));

  const communes: MetadataRoute.Sitemap = COMMUNES.map((c) => ({
    url: `${SITE_URL}/nettoyage-fin-de-chantier/${c.slug}`,
    changeFrequency: 'monthly',
    priority: 0.85,
  }));

  // Les realisations entrent au sitemap des leur publication, avec leur
  // vraie date : c'est la seule partie du sitemap qui bouge apres la mise en
  // ligne, et celle que Google a le plus interet a revisiter.
  const publiees: MetadataRoute.Sitemap = (await slugsPublies()).map((r) => ({
    url: `${SITE_URL}/realisations/${r.slug}`,
    lastModified: new Date(r.publieeLe),
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  const statiques = [...fixes, ...services, ...communes].map((e) => ({
    ...e,
    lastModified: maintenant,
  }));

  return [...statiques, ...publiees];
}
