#!/usr/bin/env node
/**
 * Supprime le jeu de demonstration, et rien d'autre.
 *
 * La suppression se fonde sur le marqueur d'adresse @demo.suiton.invalid, qui
 * ne peut appartenir a aucun vrai client : le TLD .invalid est reserve par la
 * RFC 2606. Les cascades du schema emportent chantiers, devis, interventions,
 * rapports, factures et photos rattaches.
 */
import pg from 'pg';
const { Client } = pg;

if ((process.env.APP_ENV ?? 'development') === 'production') {
  console.error('\n⛔  REFUS — APP_ENV vaut « production ».\n');
  process.exit(1);
}

const dsn =
  process.env.SUPABASE_DB_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres';
const c = new Client({ connectionString: dsn });
await c.connect();

// L'ordre compte : `jobs.client_id` est en ON DELETE RESTRICT. Un client
// porteur de chantiers ne se supprime pas — c'est voulu. On retire donc les
// chantiers d'abord ; devis, interventions, rapports, factures et photos
// suivent en cascade.
await c.query('begin');

// Les factures sont en RESTRICT elles aussi : une piece comptable ne
// disparait pas parce qu'on efface un chantier. Elles partent en premier.
const { rowCount: factures } = await c.query(
  `delete from invoices where job_id in
     (select j.id from jobs j join clients cl on cl.id = j.client_id
      where cl.email like '%@demo.suiton.invalid')`,
);

const { rowCount: chantiers } = await c.query(
  `delete from jobs where client_id in
     (select id from clients where email like '%@demo.suiton.invalid')`,
);
const { rowCount: clients } = await c.query(
  `delete from clients where email like '%@demo.suiton.invalid'`,
);
const { rowCount: partenaires } = await c.query(
  `delete from partners where denomination like 'DÉMO —%'`,
);
const { rowCount: equipes } = await c.query(`delete from teams where nom like 'DÉMO —%'`);
await c.query('commit');

console.log(
  `\nJeu de demonstration supprime :\n` +
    `  ${factures} facture(s)\n` +
    `  ${chantiers} chantier(s) — devis, interventions, rapports et photos compris\n` +
    `  ${clients} client(s)\n` +
    `  ${partenaires} partenaire(s)\n` +
    `  ${equipes} equipe(s)\n`,
);
await c.end();
