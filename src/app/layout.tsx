import type { Metadata, Viewport } from 'next';
import { inter, jura } from './fonts';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { SITE_URL } from '@/lib/site/seo';
import './globals.css';

/**
 * Layout racine.
 *
 * Il sert deux applications sous le meme domaine : le site public suiton.be
 * et l'espace de gestion SUITON OS. Les valeurs par defaut sont donc celles
 * du site — c'est lui qui est indexe. Les layouts de l'espace applicatif et
 * du portail client reposent explicitement `robots: noindex`.
 *
 * `metadataBase` evite d'avoir a absolutiser chaque URL d'image a la main.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${ENTREPRISE.nom} — ${ENTREPRISE.activite} à ${ENTREPRISE.commune}`,
    template: `%s · ${ENTREPRISE.nom}`,
  },
  description:
    'Nettoyage de fin de travaux en Belgique — construction neuve ou rénovation. Vitres comprises, ' +
    'rapport photo avant/après, devis ferme sous 24 heures.',
  applicationName: ENTREPRISE.nom,
  authors: [{ name: ENTREPRISE.nom, url: SITE_URL }],
  creator: ENTREPRISE.nom,
  publisher: ENTREPRISE.nom,
  robots: { index: true, follow: true },
  formatDetection: { telephone: true },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B2239',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-BE" className={`${jura.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
