/**
 * Execute la suite d'assertions de schema contre la base montee par
 * 01-migrations.mjs, puis quelques controles propres a la mise en
 * production : deny-all effectif, fonctions SECURITY DEFINER, index sur les
 * cles etrangeres.
 */
import { demarrer, DSN } from './pgboot.mjs';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const { Client } = pg;

const srv = await demarrer();

// --- suite existante ---------------------------------------------------
const r = spawnSync(process.execPath, ['scripts/test-schema.mjs'], {
  cwd: new URL('../../', import.meta.url).pathname,
  env: { ...process.env, SUPABASE_DB_URL: DSN },
  encoding: 'utf8',
});
process.stdout.write(r.stdout ?? '');
if (r.stderr) process.stderr.write(r.stderr);
const codeSuite = r.status;

// --- controles complementaires ----------------------------------------
const c = new Client({ connectionString: DSN });
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;

console.log('\n--- controles de mise en production ---');
let ok = 0;
let ko = 0;
const dire = (bon, msg, detail = '') => {
  if (bon) {
    ok += 1;
    console.log('  ok     ' + msg + (detail ? ' — ' + detail : ''));
  } else {
    ko += 1;
    console.log('  ECHEC  ' + msg + (detail ? ' — ' + detail : ''));
  }
};

// 1. Tables sans politique : deny-all volontaire ?
const nues = await q(`
  select t.tablename from pg_tables t
  where t.schemaname='public' and t.rowsecurity
    and not exists (select 1 from pg_policies p
                    where p.schemaname='public' and p.tablename=t.tablename)
  order by 1`);
dire(
  nues.every((t) => ['counters', 'rate_limits'].includes(t.tablename)),
  'Tables en deny-all limitees aux compteurs internes',
  nues.map((t) => t.tablename).join(', ') || 'aucune',
);

// Le deny-all doit etre reellement effectif pour un role applicatif.
//
// `set local role` n'a d'effet QUE dans une transaction : hors transaction,
// l'instruction est sans effet et le controle s'executerait en
// superutilisateur, qui contourne la RLS. Le test passerait alors pour de
// mauvaises raisons — c'est ce qui se produisait tant que ces tables etaient
// vides au moment de l'audit.
for (const t of nues) {
  await c.query('begin');
  await c.query('set local role authenticated');
  let visible;
  try {
    visible = (await q(`select count(*)::int n from public.${t.tablename}`))[0].n;
  } catch {
    visible = 'refus';
  }
  await c.query('rollback');

  // Un zero sur une table vide ne prouve rien : on annonce aussi le total.
  const total = (await q(`select count(*)::int n from public.${t.tablename}`))[0].n;
  dire(
    visible === 0 || visible === 'refus',
    `${t.tablename} illisible par « authenticated »`,
    `${total} ligne(s) en base, ${visible === 'refus' ? 'acces refuse' : `${visible} visible(s)`}`,
  );
}

// 2. Les fonctions qui contournent la RLS doivent fixer leur search_path.
const definers = await q(`
  select p.proname, p.proconfig from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  left join pg_depend d on d.objid=p.oid and d.deptype='e'
  where n.nspname='public' and p.prosecdef and d.objid is null order by 1`);
for (const f of definers) {
  const fixe = (f.proconfig ?? []).some((x) => x.startsWith('search_path='));
  dire(fixe, `SECURITY DEFINER ${f.proname} fixe son search_path`);
}
console.log(`  (${definers.length} fonctions SECURITY DEFINER)`);

// 3. Toute cle etrangere doit etre indexee cote enfant.
// Une cle etrangere composite (a, b) est couverte par un index (a, b, …) :
// il faut comparer le PREFIXE de l'index, pas seulement sa premiere colonne.
const fkNonIndexees = await q(`
  select c.conname, c.conrelid::regclass::text as tbl,
         (select string_agg(a.attname, ',' order by k.ord)
          from unnest(c.conkey) with ordinality k(attnum, ord)
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
  from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
  order by 1`);
dire(
  fkNonIndexees.length === 0,
  'Toutes les cles etrangeres sont indexees',
  fkNonIndexees.map((f) => `${f.tbl}(${f.cols})`).join(', '),
);

// 4. Le jeton de portail ne doit jamais etre stocke en clair.
const colonnes = await q(`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='portal_tokens' order by 1`);
const noms = colonnes.map((c) => c.column_name);
dire(
  !noms.includes('token'),
  'portal_tokens ne contient aucune colonne « token » en clair',
  noms.join(', '),
);
dire(noms.includes('token_hash'), 'portal_tokens stocke une empreinte');

// 5. La numerotation doit etre sans trou et concurrente.
const nx = await q(
  `select public.next_number('quote', 2026::smallint) a,
          public.next_number('quote', 2026::smallint) b`,
);
dire(nx[0].b === nx[0].a + 1, 'next_number incremente sans trou', `${nx[0].a} -> ${nx[0].b}`);

// 6. Les vues exposees doivent etre en security_invoker.
const vuesNonInvoker = await q(`
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='v'
    and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name='security_invoker'), 'false') <> 'true'
  order by 1`);
dire(
  vuesNonInvoker.length === 0,
  'Toutes les vues sont en security_invoker',
  vuesNonInvoker.map((v) => v.relname).join(', '),
);

console.log(`\n  complementaires : ${ok} ok, ${ko} echec(s)`);
await c.end();
await srv.stop();
process.exit(codeSuite !== 0 || ko > 0 ? 1 : 0);
