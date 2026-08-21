import { spawnSync } from 'node:child_process';

/**
 * Reconstruit l'application pour la verification.
 *
 * Necessaire parce que Next.js FIGE les variables NEXT_PUBLIC_* au moment de
 * la compilation : elles sont remplacees par des litteraux dans le bundle.
 * Un serveur construit avec l'URL Supabase de production ne parlera jamais a
 * la passerelle locale, quoi qu'on mette dans son environnement au demarrage.
 *
 * Poser SUITON_SKIP_BUILD=1 pour enchainer plusieurs scripts sans
 * reconstruire a chaque fois.
 */
export const ENV_VERIF = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-de-verification-locale-0000000000',
  NEXT_PUBLIC_SITE_URL: 'https://suiton.be',
  SUPABASE_SERVICE_ROLE_KEY: 'service-de-verification-locale-0000000000',
  PORTAL_TOKEN_PEPPER: 'poivre-de-verification-locale-32-octets',
  RESEND_API_KEY: '',
};

export function construire(racine) {
  if (process.env.SUITON_SKIP_BUILD === '1') return;
  process.stdout.write('construction du serveur de verification… ');
  const r = spawnSync('npx', ['next', 'build'], {
    cwd: racine,
    env: { ...process.env, ...ENV_VERIF },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('\n' + (r.stdout ?? '') + (r.stderr ?? ''));
    throw new Error('la construction a echoue');
  }
  console.log('fait');
}
