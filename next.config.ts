import type { NextConfig } from 'next';

/**
 * Politique de securite du contenu.
 *
 * CHOIX ASSUME : `script-src` autorise 'unsafe-inline'.
 *
 * Next.js injecte la charge utile React Server Components dans des balises
 * <script> en ligne. Les interdire suppose une CSP a nonce, donc un nonce
 * different par reponse, donc un rendu DYNAMIQUE de chaque page : les vingt
 * pages du site passeraient de statiques a calculees a chaque visite. On
 * echangerait un TTFB de 2 ms contre un TTFB de plusieurs dizaines de
 * millisecondes, sur toutes les pages, en permanence.
 *
 * Ce que cette CSP protege reellement, et qui compte davantage ici :
 *   — `object-src 'none'`      : aucun greffon, aucun Flash residuel ;
 *   — `base-uri 'self'`        : une balise <base> injectee ne peut pas
 *                                detourner toutes les URL relatives ;
 *   — `form-action 'self'`     : un formulaire injecte ne peut pas poster
 *                                les donnees d'un visiteur vers un tiers ;
 *   — `frame-ancestors 'none'` : pas de detournement de clic ;
 *   — `connect-src` limite a Supabase : meme en cas d'injection, aucune
 *                                exfiltration vers un domaine arbitraire.
 *
 * Le site ne charge AUCUN script tiers et n'affiche AUCUN contenu HTML
 * fourni par un utilisateur. Le vecteur que 'unsafe-inline' laisserait
 * ouvert suppose deja une execution de code arbitraire cote serveur — a ce
 * stade, la CSP n'est plus la ligne de defense pertinente.
 *
 * A revoir le jour ou le site accepte du HTML exterieur ou un script tiers.
 */
const supabaseOrigine = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://x.supabase.co').origin;
  } catch {
    return 'https://*.supabase.co';
  }
})();

// Google Analytics n'ouvre la CSP que s'il est reellement configure.
const ga = process.env.NEXT_PUBLIC_GA_ID
  ? ' https://www.googletagmanager.com https://www.google-analytics.com'
  : '';

// `next dev` a besoin d'`eval()` pour le rechargement a chaud (HMR) : le
// devtool webpack par defaut en developpement compile chaque module dans un
// eval(). NODE_ENV distingue fiablement `next dev` (development) de
// `next build && next start`, utilise en preview comme en production — cette
// derogation ne s'applique donc jamais hors developpement local.
const evalDev = process.env.NODE_ENV === 'development' ? ' \'unsafe-eval\'' : '';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${evalDev}${ga}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigine}${ga}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * En-tetes de securite appliques a toutes les reponses.
 * Referrer-Policy: no-referrer est structurant — le portail client
 * fonctionne par jeton dans l'URL, qui ne doit jamais fuiter par referer.
 */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/**
 * En-tete X-Robots-Tag, hors production.
 *
 * La balise meta robots ne couvre que le HTML. Le sitemap, le robots.txt, les
 * PDF servis depuis le stockage et les reponses d'API n'en ont pas. L'en-tete
 * HTTP, lui, s'applique a tout ce qui sort du serveur — c'est la seule
 * protection reellement exhaustive pour une preview.
 */
const entetesEnvironnement =
  process.env.APP_ENV === 'production'
    ? []
    : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  images: {
    formats: ['image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  async headers() {
    return [{ source: '/:path*', headers: [...securityHeaders, ...entetesEnvironnement] }];
  },
  async redirects() {
    return [
      // "Apres renovation" est fusionne dans "Fin de travaux" — l'ancienne
      // URL ne doit plus rendre un 404.
      {
        source: '/nettoyage-apres-renovation',
        destination: '/nettoyage-fin-de-chantier',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
