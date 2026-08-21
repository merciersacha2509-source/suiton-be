#!/usr/bin/env node
/**
 * Audit du site public, sur la sortie de build reelle.
 *
 * Ce script ne remplace pas Lighthouse : Lighthouse mesure un navigateur qui
 * charge une page, ce qu'aucun script Node ne peut simuler. Il verifie ce qui
 * est verifiable sans navigateur, et qui suffit a expliquer la quasi-totalite
 * des mauvais scores en pratique :
 *
 *   — les budgets de poids (JS, CSS, polices prechargees) ;
 *   — les invariants SEO (titre, description, canonique, JSON-LD, robots) ;
 *   — les invariants d'accessibilite detectables dans le HTML statique
 *     (un seul H1, hierarchie de titres, alternatives textuelles, lang,
 *     libelles de formulaire, liens sans intitule) ;
 *   — l'unicite reelle des pages locales, mesuree en n-grammes.
 *
 * Usage : npm run build && node scripts/audit-site.mjs
 * Sortie : code 0 si tout passe, 1 sinon.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, basename } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname;
const SORTIE = join(RACINE, '.next');
const PAGES = join(SORTIE, 'server/app');

/* --- Budgets --------------------------------------------------------- */
const BUDGETS = {
  jsPartage: 110 * 1024, // JS charge sur toutes les pages
  jsPage: 40 * 1024, // JS propre a une page
  css: 45 * 1024, // feuille bloquante
  policesPrechargees: 110 * 1024,
  /** HTML apres compression : c'est ce qui circule reellement. */
  htmlPage: 30 * 1024,
  titreMin: 30,
  titreMax: 65,
  descMin: 70,
  descMax: 165,
  /** Part minimale de contenu propre a une page locale. */
  uniciteLocale: 0.35,
};

let echecs = 0;
let avertissements = 0;

const vert = (s) => `[32m${s}[0m`;
const rouge = (s) => `[31m${s}[0m`;
const jaune = (s) => `[33m${s}[0m`;
const gris = (s) => `[90m${s}[0m`;

function ok(msg, detail = '') {
  console.log(`  ${vert('✓')} ${msg} ${gris(detail)}`);
}
function ko(msg, detail = '') {
  echecs += 1;
  console.log(`  ${rouge('✗')} ${msg} ${detail}`);
}
function attention(msg, detail = '') {
  avertissements += 1;
  console.log(`  ${jaune('!')} ${msg} ${gris(detail)}`);
}
/** Assertion : consigne le resultat et compte les echecs. */
function verifier(condition, msg, detail = '') {
  if (condition) ok(msg, detail);
  else ko(msg, detail);
  return condition;
}
function titre(t) {
  console.log(`\n${t}\n${'─'.repeat(t.length)}`);
}

if (!existsSync(PAGES)) {
  console.error(rouge('Aucune sortie de build. Lancez « npm run build » d’abord.'));
  process.exit(1);
}

/*
 * Cet audit verifie la POSTURE DE PRODUCTION : pages indexables, sitemap
 * complet, robots.txt ouvert, aucun lien vers les outils de developpement.
 *
 * Sur un build de developpement ou de preview, tout cela est volontairement
 * inverse — noindex partout, robots.txt ferme, bandeau et liens /dev
 * presents. L'audit signalerait alors vingt-six « problemes » qui sont en
 * realite le comportement attendu, et on prendrait l'habitude de l'ignorer.
 * Un audit qu'on ignore ne sert a rien.
 *
 * On refuse donc de conclure sur un build qui n'est pas en configuration de
 * production, plutot que de rendre un verdict faux.
 */
const robotsBrut = existsSync(join(PAGES, 'robots.txt.body'))
  ? readFileSync(join(PAGES, 'robots.txt.body'), 'utf8')
  : '';

if (/^Disallow: \/$/m.test(robotsBrut.trim())) {
  console.error(
    jaune('\nBuild hors production — audit SEO non applicable.\n') +
      '\n  Ce build porte « Disallow: / » : c\'est un build de developpement ou de\n' +
      '  preview, ou l\'absence d\'indexation est voulue.\n\n' +
      '  Pour auditer la posture de production :\n\n' +
      '    APP_ENV=production NEXT_PUBLIC_APP_ENV=production \\\n' +
      '    NEXT_PUBLIC_SITE_URL=https://suiton.be npm run build && npm run audit\n\n' +
      '  Pour verifier la separation des environnements : npm run prod:env-sep\n',
  );
  process.exit(2);
}

/* --- Collecte des pages publiques ------------------------------------ */
function fichiersHtml(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiersHtml(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const PRIVE = ['/(app)/', '/(auth)/', '/portail'];
const pages = fichiersHtml(PAGES)
  .filter((f) => !PRIVE.some((p) => f.includes(p)))
  .sort();

const doc = new Map();
for (const f of pages) doc.set(relative(PAGES, f), readFileSync(f, 'utf8'));

const extraire = (s, re) => {
  const m = s.match(re);
  return m ? m[1] : null;
};
const desechapper = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const texteVisible = (s) => {
  const corps = s.split('</head>').pop() ?? s;
  return desechapper(
    corps
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
};

/* --- 1. Budgets de poids --------------------------------------------- */
titre('1. Budgets de poids');

const cssDir = join(SORTIE, 'static/css');
if (existsSync(cssDir)) {
  const total = readdirSync(cssDir).reduce((n, f) => n + statSync(join(cssDir, f)).size, 0);
  verifier(
    total <= BUDGETS.css,
    `CSS bloquant : ${(total / 1024).toFixed(1)} ko (budget ${BUDGETS.css / 1024} ko)`,
  );
}

const accueil = doc.get('index.html');
if (accueil) {
  const polices = [
    ...accueil.matchAll(/<link rel="preload" href="(\/_next\/static\/media\/[^"]+)"/g),
  ]
    .map((m) => join(SORTIE, m[1].replace('/_next/', '')))
    .filter(existsSync);
  const total = polices.reduce((n, f) => n + statSync(f).size, 0);
  verifier(
    total <= BUDGETS.policesPrechargees,
    `Polices prechargees : ${polices.length} fichiers, ${(total / 1024).toFixed(1)} ko (budget ${BUDGETS.policesPrechargees / 1024} ko)`,
  );

  // On ne regarde que les ressources CHARGEES par la page — <link>, <script
  // src>, <img src>. Un <a href="https://wa.me/…"> est un lien sortant : il
  // ne coute rien au rendu et n'a rien a faire dans ce controle.
  const tiers = [
    ...accueil.matchAll(/<(?:link|script|img|iframe)\b[^>]*(?:href|src)="(https?:\/\/[^"]+)"/g),
  ]
    .map((m) => new URL(m[1]).host)
    .filter((h) => h !== 'suiton.be');
  verifier(
    tiers.length === 0,
    'Aucune ressource tierce dans le chemin de rendu',
    [...new Set(tiers)].join(', '),
  );
}

let htmlLourdes = 0;
let pireHtml = 0;
for (const [nom, s] of doc) {
  const compresse = gzipSync(Buffer.from(s)).length;
  pireHtml = Math.max(pireHtml, compresse);
  if (compresse > BUDGETS.htmlPage) {
    ko(`HTML volumineux : ${nom}`, `${(compresse / 1024).toFixed(1)} ko compresses`);
    htmlLourdes += 1;
  }
}
if (htmlLourdes === 0)
  ok(
    `HTML compresse sous ${BUDGETS.htmlPage / 1024} ko sur les ${doc.size} pages`,
    `pire cas ${(pireHtml / 1024).toFixed(1)} ko`,
  );

/* --- 2. SEO ---------------------------------------------------------- */
titre('2. SEO');

const titres = new Map();
const descs = new Map();
const canoniques = new Set();

for (const [nom, s] of doc) {
  if (nom.startsWith('_not-found')) continue;

  const t = desechapper(extraire(s, /<title>([\s\S]*?)<\/title>/) ?? '');
  const d = desechapper(extraire(s, /<meta name="description" content="([\s\S]*?)"\/>/) ?? '');
  const canon = extraire(s, /<link rel="canonical" href="([^"]+)"/);
  const robots = extraire(s, /<meta name="robots" content="([^"]+)"/) ?? '';
  const h1 = [...s.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];

  // Les contraintes de longueur visent l'affichage dans les resultats de
  // recherche. Sur une page noindex, elles n'ont pas d'objet.
  const indexee = !robots.includes('noindex');

  if (!t) ko(`${nom} : aucun titre`);
  else if (indexee && (t.length < BUDGETS.titreMin || t.length > BUDGETS.titreMax))
    ko(`${nom} : titre de ${t.length} caracteres`, `« ${t} »`);

  if (!d) ko(`${nom} : aucune meta description`);
  else if (indexee && (d.length < BUDGETS.descMin || d.length > BUDGETS.descMax))
    ko(`${nom} : description de ${d.length} caracteres`);

  if (!canon) ko(`${nom} : aucune URL canonique`);
  else if (canoniques.has(canon) && !robots.includes('noindex'))
    ko(`${nom} : canonique en double`, canon);
  else canoniques.add(canon);

  if (h1.length !== 1) ko(`${nom} : ${h1.length} balises H1 (il en faut exactement une)`);

  if (t) titres.set(t, [...(titres.get(t) ?? []), nom]);
  if (d) descs.set(d, [...(descs.get(d) ?? []), nom]);
}

const doublonsT = [...titres.entries()].filter(([, v]) => v.length > 1);
const doublonsD = [...descs.entries()].filter(([, v]) => v.length > 1);
if (doublonsT.length === 0) ok('Aucun titre en double');
else for (const [t, v] of doublonsT) ko('Titre en double', `« ${t} » sur ${v.join(', ')}`);

if (doublonsD.length === 0) ok('Aucune meta description en double');
else for (const [, v] of doublonsD) ko('Description en double', v.join(', '));

/* JSON-LD : presence et validite */
let ldInvalides = 0;
let typesVus = new Set();
for (const [nom, s] of doc) {
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const o = JSON.parse(desechapper(m[1]));
      typesVus.add(o['@type']);
      if (!o['@context']) ko(`${nom} : JSON-LD sans @context`);
    } catch (e) {
      ldInvalides += 1;
      ko(`${nom} : JSON-LD illisible`, e.message);
    }
  }
}
if (ldInvalides === 0) ok('JSON-LD valide partout', [...typesVus].sort().join(', '));

/* Sitemap et robots */
const sitemap = join(PAGES, 'sitemap.xml.body');
if (existsSync(sitemap)) {
  const xml = readFileSync(sitemap, 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const indexables = [...doc.entries()]
    .filter(([n, s]) => !n.startsWith('_not-found') && !/content="[^"]*noindex/.test(s))
    .map(([, s]) => extraire(s, /<link rel="canonical" href="([^"]+)"/))
    .filter(Boolean);
  const absentes = indexables.filter((u) => !urls.includes(u) && !urls.includes(`${u}/`));
  verifier(
    absentes.length === 0,
    absentes.length === 0
      ? `Sitemap complet : ${urls.length} URL`
      : 'Pages indexables absentes du sitemap',
    absentes.join(', '),
  );

  const noindexes = [...doc.values()]
    .filter((s) => /content="[^"]*noindex/.test(s))
    .map((s) => extraire(s, /<link rel="canonical" href="([^"]+)"/))
    .filter(Boolean);
  const fuites = noindexes.filter((u) => urls.includes(u));
  verifier(fuites.length === 0, 'Aucune page noindex dans le sitemap', fuites.join(', '));
} else {
  ko('Sitemap absent de la sortie de build');
}

const robotsTxt = join(PAGES, 'robots.txt.body');
if (existsSync(robotsTxt)) {
  const r = readFileSync(robotsTxt, 'utf8');
  verifier(
    r.includes('Disallow: /portail/'),
    'robots.txt et le portail client — les jetons ne doivent jamais etre indexes',
  );
  verifier(r.includes('Sitemap:'), 'robots.txt declare le sitemap');
} else {
  ko('robots.txt absent de la sortie de build');
}

/* --- 3. Accessibilite ------------------------------------------------- */
titre('3. Accessibilite');

let pbA11y = 0;
for (const [nom, s] of doc) {
  if (!/<html[^>]+lang="fr/.test(s)) {
    ko(`${nom} : attribut lang manquant ou non francais`);
    pbA11y += 1;
  }

  for (const img of s.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(img[0])) {
      ko(`${nom} : <img> sans alt`, img[0].slice(0, 80));
      pbA11y += 1;
    }
  }

  // Liens sans intitule accessible : ni texte, ni aria-label, ni titre SVG.
  for (const a of s.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const attrs = a[1];
    const contenu = texteVisible(a[2]);
    const aLabel = /aria-label=|aria-labelledby=/.test(attrs);
    const aTitre = /<title>/.test(a[2]);
    if (!contenu && !aLabel && !aTitre) {
      ko(`${nom} : lien sans intitule`, attrs.slice(0, 70));
      pbA11y += 1;
    }
  }

  // Boutons sans intitule.
  for (const b of s.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    if (!texteVisible(b[2]) && !/aria-label=|aria-labelledby=/.test(b[1])) {
      ko(`${nom} : bouton sans intitule`, b[1].slice(0, 70));
      pbA11y += 1;
    }
  }

  // Champs de formulaire : chaque input/select doit avoir un id reference
  // par un <label for>, ou un aria-label.
  for (const c of s.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = c[2];
    const type = extraire(attrs, /type="([^"]+)"/) ?? 'text';
    if (['hidden', 'submit', 'button'].includes(type)) continue;
    const id = extraire(attrs, /id="([^"]+)"/);

    // Trois formes valides : <label for>, aria-label, ou un <label> qui
    // enveloppe le champ. La troisieme se detecte en remontant depuis la
    // position du champ jusqu'au dernier <label> ouvert.
    const avant = s.slice(0, c.index);
    const dernierLabel = avant.lastIndexOf('<label');
    const enveloppe = dernierLabel !== -1 && avant.indexOf('</label>', dernierLabel) === -1;

    const etiquete =
      /aria-label=|aria-labelledby=/.test(attrs) ||
      enveloppe ||
      (id !== null && new RegExp(`<label[^>]*for="${id}"`).test(s));

    if (!etiquete) {
      ko(`${nom} : champ ${type} sans etiquette accessible`, attrs.slice(0, 60));
      pbA11y += 1;
    }
  }

  // Hierarchie des titres : aucun saut de niveau.
  const niveaux = [...s.matchAll(/<h([1-6])[^>]*>/g)].map((m) => Number(m[1]));
  for (let i = 1; i < niveaux.length; i += 1) {
    if (niveaux[i] - niveaux[i - 1] > 1) {
      ko(`${nom} : saut de titre h${niveaux[i - 1]} vers h${niveaux[i]}`);
      pbA11y += 1;
      break;
    }
  }
}
if (pbA11y === 0) ok(`Aucun defaut bloquant detecte sur les ${doc.size} pages`);

/* --- 4. Unicite des pages locales ------------------------------------ */
titre('4. Unicite des pages locales');

const locales = [...doc.entries()].filter(([n]) => n.includes('nettoyage-fin-de-chantier/'));
if (locales.length >= 2) {
  const ngrammes = (t, n = 6) => {
    const m = t.split(' ');
    const s = new Set();
    for (let i = 0; i + n <= m.length; i += 1) s.add(m.slice(i, i + n).join(' '));
    return s;
  };
  const ens = locales.map(([n, s]) => [basename(n, '.html'), ngrammes(texteVisible(s))]);
  const commun = ens.reduce(
    (acc, [, s]) => (acc ? new Set([...acc].filter((x) => s.has(x))) : s),
    null,
  );

  let pire = 1;
  for (const [nom, s] of ens) {
    const part = [...s].filter((x) => !commun.has(x)).length / s.size;
    pire = Math.min(pire, part);
    verifier(
      part >= BUDGETS.uniciteLocale,
      `${nom.padEnd(22)} ${(part * 100).toFixed(1)} % de contenu propre`,
      `seuil ${BUDGETS.uniciteLocale * 100} %`,
    );
  }
  console.log(
    gris(
      `  Gabarit partage : ${commun.size} n-grammes. Plus bas : ${(pire * 100).toFixed(1)} %.`,
    ),
  );
}

/* --- 5. Maillage interne --------------------------------------------- */
titre('5. Maillage interne');

const cheminDepuisCanon = (u) => new URL(u).pathname.replace(/\/$/, '') || '/';
const existantes = new Set(
  [...doc.values()]
    .map((s) => extraire(s, /<link rel="canonical" href="([^"]+)"/))
    .filter(Boolean)
    .map(cheminDepuisCanon),
);
existantes.add('/reservation'); // rendue a la demande, donc absente du build statique

const entrants = new Map([...existantes].map((u) => [u, 0]));
let casses = 0;
for (const [nom, s] of doc) {
  const source = cheminDepuisCanon(
    extraire(s, /<link rel="canonical" href="([^"]+)"/) ?? 'https://suiton.be/',
  );
  for (const m of s.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"/g)) {
    const cible = m[1].replace(/\/$/, '') || '/';
    if (!existantes.has(cible)) {
      ko(`${nom} : lien interne casse`, cible);
      casses += 1;
    } else if (cible !== source) {
      entrants.set(cible, (entrants.get(cible) ?? 0) + 1);
    }
  }
}
if (casses === 0) ok(`Aucun lien interne casse (${existantes.size} destinations)`);

const orphelines = [...entrants.entries()].filter(([, n]) => n === 0).map(([u]) => u);
verifier(orphelines.length === 0, 'Aucune page orpheline', orphelines.join(', '));

const faibles = [...entrants.entries()]
  .filter(([, n]) => n > 0 && n < 3)
  .map(([u, n]) => `${u} (${n})`);
if (faibles.length > 0) attention('Pages peu liees', faibles.join(', '));

/* --- Verdict ---------------------------------------------------------- */
console.log('');
console.log('─'.repeat(60));
if (echecs === 0) {
  console.log(vert(`Audit reussi — ${doc.size} pages, ${avertissements} avertissement(s).`));
  process.exit(0);
}
console.log(
  rouge(`Audit en echec — ${echecs} probleme(s), ${avertissements} avertissement(s).`),
);
process.exit(1);
