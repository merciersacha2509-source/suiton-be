#!/usr/bin/env node
/**
 * Applique le jeu de demonstration.
 *
 * Deux garde-fous avant toute ecriture :
 *
 *   1. REFUS si APP_ENV vaut « production ». Le seed n'a rien a faire dans la
 *      base reelle, et une commande lancee dans le mauvais terminal est
 *      l'erreur la plus banale qui soit.
 *   2. REFUS si l'URL Supabase n'est ni locale ni explicitement autorisee par
 *      SUITON_SEED_AUTORISE=1. Un .env mal copie suffirait sinon a peupler un
 *      projet distant de faux clients.
 *
 * Le script est idempotent : il supprime d'abord ce qu'il a cree, en se
 * fondant sur les marqueurs de demonstration. On peut le rejouer autant de
 * fois qu'on veut.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const RACINE = new URL('../../', import.meta.url).pathname;

const appEnv = process.env.APP_ENV ?? 'development';
const dsn =
  process.env.SUPABASE_DB_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres';

if (appEnv === 'production') {
  console.error(
    '\n⛔  REFUS — APP_ENV vaut « production ».\n\n' +
      "   Le jeu de demonstration ne s'applique jamais sur la base reelle.\n" +
      '   Si vous vouliez peupler un environnement de test, verifiez votre\n' +
      "   fichier .env : c'est celui de production qui est charge.\n",
  );
  process.exit(1);
}

const local = /127\.0\.0\.1|localhost/.test(dsn);
if (!local && process.env.SUITON_SEED_AUTORISE !== '1') {
  console.error(
    `\n⛔  REFUS — la base visee n'est pas locale.\n\n   ${dsn.replace(/:[^:@]+@/, ':***@')}\n\n` +
      '   Pour peupler un projet Supabase distant de donnees de demonstration,\n' +
      '   relancez avec SUITON_SEED_AUTORISE=1. A ne faire que sur un projet\n' +
      '   de staging, jamais sur celui de production.\n',
  );
  process.exit(1);
}

const c = new Client({ connectionString: dsn });
await c.connect();

const sql = readFileSync(join(RACINE, 'scripts/db/seed-demo.sql'), 'utf8');

try {
  await c.query('begin');
  await c.query(sql);
  await c.query('commit');
} catch (e) {
  await c.query('rollback');
  console.error(`\n⛔  Le seed a echoue, rien n'a ete ecrit.\n   ${e.message}\n`);
  await c.end();
  process.exit(1);
}

const compte = async (sqlCompte) => (await c.query(sqlCompte)).rows[0].n;

const clients = await compte(
  `select count(*)::int n from clients where email like '%@demo.suiton.invalid'`,
);
const chantiers = await compte(
  `select count(*)::int n from jobs j join clients cl on cl.id = j.client_id
   where cl.email like '%@demo.suiton.invalid'`,
);
const devis = await compte(`select count(*)::int n from quotes`);
const factures = await compte(`select count(*)::int n from invoices`);
const rapports = await compte(`select count(*)::int n from reports`);
const publiees = await compte(`select count(*)::int n from jobs where published`);

// Controle de surete : aucune donnee de demonstration ne doit ressembler a un
// vrai contact. On le verifie plutot que de l'affirmer.
const suspects = (
  await c.query(
    `select nom, email, telephone from clients
     where email like '%@demo.suiton.invalid'
       and (nom not like 'DÉMO —%' or telephone not like '0400 00 00%')`,
  )
).rows;

console.log(`
Jeu de demonstration applique.

  ${clients} clients de demonstration
  ${chantiers} chantiers, couvrant : nouveau, devis envoye, planifie, termine, perdu
  ${devis} devis · ${rapports} rapport · ${factures} facture
  ${publiees} realisation publiee

  Tous les noms commencent par « DÉMO — »
  Toutes les adresses sont en @demo.suiton.invalid (TLD reserve, ne se resout jamais)
  Tous les numeros sont en 0400 00 00 xx (plage non attribuee)
`);

if (suspects.length > 0) {
  console.error('⛔  Lignes de demonstration mal marquees :');
  for (const s of suspects) console.error(`   ${s.nom} · ${s.email} · ${s.telephone}`);
  await c.end();
  process.exit(1);
}

await c.end();
