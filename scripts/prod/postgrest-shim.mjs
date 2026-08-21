/**
 * Passerelle PostgREST minimale, adossee au PostgreSQL reel.
 *
 * POURQUOI. Une verification de bout en bout suppose que la requete HTTP
 * traverse reellement le code de l'application jusqu'a la base. Il n'y a ici
 * ni Docker, ni `supabase start`, donc ni PostgREST. Cette passerelle
 * implemente le sous-ensemble du protocole PostgREST que supabase-js utilise
 * sur nos routes — appels RPC, select, insert, update — et les traduit en SQL
 * execute sur la VRAIE base, avec les VRAIES migrations, les VRAIS
 * declencheurs et les VRAIES contraintes.
 *
 * CE QU'ELLE PROUVE. Que la route valide l'entree, applique la limitation de
 * debit, appelle la bonne fonction avec les bons arguments, que la
 * transaction atomique s'execute correctement, et que la reponse a la forme
 * attendue. Autrement dit : tout ce que nous ecrivons.
 *
 * CE QU'ELLE NE PROUVE PAS. Le comportement de PostgREST lui-meme, celui de
 * GoTrue, ni le respect de la RLS telle que Supabase l'applique — cette
 * passerelle se connecte en superutilisateur, comme le fait la cle
 * service_role, et c'est precisement ce que la route utilise. La RLL est
 * verifiee separement, en SQL, par 02-schema.mjs.
 */
import { createServer } from 'node:http';
import pg from 'pg';
const { Pool } = pg;

const OPERATEURS = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'like',
  is: 'is',
};

export function demarrerShim({ dsn, port = 54321 }) {
  const pool = new Pool({ connectionString: dsn, max: 8 });
  const appels = [];

  const corps = (req) =>
    new Promise((resolve) => {
      let d = '';
      req.on('data', (c) => (d += c));
      req.on('end', () => {
        try {
          resolve(d ? JSON.parse(d) : null);
        } catch {
          resolve(null);
        }
      });
    });

  /** Traduit `?id=eq.abc&statut=in.(a,b)` en clause WHERE parametree. */
  function filtres(params, valeurs) {
    const clauses = [];
    for (const [cle, brut] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(cle))
        continue;
      const sep = brut.indexOf('.');
      const op = brut.slice(0, sep);
      const val = brut.slice(sep + 1);
      if (op === 'in') {
        const items = val.replace(/^\(|\)$/g, '').split(',');
        const ph = items.map((v) => `$${valeurs.push(v)}`).join(', ');
        clauses.push(`"${cle}" in (${ph})`);
      } else if (op === 'is') {
        clauses.push(`"${cle}" is ${val === 'null' ? 'null' : val}`);
      } else if (OPERATEURS[op]) {
        clauses.push(`"${cle}" ${OPERATEURS[op]} $${valeurs.push(val)}`);
      }
    }
    return clauses.length ? ` where ${clauses.join(' and ')}` : '';
  }

  /** Cache des relations de cle etrangere, pour resoudre les jointures. */
  const relations = new Map();
  async function relation(enfant, parent) {
    const cle = `${enfant}->${parent}`;
    if (!relations.has(cle)) {
      const r = await pool.query(
        `select a.attname col, b.attname refcol
         from pg_constraint c
         join lateral unnest(c.conkey) k(n) on true
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n
         join lateral unnest(c.confkey) j(n) on true
         join pg_attribute b on b.attrelid = c.confrelid and b.attnum = j.n
         where c.contype = 'f'
           and c.conrelid = ('public.' || $1)::regclass
           and c.confrelid = ('public.' || $2)::regclass
         limit 1`,
        [enfant, parent],
      );
      relations.set(cle, r.rows[0] ?? null);
    }
    return relations.get(cle);
  }

  /**
   * Traduit la clause `select` de PostgREST, y compris les ressources
   * imbriquees de la forme `alias:table ( col, col )`. Une imbrication
   * devient une sous-requete correlee renvoyant du JSON — c'est exactement
   * ce que supabase-js attend.
   */
  async function colonnesSelect(table, select) {
    if (select === '*') return '*';

    // Decoupe au premier niveau : les virgules internes aux parentheses
    // appartiennent a la ressource imbriquee.
    const morceaux = [];
    let profondeur = 0;
    let courant = '';
    for (const ch of select) {
      if (ch === '(') profondeur += 1;
      if (ch === ')') profondeur -= 1;
      if (ch === ',' && profondeur === 0) {
        morceaux.push(courant);
        courant = '';
      } else courant += ch;
    }
    if (courant.trim()) morceaux.push(courant);

    const rendus = [];
    for (const brut of morceaux) {
      const m = brut.trim().match(/^(?:(\w+)\s*:\s*)?(\w+)\s*\(([^)]*)\)$/);
      if (!m) {
        rendus.push(`"${brut.trim()}"`);
        continue;
      }
      const [, alias, cible, sousCols] = m;
      const rel = (await relation(table, cible)) ?? (await relation(cible, table));
      if (!rel) throw new Error(`Aucune relation entre ${table} et ${cible}`);
      const inverse = !(await relation(table, cible));
      const cols = sousCols
        .split(',')
        .map((c) => `'${c.trim()}', x."${c.trim()}"`)
        .join(', ');
      const jointure = inverse
        ? `x."${rel.col}" = t."${rel.refcol}"`
        : `x."${rel.refcol}" = t."${rel.col}"`;
      rendus.push(
        `(select jsonb_build_object(${cols}) from public."${cible}" x where ${jointure} limit 1) as "${alias ?? cible}"`,
      );
    }
    return rendus.join(', ');
  }

  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chemin = url.pathname.replace(/^\/rest\/v1\//, '');
    const body = await corps(req);
    appels.push({ methode: req.method, chemin, params: url.search, body });

    const repondre = (code, donnees) => {
      res.writeHead(code, {
        'content-type': 'application/json',
        'content-range': '*/*',
      });
      res.end(JSON.stringify(donnees));
    };

    try {
      // --- Appels de fonction ------------------------------------------
      if (chemin.startsWith('rpc/')) {
        const fn = chemin.slice(4);
        const args = body ?? Object.fromEntries(url.searchParams);
        const cles = Object.keys(args);
        const sql = `select * from public."${fn}"(${cles
          .map((k, i) => `"${k}" => $${i + 1}`)
          .join(', ')})`;
        // node-postgres convertit un tableau JS en litteral de tableau
        // PostgreSQL, et un objet en JSON. On laisse donc les tableaux tels
        // quels (parametres uuid[]) et on serialise les objets (jsonb).
        // Limite connue : un parametre jsonb dont la valeur est un tableau
        // serait mal converti. Aucune de nos fonctions n'en prend.
        const valeurs = cles.map((k) => {
          const v = args[k];
          if (Array.isArray(v)) return v;
          return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
        });
        const r = await pool.query(sql, valeurs);
        // PostgREST renvoie un scalaire nu quand la fonction ne renvoie pas
        // une table ; sinon un tableau de lignes.
        const colonnes = r.fields.map((f) => f.name);
        if (colonnes.length === 1 && colonnes[0] === fn) {
          return repondre(200, r.rows[0]?.[fn] ?? null);
        }
        return repondre(200, r.rows);
      }

      const table = chemin;
      const valeurs = [];

      if (req.method === 'GET') {
        const select = url.searchParams.get('select') ?? '*';
        const cols = await colonnesSelect(table, select);
        let sql = `select ${cols} from public."${table}" t${filtres(url.searchParams, valeurs)}`;
        const ordre = url.searchParams.get('order');
        if (ordre) {
          const [col, sens] = ordre.split('.');
          sql += ` order by "${col}" ${sens === 'desc' ? 'desc' : 'asc'}`;
        }
        const limite = url.searchParams.get('limit');
        if (limite) sql += ` limit ${Number(limite)}`;
        const r = await pool.query(sql, valeurs);
        return repondre(200, r.rows);
      }

      if (req.method === 'POST') {
        const lignes = Array.isArray(body) ? body : [body];
        const cles = Object.keys(lignes[0] ?? {});
        const tuples = lignes
          .map(
            (l) =>
              `(${cles
                .map((k) => {
                  const v = l[k];
                  return `$${valeurs.push(
                    Array.isArray(v) || v === null || typeof v !== 'object'
                      ? v
                      : JSON.stringify(v),
                  )}`;
                })
                .join(', ')})`,
          )
          .join(', ');
        const sql = `insert into public."${table}" (${cles
          .map((k) => `"${k}"`)
          .join(', ')}) values ${tuples} returning *`;
        const r = await pool.query(sql, valeurs);
        return repondre(201, r.rows);
      }

      if (req.method === 'PATCH') {
        const cles = Object.keys(body ?? {});
        const sets = cles
          .map((k) => {
            const v = body[k];
            return `"${k}" = $${valeurs.push(
              Array.isArray(v) || v === null || typeof v !== 'object' ? v : JSON.stringify(v),
            )}`;
          })
          .join(', ');
        const sql = `update public."${table}" set ${sets}${filtres(
          url.searchParams,
          valeurs,
        )} returning *`;
        const r = await pool.query(sql, valeurs);
        return repondre(200, r.rows);
      }

      if (req.method === 'DELETE') {
        const sql = `delete from public."${table}"${filtres(url.searchParams, valeurs)} returning *`;
        const r = await pool.query(sql, valeurs);
        return repondre(200, r.rows);
      }

      return repondre(405, { message: `Methode ${req.method} non geree par la passerelle` });
    } catch (e) {
      // Forme d'erreur PostgREST : supabase-js lit `message`.
      return repondre(400, {
        message: e.message,
        code: e.code ?? 'PGRST',
        details: e.detail ?? null,
        hint: e.hint ?? null,
      });
    }
  });

  return new Promise((resolve) => {
    serveur.listen(port, '127.0.0.1', () =>
      resolve({
        appels,
        arreter: async () => {
          await pool.end();
          await new Promise((r) => serveur.close(r));
        },
      }),
    );
  });
}
