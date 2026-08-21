/**
 * Mesures de performance cote serveur, sur le serveur de production local.
 *
 * CE QUI EST MESURE ICI, POUR DE VRAI :
 *   — TTFB par page (mediane et 95e centile sur 30 requetes) ;
 *   — poids reellement transfere, compresse en gzip et en brotli ;
 *   — poids du chemin critique : HTML + CSS bloquant + polices prechargees ;
 *   — JS charge par page ;
 *   — comportement de l'ISR : premiere requete, requetes suivantes ;
 *   — tenue sous charge concurrente.
 *
 * CE QUI NE PEUT PAS ETRE MESURE ICI :
 *   Lighthouse, LCP, CLS et INP. Ces metriques decrivent ce que fait un
 *   navigateur reel en peignant une page reelle. Aucun script Node ne peut
 *   les produire, et les estimer serait pire que ne rien annoncer.
 *   Elles se relevent sur PageSpeed Insights une fois le domaine actif ;
 *   la procedure est dans le dossier de mise en production.
 *
 * Le TTFB mesure ici est celui du RENDU. Il exclut la latence reseau et le
 * demarrage a froid d'une fonction Vercel. Sur suiton.be, le TTFB reel sera
 * ce chiffre + la latence jusqu'au point de presence, soit typiquement
 * 20 a 60 ms depuis la Belgique vers Francfort.
 */
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { demarrer, DSN } from './pgboot.mjs';
import { demarrerShim } from './postgrest-shim.mjs';

const BASE = 'http://127.0.0.1:3999';
const RACINE = new URL('../../', import.meta.url).pathname;

const srv = await demarrer();
const shim = await demarrerShim({ dsn: DSN, port: 54321 });
const next = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3999'], {
  cwd: RACINE,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    SUPABASE_SERVICE_ROLE_KEY: 'service-de-verification-locale-0000000000',
    PORTAL_TOKEN_PEPPER: 'poivre-de-verification-locale-32-octets',
  },
  stdio: ['ignore', 'ignore', 'ignore'],
});
for (let i = 0; i < 60; i += 1) {
  try {
    await fetch(`${BASE}/api/health`);
    break;
  } catch {
    await pause(300);
  }
}

const centile = (xs, p) => {
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor((p / 100) * t.length))];
};
const ko = (n) => (n / 1024).toFixed(1);

const PAGES = [
  ['/', 'Accueil'],
  ['/nettoyage-fin-de-chantier', 'Service principal'],
  ['/nettoyage-fin-de-chantier/enghien', 'Page locale'],
  ['/nettoyage-de-vitres', 'Service secondaire'],
  ['/devis', 'Devis'],
  ['/professionnels', 'Professionnels'],
  ['/reservation', 'Reservation (dynamique)'],
];

// --- 1. TTFB ------------------------------------------------------------
console.log('\n1. TTFB de rendu — 15 requetes par page, apres chauffe');
console.log('─'.repeat(78));
console.log(
  'page'.padEnd(34) +
    'mediane'.padStart(9) +
    'p95'.padStart(8) +
    'min'.padStart(8) +
    'max'.padStart(8) +
    '  HTML gzip',
);

const mesures = {};
for (const [chemin, nom] of PAGES) {
  for (let i = 0; i < 5; i += 1) await fetch(BASE + chemin); // chauffe
  const t = [];
  let taille = 0;
  for (let i = 0; i < 15; i += 1) {
    const t0 = process.hrtime.bigint();
    const r = await fetch(BASE + chemin);
    const corps = await r.arrayBuffer();
    t.push(Number(process.hrtime.bigint() - t0) / 1e6);
    taille = corps.byteLength;
  }
  mesures[chemin] = { nom, med: centile(t, 50), p95: centile(t, 95), taille };
  console.log(
    nom.padEnd(34) +
      `${centile(t, 50).toFixed(1)} ms`.padStart(9) +
      `${centile(t, 95).toFixed(1)}`.padStart(8) +
      `${Math.min(...t).toFixed(1)}`.padStart(8) +
      `${Math.max(...t).toFixed(1)}`.padStart(8) +
      `  ${ko(taille)} ko`,
  );
}

// --- 2. Poids reellement transfere -------------------------------------
console.log('\n2. Poids transfere — page d’accueil, premiere visite');
console.log('─'.repeat(78));
const accueil = Buffer.from(await (await fetch(BASE + '/')).arrayBuffer());
const gzip = gzipSync(accueil, { level: 9 }).length;
const brotli = brotliCompressSync(accueil, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
}).length;

const cssDir = join(RACINE, '.next/static/css');
const css = existsSync(cssDir)
  ? readdirSync(cssDir).reduce((n, f) => n + statSync(join(cssDir, f)).size, 0)
  : 0;
const cssGz = existsSync(cssDir)
  ? readdirSync(cssDir).reduce(
      (n, f) => n + gzipSync(readFileSync(join(cssDir, f)), { level: 9 }).length,
      0,
    )
  : 0;

const html = accueil.toString('utf8');
const scripts = [...html.matchAll(/<script src="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
const jsBrut = scripts.reduce((n, s) => {
  const f = join(RACINE, '.next', s.replace('/_next/', ''));
  return existsSync(f) ? n + statSync(f).size : n;
}, 0);
const jsGz = scripts.reduce((n, s) => {
  const f = join(RACINE, '.next', s.replace('/_next/', ''));
  return existsSync(f) ? n + gzipSync(readFileSync(f), { level: 9 }).length : n;
}, 0);

const polices = [
  ...html.matchAll(/<link rel="preload" href="(\/_next\/static\/media\/[^"]+)"/g),
]
  .map((m) => join(RACINE, '.next', m[1].replace('/_next/', '')))
  .filter(existsSync);
const policesBrut = polices.reduce((n, f) => n + statSync(f).size, 0);

const lignes = [
  ['HTML', accueil.length, gzip, brotli],
  ['CSS bloquant', css, cssGz, null],
  [`JS (${scripts.length} fichiers)`, jsBrut, jsGz, null],
  [`Polices woff2 (${polices.length})`, policesBrut, policesBrut, null],
];
console.log(
  'ressource'.padEnd(26) + 'brut'.padStart(11) + 'gzip'.padStart(11) + 'brotli'.padStart(11),
);
for (const [nom, brut, gz, br] of lignes) {
  console.log(
    nom.padEnd(26) +
      `${ko(brut)} ko`.padStart(11) +
      `${ko(gz)} ko`.padStart(11) +
      (br === null ? '—'.padStart(11) : `${ko(br)} ko`.padStart(11)),
  );
}
const critique = gzip + cssGz + policesBrut;
console.log('─'.repeat(59));
console.log(
  'CHEMIN CRITIQUE'.padEnd(26) +
    `${ko(accueil.length + css + policesBrut)} ko`.padStart(11) +
    `${ko(critique)} ko`.padStart(11),
);
console.log(
  `\n  Le chemin critique est ce qui doit arriver avant le premier rendu :\n` +
    `  HTML + CSS bloquant + polices prechargees. Le JS arrive apres et\n` +
    `  n'entre pas dans le LCP d'une page dont le plus grand element est\n` +
    `  un bloc de texte.`,
);

// --- 3. ISR -------------------------------------------------------------
console.log('\n3. Regeneration incrementale');
console.log('─'.repeat(78));
for (const chemin of ['/', '/nettoyage-fin-de-chantier/enghien']) {
  const r = await fetch(BASE + chemin);
  const cache = r.headers.get('x-nextjs-cache') ?? r.headers.get('cache-control') ?? '—';
  console.log(`  ${chemin.padEnd(38)} ${cache}`);
}

// --- 4. Charge concurrente ---------------------------------------------
console.log('\n4. Tenue sous charge — 100 requetes, 20 en parallele');
console.log('─'.repeat(78));
for (const [chemin, nom] of [
  ['/', 'Accueil (statique)'],
  ['/reservation', 'Reservation (dynamique)'],
]) {
  const t0 = Date.now();
  const durees = [];
  let erreurs = 0;
  for (let lot = 0; lot < 5; lot += 1) {
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        const a = process.hrtime.bigint();
        try {
          const r = await fetch(BASE + chemin);
          await r.arrayBuffer();
          if (!r.ok) erreurs += 1;
        } catch {
          erreurs += 1;
        }
        durees.push(Number(process.hrtime.bigint() - a) / 1e6);
      }),
    );
  }
  const total = (Date.now() - t0) / 1000;
  console.log(
    `  ${nom.padEnd(26)} ${(100 / total).toFixed(0).padStart(4)} req/s  ` +
      `mediane ${centile(durees, 50).toFixed(1)} ms  p95 ${centile(durees, 95).toFixed(1)} ms  ` +
      `${erreurs} erreur(s)`,
  );
}

// --- 5. API -------------------------------------------------------------
console.log('\n5. Routes API');
console.log('─'.repeat(78));
for (const chemin of ['/api/health', '/api/slots?surface_m2=140&soil=standard&jours=21']) {
  const t = [];
  for (let i = 0; i < 12; i += 1) {
    const a = process.hrtime.bigint();
    const r = await fetch(BASE + chemin);
    await r.text();
    t.push(Number(process.hrtime.bigint() - a) / 1e6);
  }
  console.log(
    `  ${chemin.slice(0, 44).padEnd(46)} mediane ${centile(t, 50).toFixed(1)} ms  p95 ${centile(t, 95).toFixed(1)} ms`,
  );
}

next.kill('SIGTERM');
await shim.arreter();
await srv.stop();
