/**
 * Verifie le jeu de demonstration sur une base reelle.
 *
 * Ce que l'on controle n'est pas « le seed s'execute » mais « le seed produit
 * des donnees impossibles a confondre avec de vrais clients, et il est
 * rejouable ».
 */
import { spawnSync } from 'node:child_process';
import { demarrer, DSN } from './pgboot.mjs';
import pg from 'pg';
const { Client } = pg;

const RACINE = new URL('../../', import.meta.url).pathname;
const srv = await demarrer();
const c = new Client({ connectionString: DSN });
await c.connect();

let ok = 0;
let ko = 0;
const dire = (b, n, d = '') => {
  if (b) { ok += 1; console.log(`  ok     ${n}${d ? ' — ' + d : ''}`); }
  else { ko += 1; console.log(`  ECHEC  ${n}${d ? ' — ' + d : ''}`); }
};

const lancer = (env = {}) =>
  spawnSync(process.execPath, ['scripts/db/seed-demo.mjs'], {
    cwd: RACINE,
    env: { ...process.env, SUPABASE_DB_URL: DSN, ...env },
    encoding: 'utf8',
  });

console.log('\nJeu de demonstration\n--------------------');

// 1. Refus en production.
const enProd = lancer({ APP_ENV: 'production' });
dire(
  enProd.status !== 0 && /REFUS/.test(enProd.stderr ?? ''),
  'le seed refuse de s’executer avec APP_ENV=production',
);

// 2. Refus sur une base distante non autorisee.
const distant = lancer({
  APP_ENV: 'development',
  SUPABASE_DB_URL: 'postgres://user:motdepasse@db.exemple.supabase.co:5432/postgres',
});
dire(
  distant.status !== 0 && /pas locale/.test(distant.stderr ?? ''),
  'le seed refuse une base distante sans autorisation explicite',
);
dire(
  !/motdepasse/.test((distant.stderr ?? '') + (distant.stdout ?? '')),
  'le message de refus ne divulgue pas le mot de passe de la chaine de connexion',
);

// 3. Execution nominale.
const premier = lancer({ APP_ENV: 'development' });
dire(premier.status === 0, 'le seed s’applique', premier.stderr?.slice(0, 120) ?? '');

const q = async (sql) => (await c.query(sql)).rows;
const clients = await q(`select nom, email, telephone from clients`);
dire(clients.length >= 5, 'clients de demonstration crees', `${clients.length}`);

// 4. Marquage — le point qui compte vraiment.
dire(
  clients.every((cl) => cl.nom.startsWith('DÉMO —')),
  'tous les noms portent le prefixe DÉMO',
);
dire(
  clients.every((cl) => cl.email.endsWith('@demo.suiton.invalid')),
  'toutes les adresses sont sur un domaine qui ne se resout jamais (.invalid, RFC 2606)',
);
dire(
  clients.every((cl) => (cl.telephone ?? '').startsWith('0400 00 00')),
  'tous les numeros sont dans une plage non attribuee',
);

// 5. Couverture du parcours.
const etapes = (await q(`select distinct stage from jobs order by stage`)).map((r) => r.stage);
for (const attendue of ['nouveau', 'devis_envoye', 'planifie', 'termine', 'perdu']) {
  dire(etapes.includes(attendue), `le pipeline contient l’etape « ${attendue} »`);
}
const [{ n: devis }] = await q('select count(*)::int n from quotes');
const [{ n: rapports }] = await q('select count(*)::int n from reports');
const [{ n: factures }] = await q('select count(*)::int n from invoices');
const [{ n: publiees }] = await q('select count(*)::int n from jobs where published');
dire(devis >= 2, 'des devis existent', `${devis}`);
dire(rapports >= 1, 'un rapport de chantier existe', `${rapports}`);
dire(factures >= 1, 'une facture existe', `${factures}`);
dire(publiees >= 1, 'une realisation est publiee', `${publiees}`);

// La facture professionnelle doit porter l'autoliquidation et son Peppol.
const [facture] = await q(
  `select vat_regime, tva_montant, peppol_id from invoices order by created_at desc limit 1`,
);
dire(
  facture?.vat_regime === 'autoliquidation' && Number(facture?.tva_montant) === 0,
  'la facture professionnelle est en autoliquidation, sans TVA',
  facture ? `${facture.vat_regime}, TVA ${facture.tva_montant}` : 'aucune facture',
);
dire(Boolean(facture?.peppol_id), 'la facture porte un identifiant Peppol', facture?.peppol_id ?? '');

// 6. Idempotence.
const second = lancer({ APP_ENV: 'development' });
const [{ n: apres }] = await q(
  `select count(*)::int n from clients where email like '%@demo.suiton.invalid'`,
);
dire(
  second.status === 0 && apres === clients.length,
  'le seed est rejouable sans dupliquer',
  `${apres} clients apres deux executions${second.status !== 0 ? ' · ' + (second.stderr ?? '').trim().slice(0, 160) : ''}`,
);

// 7. Suppression.
const suppression = spawnSync(process.execPath, ['scripts/db/reset-demo.mjs'], {
  cwd: RACINE,
  env: { ...process.env, SUPABASE_DB_URL: DSN, APP_ENV: 'development' },
  encoding: 'utf8',
});
const [{ n: restants }] = await q(`select count(*)::int n from clients`);
const [{ n: chantiersRestants }] = await q(`select count(*)::int n from jobs`);
dire(
  suppression.status === 0 && restants === 0 && chantiersRestants === 0,
  'reset-demo supprime tout, cascades comprises',
  `${restants} client(s), ${chantiersRestants} chantier(s)` +
    (suppression.status !== 0 ? ' · ' + (suppression.stderr ?? '').trim().slice(0, 160) : ''),
);

console.log(`\n  ${ok} ok, ${ko} echec(s)`);
await c.end();
await srv.stop();
process.exit(ko > 0 ? 1 : 0);
