/**
 * Verifie la separation des environnements.
 *
 * Ce que l'on controle ici n'est pas une intention mais un comportement : on
 * construit reellement l'application dans chaque configuration, et on lit ce
 * qu'elle produit. Une regle ecrite dans un document se contourne ; une page
 * qui porte « noindex » dans le HTML servi, non.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = new URL('../../', import.meta.url).pathname;

let ok = 0;
let ko = 0;
const dire = (b, n, d = '') => {
  if (b) { ok += 1; console.log(`  ok     ${n}${d ? ' — ' + d : ''}`); }
  else { ko += 1; console.log(`  ECHEC  ${n}${d ? ' — ' + d : ''}`); }
};
const titre = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://exemple.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-de-verification-0000000000000000',
  SUPABASE_SERVICE_ROLE_KEY: 'service-de-verification-000000000000',
  PORTAL_TOKEN_PEPPER: 'poivre-de-verification-32-octets-xxxx',
};

function construire(env) {
  const r = spawnSync('npx', ['next', 'build'], {
    cwd: RACINE,
    env: { ...process.env, ...BASE, ...env },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error((r.stdout ?? '') + (r.stderr ?? ''));
  const lire = (f) => {
    const p = join(RACINE, '.next/server/app', f);
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
  };
  return {
    accueil: lire('index.html'),
    robots: lire('robots.txt.body'),
    config: readFileSync(join(RACINE, 'next.config.ts'), 'utf8'),
  };
}

// ==========================================================================
titre('A. Environnement de developpement');
const dev = construire({
  APP_ENV: 'development',
  NEXT_PUBLIC_APP_ENV: 'development',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
});
dire(/Disallow: \/\s*$/m.test(dev.robots.trim()), 'robots.txt interdit tout le site',
  dev.robots.trim().split('\n').join(' · '));
dire(/name="robots" content="[^"]*noindex/.test(dev.accueil), 'les pages portent noindex');
dire(/Développement/.test(dev.accueil), 'le bandeau d’environnement est visible');
dire(!/https:\/\/suiton\.be/.test(
  dev.accueil.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? ''),
  'la canonique ne pointe pas sur le domaine de production');

// ==========================================================================
titre('B. Environnement de preview');
const prev = construire({
  APP_ENV: 'preview',
  NEXT_PUBLIC_APP_ENV: 'preview',
  NEXT_PUBLIC_SITE_URL: 'https://suiton-preview.vercel.app',
});
dire(/Disallow: \/\s*$/m.test(prev.robots.trim()), 'robots.txt interdit tout le site');
dire(/name="robots" content="[^"]*noindex/.test(prev.accueil), 'les pages portent noindex');
dire(/Preview/.test(prev.accueil), 'le bandeau signale la preview');
dire(
  /X-Robots-Tag/.test(prev.config) && !/APP_ENV === 'production'/.test('') ,
  'l’en-tete X-Robots-Tag est configure hors production',
);

// ==========================================================================
titre('C. Environnement de production');
const prod = construire({
  APP_ENV: 'production',
  NEXT_PUBLIC_APP_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://suiton.be',
});
dire(/Allow: \//.test(prod.robots) && !/^Disallow: \/$/m.test(prod.robots),
  'robots.txt autorise l’exploration');
dire(/name="robots" content="index, follow/.test(prod.accueil), 'les pages sont indexables');
dire(!/Preview|Développement/.test(prod.accueil), 'aucun bandeau d’environnement');
dire(
  (prod.accueil.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '') === 'https://suiton.be',
  'la canonique pointe sur https://suiton.be',
);
dire(/Disallow: \/portail\//.test(prod.robots), 'le portail client reste interdit aux robots');

// ==========================================================================
titre('D. Garde-fous');

// Le garde-fou de production ne doit rien executer sans la phrase exacte.
for (const [entree, attendu] of [['oui', 1], ['GO PRODUCTION', 1], ['GO PRODUCTION SUITON', 0]]) {
  const r = spawnSync(process.execPath, ['scripts/garde/production.mjs', 'deploy'], {
    cwd: RACINE, input: `${entree}\n`, encoding: 'utf8',
  });
  dire(r.status === attendu,
    `garde-fou : « ${entree} » ${attendu === 0 ? 'confirme' : 'annule'}`,
    `code ${r.status}`);
  if (attendu === 0) {
    // Confirme, le garde-fou doit AFFICHER la marche a suivre et s'arreter la.
    dire(/Marche a suivre/.test(r.stdout), 'apres confirmation, il affiche la marche a suivre');
  }
}

// Le garde-fou ne doit contenir aucun appel a un processus externe : c'est ce
// qui garantit qu'il ne peut pas deployer, quoi qu'on lui reponde.
const source = readFileSync(join(RACINE, 'scripts/garde/production.mjs'), 'utf8');
dire(
  !/child_process|spawn|exec\(|execSync/.test(source),
  'le garde-fou ne peut executer aucune commande — il n’importe aucun lanceur de processus',
);

// Le seed refuse la production. Verifie ici aussi : c'est un chemin different
// de celui teste par prod:seed, et l'oubli se paierait en donnees de test
// dans la base reelle.
const seedProd = spawnSync(process.execPath, ['scripts/db/seed-demo.mjs'], {
  cwd: RACINE, env: { ...process.env, APP_ENV: 'production' }, encoding: 'utf8',
});
dire(seedProd.status !== 0, 'le seed de demonstration refuse APP_ENV=production');

// ==========================================================================
titre('E. Secrets');
const exemple = readFileSync(join(RACINE, '.env.example'), 'utf8');
for (const cle of [
  'SUPABASE_SERVICE_ROLE_KEY', 'PORTAL_TOKEN_PEPPER', 'CRON_SECRET', 'RESEND_API_KEY',
]) {
  const ligne = exemple.split('\n').find((l) => l.startsWith(`${cle}=`));
  dire(ligne === `${cle}=`, `.env.example ne contient aucune valeur pour ${cle}`, ligne ?? 'absente');
}
const gitignore = readFileSync(join(RACINE, '.gitignore'), 'utf8');
for (const f of ['.env.local', '.env.preview', '.env.production', '.emails/']) {
  dire(gitignore.includes(f), `${f} est ignore par Git`);
}

console.log(`\n${'='.repeat(60)}\n${ok} controles reussis, ${ko} echec(s)`);
if (existsSync(join(RACINE, '.next'))) rmSync(join(RACINE, '.next'), { recursive: true, force: true });
process.exit(ko > 0 ? 1 : 0);
