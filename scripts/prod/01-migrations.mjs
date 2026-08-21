/**
 * Monte une base PostgreSQL reelle et applique les 22 migrations.
 *
 * La base est recreee a chaque execution : un audit qui s'appuie sur l'etat
 * laisse par l'execution precedente ne prouve rien.
 */
import { demarrer, DSN_ADMIN, DSN } from './pgboot.mjs';
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
const { Client } = pg;

const t0 = Date.now();
const srv = await demarrer();
console.log(`postgres demarre en ${Date.now() - t0} ms`);

// --- base propre -------------------------------------------------------
const admin = new Client({ connectionString: DSN_ADMIN });
await admin.connect();
await admin.query(`
  select pg_terminate_backend(pid) from pg_stat_activity
  where datname = 'suiton' and pid <> pg_backend_pid()`);
await admin.query('drop database if exists suiton');
await admin.query('create database suiton');
for (const r of ['anon', 'authenticated', 'service_role']) {
  await admin.query(
    `do $q$ begin create role ${r} nologin${r === 'service_role' ? ' bypassrls' : ''};
     exception when duplicate_object then null; end $q$;`,
  );
}
await admin.end();

const c = new Client({ connectionString: DSN });
await c.connect();

// --- amorces fournies par Supabase en production -----------------------
await c.query(`
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
-- Schema aligne sur celui de Supabase en production : les migrations
-- s'appuient sur file_size_limit et allowed_mime_types.
create table storage.buckets (
  id text primary key, name text not null, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  public boolean default false, avif_autodetection boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner_id text);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(), metadata jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable
  as $q$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $q$;
create or replace function auth.role() returns text language sql stable
  as $q$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $q$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
`);

// --- migrations --------------------------------------------------------
const dir = new URL('../../supabase/migrations/', import.meta.url).pathname;
const fichiers = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
let n = 0;
const t1 = Date.now();
for (const f of fichiers) {
  try {
    await c.query(readFileSync(dir + f, 'utf8'));
    n += 1;
  } catch (e) {
    console.error(`  ECHEC ${f}\n        ${e.message}`);
    process.exitCode = 1;
    break;
  }
}
console.log(`${n}/${fichiers.length} migrations appliquees en ${Date.now() - t1} ms`);

// --- privileges par defaut de Supabase ---------------------------------
// Supabase accorde a `anon` et `authenticated` les privileges de table sur
// le schema public ; c'est la RLS, et elle seule, qui filtre les lignes.
// Sans ces GRANT, un audit d'isolation mesurerait « permission denied » au
// lieu de mesurer la RLS — donc ne mesurerait pas ce qu'il pretend mesurer.
await c.query(`
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
  grant execute on all functions in schema public to anon, authenticated;
  alter default privileges in schema public
    grant select, insert, update, delete on tables to anon, authenticated;
`);

// --- inventaire --------------------------------------------------------
const q = async (sql) => (await c.query(sql)).rows;
const tables = await q(`select tablename, rowsecurity from pg_tables
  where schemaname='public' order by tablename`);
const politiques = await q(`select tablename, count(*)::int n from pg_policies
  where schemaname='public' group by tablename`);
const parTable = Object.fromEntries(politiques.map((p) => [p.tablename, p.n]));

console.log(`\n${tables.length} tables dans public :`);
let sansRls = [];
for (const t of tables) {
  const n = parTable[t.tablename] ?? 0;
  if (!t.rowsecurity) sansRls.push(t.tablename);
  console.log(
    `  ${t.rowsecurity ? 'RLS ' : 'NUE '} ${t.tablename.padEnd(26)} ${n} politique(s)`,
  );
}
console.log(
  sansRls.length === 0
    ? '\nToutes les tables ont la RLS activee.'
    : `\nTABLES SANS RLS : ${sansRls.join(', ')}`,
);
if (sansRls.length > 0) process.exitCode = 1;

// On exclut les fonctions apportees par btree_gist : elles ne sont pas de
// nous et noient les fonctions metier.
const fn = await q(`select proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and d.objid is null order by proname`);
console.log(`\n${fn.length} fonctions metier :\n  ${fn.map((f) => f.proname).join(', ')}`);

const vues = await q(
  `select viewname from pg_views where schemaname='public' order by viewname`,
);
console.log(`\n${vues.length} vues :\n  ${vues.map((v) => v.viewname).join(', ')}`);

const triggers = await q(`select count(*)::int n from pg_trigger where not tgisinternal`);
console.log(`\n${triggers[0].n} declencheurs applicatifs`);

const idx = await q(`select count(*)::int n from pg_indexes where schemaname='public'`);
console.log(`${idx[0].n} index`);

await c.end();
await srv.stop();
