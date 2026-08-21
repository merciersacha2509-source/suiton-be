import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site/seo';
import { siteIndexable } from '@/lib/env';

/**
 * robots.txt.
 *
 * Le portail client est explicitement interdit : ses URL contiennent un
 * jeton d'acces. Une seule page indexee suffirait a exposer le dossier d'un
 * client dans les resultats de recherche.
 *
 * L'espace applicatif est interdit lui aussi — il est derriere
 * authentification, mais autant ne pas gaspiller de budget d'exploration.
 */
export default function robots(): MetadataRoute.Robots {
  // Hors production, on interdit TOUT. Une preview accessible est une preview
  // qui finira par etre exploree : il suffit d'un lien partage quelque part.
  if (!siteIndexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/portail/',
          '/api/',
          '/connexion',
          '/tableau-de-bord',
          '/chantiers',
          '/clients',
          '/planning',
          '/terrain',
          '/facturation',
          '/donnees',
          '/intelligence',
          '/playbook',
          '/parametres',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
