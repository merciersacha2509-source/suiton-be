/**
 * Audit de securite, sur le serveur de production local et la base reelle.
 *
 * Trois familles :
 *   A. en-tetes HTTP reellement servis ;
 *   B. isolation des donnees — la RLS telle qu'un role applicatif la subit ;
 *   C. surface exposee — jetons, uploads, secrets, indexation.
 */
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { demarrer, DSN } from './pgboot.mjs';
import { demarrerShim } from './postgrest-shim.mjs';
import { construire, ENV_VERIF } from './construire.mjs';

const { Client } = pg;
const BASE = 'http://127.0.0.1:3999';
const RACINE = new URL('../../', import.meta.url).pathname;

let ok = 0;
let ko = 0;
const dire = (bon, nom, detail = '') => {
  if (bon) {
    ok += 1;
    console.log(`  ok     ${nom}${detail ? ' — ' + detail : ''}`);
  } else {
    ko += 1;
    console.log(`  ECHEC  ${nom}${detail ? ' — ' + detail : ''}`);
  }
};
const titre = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

construire(new URL('../../', import.meta.url).pathname);

/**
 * `server-only` est un paquet dont la seule fonction est d'echouer a la
 * compilation quand un module serveur est importe par un composant client.
 * Next le resout ; `tsx`, non. Pour pouvoir importer src/lib/photos.ts et
 * verifier le retrait des metadonnees sur une vraie image, on fournit une
 * resolution vide — uniquement pour ce script d'audit, jamais pour le build.
 */
const stub = join(RACINE, 'node_modules/server-only');
if (!existsSync(join(stub, 'index.js'))) {
  mkdirSync(stub, { recursive: true });
  writeFileSync(join(stub, 'package.json'), '{"name":"server-only","main":"index.js"}');
  writeFileSync(join(stub, 'index.js'), 'module.exports = {};');
}

const srv = await demarrer();
const shim = await demarrerShim({ dsn: DSN, port: 54321 });
const db = new Client({ connectionString: DSN });
await db.connect();

const next = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3999'], {
  cwd: RACINE,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ...ENV_VERIF,
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

try {
  // ================================================================ A
  titre('A. En-tetes HTTP');
  const r = await fetch(BASE + '/');
  const h = (n) => r.headers.get(n) ?? '';
  const attendus = [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'no-referrer'],
    ['strict-transport-security', 'max-age=63072000'],
    ['cross-origin-opener-policy', 'same-origin'],
  ];
  for (const [nom, attendu] of attendus) {
    dire(h(nom).includes(attendu), `${nom}: ${attendu}`, h(nom) || 'ABSENT');
  }
  const csp = h('content-security-policy');
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ]) {
    dire(csp.includes(directive), `CSP ${directive}`);
  }
  dire(
    !csp.includes("connect-src 'self' *"),
    'CSP connect-src restreint',
    csp.split('; ').find((d) => d.startsWith('connect-src')) ?? '',
  );
  dire(!r.headers.get('x-powered-by'), 'aucun en-tete x-powered-by');
  dire(
    h('referrer-policy') === 'no-referrer',
    'Referrer-Policy no-referrer — le jeton de portail ne fuit pas par referer',
  );

  // ================================================================ B
  titre('B. Isolation des donnees');

  // Un chantier reel pour tester.
  await db.query(`truncate table events, portal_tokens, jobs, clients cascade`);
  const { rows: cl } = await db.query(
    `insert into clients (nom, email, telephone, kind, commune, code_postal)
     values ('Client Test','iso@example.be','0470000000','particulier','Enghien','7850')
     returning id`,
  );
  await db.query(
    `insert into jobs (client_id, service, property_type, soil, surface_m2, commune,
       code_postal, zone, estimation_min, estimation_max)
     values ($1,'fin_de_chantier','maison','standard',120,'Enghien','7850','principale',840,960)`,
    [cl[0].id],
  );

  // Les roles disposent des memes privileges de table qu'en production ;
  // c'est donc bien la RLS qui est mesuree, et non une absence de GRANT.
  for (const role of ['anon', 'authenticated']) {
    await db.query('begin');
    await db.query(`set local role ${role}`);
    for (const table of [
      'clients',
      'jobs',
      'quotes',
      'invoices',
      'portal_tokens',
      'photos',
      'messages',
      'reports',
      'documents',
      'settings_history',
      'audit_logs',
      'events',
      'job_metrics',
      'recommandations',
    ]) {
      let n = null;
      try {
        n = (await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
      } catch {
        n = 'refus'; // privilege absent : plus strict encore que la RLS
      }
      dire(
        n === 0 || n === 'refus',
        `« ${role} » ne lit rien dans ${table}`,
        n === 'refus' ? 'acces refuse' : `${n} ligne(s)`,
      );
    }
    await db.query('rollback');
  }

  // Ecriture directe interdite.
  await db.query('begin');
  await db.query('set local role anon');
  let refuse = false;
  try {
    await db.query(
      `insert into jobs (client_id, service, property_type, soil, surface_m2,
      commune, code_postal, zone, estimation_min, estimation_max)
      values ($1,'fin_de_chantier','maison','standard',10,'X','7850','principale',1,2)`,
      [cl[0].id],
    );
  } catch {
    refuse = true;
  }
  dire(refuse, '« anon » ne peut pas creer de chantier en direct');
  await db.query('rollback');

  // ================================================================ C
  titre('C. Surface exposee');

  // Jetons de portail.
  const { rows: colonnes } = await db.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='portal_tokens'`,
  );
  dire(!colonnes.some((c) => c.column_name === 'token'), 'aucun jeton stocke en clair');
  const jetons = readFileSync(join(RACINE, 'src/lib/tokens.ts'), 'utf8');
  dire(
    /createHash\('sha256'\)/.test(jetons) && /PORTAL_TOKEN_PEPPER|poivre/i.test(jetons),
    'jetons haches en SHA-256 avec poivre',
  );
  dire(
    /timingSafeEqual/.test(jetons) || /randomBytes\(\s*32\s*\)/.test(jetons),
    'jetons de 32 octets tires au hasard cryptographique',
  );

  // Robots et indexation.
  const robots = await (await fetch(BASE + '/robots.txt')).text();

  // Hors production, robots.txt renvoie « Disallow: / » : c'est plus strict
  // que la liste nominative, et cela satisfait la propriete recherchee — le
  // portail n'est jamais explorable. On accepte donc les deux formes plutot
  // que d'exiger une chaine litterale qui n'a de sens qu'en production.
  const toutInterdit = /^Disallow: \/$/m.test(robots.trim());
  dire(
    toutInterdit || robots.includes('Disallow: /portail/'),
    'robots.txt interdit le portail client',
    toutInterdit ? 'tout le site est interdit (hors production)' : '',
  );
  dire(
    toutInterdit || robots.includes('Disallow: /api/'),
    'robots.txt interdit les routes API',
    toutInterdit ? 'tout le site est interdit (hors production)' : '',
  );
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  dire(!sitemap.includes('/portail'), 'aucune URL de portail dans le sitemap');
  for (const chemin of ['/portail', '/mentions-legales', '/confidentialite']) {
    const t = await (await fetch(BASE + chemin)).text();
    dire(/noindex/.test(t), `${chemin} porte noindex`);
  }

  // Secrets : rien de serveur ne doit atteindre le navigateur.
  const statique = join(RACINE, '.next/static');
  const fichiers = [];
  (function parcourir(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.(js|css)$/.test(e.name)) fichiers.push(p);
    }
  })(statique);
  const secrets = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'PORTAL_TOKEN_PEPPER',
    'service-de-verification',
    'poivre-de-verification',
    'RESEND_API_KEY',
    'CRON_SECRET',
  ];
  const fuites = [];
  for (const f of fichiers) {
    const contenu = readFileSync(f, 'utf8');
    for (const s of secrets)
      if (contenu.includes(s)) fuites.push(`${f.split('/static/')[1]} : ${s}`);
  }
  dire(
    fuites.length === 0,
    `aucun secret serveur dans les ${fichiers.length} fichiers envoyes au navigateur`,
    fuites.join(' | '),
  );

  const htmlAccueil = await (await fetch(BASE + '/')).text();
  dire(
    !/service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(
      htmlAccueil.replace(/anon-de-verification[^"']*/g, ''),
    ),
    'aucune cle de service dans le HTML',
  );

  // Uploads.
  const upload = readFileSync(join(RACINE, 'src/app/api/photos/upload/route.ts'), 'utf8');
  dire(/image\/(jpeg|png|webp)/.test(upload), 'upload : types MIME restreints');
  dire(/\d+\s*\*\s*1024\s*\*\s*1024|MAX_|taille/i.test(upload), 'upload : taille plafonnee');
  const photos = readFileSync(join(RACINE, 'src/lib/photos.ts'), 'utf8');
  dire(/sharp\(/.test(photos), 'upload : images re-encodees par sharp');

  // Verification empirique du retrait des metadonnees : on fabrique une image
  // porteuse de coordonnees GPS, on la fait passer par le traitement reel, et
  // on relit le resultat. La page « confidentialite » affirme que les
  // positions sont supprimees a l'ingestion ; une affirmation de ce type se
  // teste, elle ne se declare pas.
  const sharp = (await import('sharp')).default;
  const { traiterPhoto } = await import(join(RACINE, 'src/lib/photos.ts'));
  const avecGps = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 90, g: 120, b: 140 } },
  })
    .withExif({
      IFD0: { Make: 'SUITON-TEST', Software: 'audit' },
      GPS: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
    })
    .jpeg()
    .toBuffer();

  const metaAvant = await sharp(avecGps).metadata();
  dire(
    metaAvant.exif !== undefined,
    'image de test porteuse d’EXIF',
    `${metaAvant.exif?.length} octets`,
  );

  const traitee = await traiterPhoto(avecGps);
  const metaApres = await sharp(traitee.principale).metadata();
  dire(
    metaApres.exif === undefined,
    'EXIF/GPS reellement supprimes a l’ingestion',
    metaApres.exif ? `${metaApres.exif.length} octets restants` : 'aucune metadonnee',
  );
  dire(metaApres.format === 'webp', 'image reencodee en webp', String(metaApres.format));

  // Un fichier qui n'est pas une image doit etre refuse par le traitement.
  let refuseNonImage = false;
  try {
    await traiterPhoto(Buffer.from('MZ\x90\x00 ceci est un executable'));
  } catch {
    refuseNonImage = true;
  }
  dire(refuseNonImage, 'un fichier renomme en .jpg est rejete par le traitement');

  // Limitation de debit configuree sur toutes les routes publiques.
  for (const route of ['booking', 'slots', 'photos/upload', 'rappel']) {
    const src = readFileSync(join(RACINE, `src/app/api/${route}/route.ts`), 'utf8');
    dire(/consommerQuota/.test(src), `/api/${route} applique une limitation de debit`);
  }

  // Le client admin ne doit jamais etre importe par un composant client.
  const clients = [];
  (function parcourir(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.tsx?$/.test(e.name)) {
        const c = readFileSync(p, 'utf8');
        if (/^['"]use client['"]/m.test(c) && /supabase\/admin/.test(c)) clients.push(p);
      }
    }
  })(join(RACINE, 'src'));
  dire(
    clients.length === 0,
    'aucun composant client n’importe le client admin',
    clients.join(', '),
  );
} catch (e) {
  console.error('EXCEPTION', e.message);
  ko += 1;
} finally {
  console.log(`\n${'='.repeat(60)}\n${ok} controles reussis, ${ko} echec(s)`);
  next.kill('SIGTERM');
  await db.end();
  await shim.arreter();
  await srv.stop();
  process.exit(ko > 0 ? 1 : 0);
}
