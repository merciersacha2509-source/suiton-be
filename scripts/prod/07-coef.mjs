import { demarrer, DSN } from './pgboot.mjs';
import pg from 'pg';
const { Client } = pg;
const srv = await demarrer();
const c = new Client({ connectionString: DSN });
await c.connect();
let ok = 0,
  ko = 0;
const dire = (b, n, d = '') => {
  if (b) {
    ok++;
    console.log('  ok     ' + n + (d ? ' — ' + d : ''));
  } else {
    ko++;
    console.log('  ECHEC  ' + n + (d ? ' — ' + d : ''));
  }
};

const { rows } = await c.query('select coef_bien from settings');
const coef = rows[0].coef_bien;
dire(
  Object.values(coef).every((v) => Number(v) === 1),
  'coefficients crees a 1.000 — aucun prix ne change',
  JSON.stringify(coef),
);

const essai = async (valeur) => {
  await c.query('savepoint sp');
  try {
    await c.query('update settings set coef_bien = $1::jsonb', [JSON.stringify(valeur)]);
    await c.query('rollback to savepoint sp');
    return true;
  } catch {
    await c.query('rollback to savepoint sp');
    return false;
  }
};
await c.query('begin');
const complet = {
  studio: 1,
  appartement: 1,
  maison: 1,
  villa: 1,
  bureaux: 1,
  commerce: 1,
  autre: 1,
};
dire(await essai({ ...complet, villa: 1.2 }), 'coefficient 1,20 accepte');
dire(!(await essai({ ...complet, villa: 12 })), 'coefficient 12 rejete (faute de frappe)');
dire(!(await essai({ ...complet, villa: 0.1 })), 'coefficient 0,10 rejete');
const { villa: _v, ...incomplet } = complet;
dire(!(await essai(incomplet)), 'grille incomplete rejetee');
await c.query('rollback');

console.log(`\n  ${ok} ok, ${ko} echec(s)`);
await c.end();
await srv.stop();
process.exit(ko > 0 ? 1 : 0);
