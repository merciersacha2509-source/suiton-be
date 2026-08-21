/**
 * Tests de contraintes de la base.
 *
 * Ce que Vitest ne peut pas couvrir : les regles qui vivent dans PostgreSQL.
 * Une contrainte non testee est une contrainte dont on decouvre l'absence
 * le jour ou elle aurait du servir.
 *
 * Prerequis : supabase start && supabase db reset
 * Lancement : npm run test:db
 */
// `pg` est un module CommonJS : l'import nomme echoue en ESM.
import pg from 'pg';
const { Client } = pg;

const DSN =
  process.env.SUPABASE_DB_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres';

const c = new Client({ connectionString: DSN });
await c.connect();

let ok = 0;
let ko = 0;

let compteurSavepoint = 0;

/**
 * Execute une assertion dans un POINT DE SAUVEGARDE.
 *
 * Indispensable : en PostgreSQL, une violation de contrainte avorte la
 * transaction entiere, et toute instruction suivante echoue avec 25P02
 * « current transaction is aborted ». Sans savepoint, le premier test de
 * rejet ferait echouer tous les suivants — y compris ceux qui devraient
 * passer.
 */
async function should(nom, fn, attendu) {
  const sp = `sp_${++compteurSavepoint}`;
  await c.query(`savepoint ${sp}`);

  try {
    await fn();
    if (attendu) {
      await c.query(`release savepoint ${sp}`);
      console.log('  ok    ', nom);
      ok++;
    } else {
      await c.query(`rollback to savepoint ${sp}`);
      console.log('  ECHEC ', nom, '— aurait du etre rejete');
      ko++;
    }
  } catch (e) {
    await c.query(`rollback to savepoint ${sp}`);
    if (!attendu) {
      console.log('  ok    ', nom, `[${e.constraint ?? e.code}]`);
      ok++;
    } else {
      console.log('  ECHEC ', nom, '—', e.message);
      ko++;
    }
  }
}

const q = (sql, params) => c.query(sql, params);

await q('begin');
try {
  // --- Numerotation --------------------------------------------------------
  console.log('\nNumerotation');
  const cli = (
    await q(
      `insert into clients (nom, email, telephone)
       values ('Test Schema', 'test-schema@example.be', '0489210124') returning id`,
    )
  ).rows[0].id;

  const j1 = (
    await q(
      `insert into jobs (client_id, service, surface_m2, commune)
       values ($1, 'fin_de_chantier', 140, 'Nivelles') returning id, reference`,
      [cli],
    )
  ).rows[0];
  const j2 = (
    await q(
      `insert into jobs (client_id, service, surface_m2, commune)
       values ($1, 'fin_de_chantier', 90, 'Enghien') returning id, reference`,
      [cli],
    )
  ).rows[0];

  const n1 = Number(j1.reference.slice(-4));
  const n2 = Number(j2.reference.slice(-4));
  if (n2 === n1 + 1) {
    console.log('  ok     numerotation continue', j1.reference, '->', j2.reference);
    ok++;
  } else {
    console.log('  ECHEC  numerotation', j1.reference, j2.reference);
    ko++;
  }

  // --- Score ---------------------------------------------------------------
  console.log('\nScore — la bande est calculee par la base');
  const seuils = [
    [140, 'A+'],
    [110, 'A+'],
    [109, 'A'],
    [85, 'A'],
    [84, 'B'],
    [55, 'B'],
    [54, 'C'],
    [0, 'C'],
  ];
  let bandesOk = true;
  for (const [score, attendu] of seuils) {
    const band = (
      await q('update clients set score=$1 where id=$2 returning score_band', [score, cli])
    ).rows[0].score_band;
    if (band !== attendu) {
      console.log(`  ECHEC  score ${score} -> ${band}, attendu ${attendu}`);
      bandesOk = false;
      ko++;
    }
  }
  if (bandesOk) {
    console.log('  ok     les 8 seuils correspondent a lib/scoring.ts');
    ok++;
  }
  await should(
    'score hors bornes rejete',
    () => q('update clients set score=200 where id=$1', [cli]),
    false,
  );

  // --- Chevauchement d'interventions ---------------------------------------
  console.log('\nInterventions — chevauchement, tampon de trajet compris');
  const team = (await q('select id from teams limit 1')).rows[0].id;
  const insInt = (jobId, debut, fin) =>
    q(
      `insert into interventions (job_id, team_id, starts_at, ends_at, ends_at_buffered, status)
       values ($1, $2, $3, $4, $4, 'confirme')`,
      [jobId, team, debut, fin],
    );

  await should(
    '08:00-12:00 acceptee',
    () => insInt(j1.id, '2026-10-05 08:00+02', '2026-10-05 12:00+02'),
    true,
  );
  await should(
    '12:15 — dans le tampon de 30 min — rejetee',
    () => insInt(j2.id, '2026-10-05 12:15+02', '2026-10-05 15:00+02'),
    false,
  );
  await should(
    '12:45 — apres le tampon — acceptee',
    () => insInt(j2.id, '2026-10-05 12:45+02', '2026-10-05 15:00+02'),
    true,
  );

  // --- Peppol --------------------------------------------------------------
  console.log('\nFacturation — obligation Peppol B2B (1er janvier 2026)');
  const part = (
    await q(
      `insert into partners (denomination, tva) values ('Test EG SA', 'BE0999888777')
       returning id, peppol_id`,
    )
  ).rows[0];
  if (part.peppol_id === '9925:BE0999888777') {
    console.log('  ok     identifiant Peppol derive de la TVA');
    ok++;
  } else {
    console.log('  ECHEC  peppol_id =', part.peppol_id);
    ko++;
  }

  // Les types sont explicites : sans cast, Postgres deduit deux types
  // differents pour $4 (invoice_status dans la colonne, text dans le CASE)
  // et refuse la requete avec 42P08.
  const insFact = (status, peppol) =>
    q(
      `insert into invoices (job_id, client_id, partner_id, status, date_emission, peppol_id,
                             montant_htva, tva_montant, montant_ttc, vat_regime)
       values ($1, $2, $3, $4::invoice_status,
               case when $4::text = 'brouillon' then null else current_date end, $5,
               1120, 0, 1120, 'autoliquidation')`,
      [j1.id, cli, part.id, status, peppol],
    );

  await should('B2B en brouillon sans Peppol acceptee', () => insFact('brouillon', null), true);
  await should('B2B EMISE sans Peppol REJETEE', () => insFact('emise', null), false);
  await should(
    'B2B emise avec Peppol acceptee',
    () => insFact('emise', '9925:BE0999888777'),
    true,
  );
  await should(
    'TTC incoherent rejete',
    () =>
      q(
        `insert into invoices (job_id, client_id, montant_htva, tva_montant, montant_ttc)
             values ($1,$2,1000,210,9999)`,
        [j1.id, cli],
      ),
    false,
  );
  await should(
    'autoliquidation avec TVA non nulle rejetee',
    () =>
      q(
        `insert into invoices (job_id, client_id, vat_regime, montant_htva, tva_montant, montant_ttc)
             values ($1,$2,'autoliquidation',1000,210,1210)`,
        [j1.id, cli],
      ),
    false,
  );

  // --- RGPD ----------------------------------------------------------------
  console.log('\nRGPD — EXIF et consentement');
  await should(
    'photo publiee sans purge EXIF rejetee',
    () =>
      q(
        `insert into photos (job_id, phase, storage_path, exif_stripped, is_published)
             values ($1,'apres','test/1.webp',false,true)`,
        [j1.id],
      ),
    false,
  );
  await should(
    'photo publiee avec EXIF purge acceptee',
    () =>
      q(
        `insert into photos (job_id, phase, storage_path, exif_stripped, is_published)
             values ($1,'apres','test/2.webp',true,true)`,
        [j1.id],
      ),
    true,
  );
  await should(
    'consentement photo sans date rejete',
    () => q('update clients set consent_photos=true where id=$1', [cli]),
    false,
  );
  await should(
    'consentement photo date accepte',
    () =>
      q('update clients set consent_photos=true, consent_photos_at=now() where id=$1', [cli]),
    true,
  );

  // --- Rapports ------------------------------------------------------------
  console.log('\nRapports');
  await should(
    'observations vides rejetees',
    () =>
      q(
        `insert into reports (job_id, observations, checklist)
             values ($1,'','[1,2,3,4,5,6]'::jsonb)`,
        [j1.id],
      ),
    false,
  );
  await should(
    'checklist incomplete rejetee',
    () =>
      q(
        `insert into reports (job_id, observations, checklist)
             values ($1,'RAS','[1,2,3]'::jsonb)`,
        [j1.id],
      ),
    false,
  );
  await should(
    'rapport complet accepte',
    () =>
      q(
        `insert into reports (job_id, observations, checklist)
             values ($1,'Rayure preexistante sur le chassis cuisine, photographiee.','[1,2,3,4,5,6]'::jsonb)`,
        [j1.id],
      ),
    true,
  );

  // --- SEO -----------------------------------------------------------------
  console.log('\nRealisations — resume obligatoire');
  await should(
    'publication sans resume rejetee',
    () => q(`update jobs set published=true, published_slug='test-slug' where id=$1`, [j1.id]),
    false,
  );
  await should(
    'publication avec resume redige acceptee',
    () =>
      q(
        `update jobs set published=true, published_slug='test-slug-2',
             resume_public='Maison de 140 m2 livree apres gros oeuvre. Poussiere de decoupe incrustee dans les chassis ; vitres et sols traites en une journee.'
             where id=$1`,
        [j1.id],
      ),
    true,
  );

  // --- Reglages ------------------------------------------------------------
  console.log('\nReglages — historique ecrit par trigger');
  const avant = (await q('select count(*)::int n from settings_history')).rows[0].n;
  await q('update settings set majoration_urgence = 0.25 where id = true');
  const apres = (await q('select count(*)::int n from settings_history')).rows[0].n;
  if (apres === avant + 1) {
    console.log('  ok     une ligne d’historique ecrite par la base');
    ok++;
  } else {
    console.log('  ECHEC  historique non ecrit');
    ko++;
  }

  // --- Sprint 2 : reservation atomique ------------------------------------
  console.log('\nReservation — atomicite de create_booking');
  const hash = 'f'.repeat(64);
  const r = (
    await q(`select * from create_booking($1, $2, $3, $4, $5, $6)`, [
      JSON.stringify({
        nom: 'Test Atomique',
        email: 'Atomique@Example.BE',
        telephone: '0489210124',
        kind: 'particulier',
        commune: 'Nivelles',
        code_postal: '1400',
      }),
      JSON.stringify({
        service: 'fin_de_chantier',
        property_type: 'maison',
        soil: 'standard',
        surface_m2: 140,
        commune: 'Nivelles',
        code_postal: '1400',
        zone: 'principale',
      }),
      JSON.stringify({ min: 980, max: 1120, duree_min: 280, duree_max: 390 }),
      62,
      JSON.stringify({}),
      hash,
    ])
  ).rows[0];

  if (r?.job_id && r?.token_id && r?.est_nouveau) {
    console.log('  ok     chantier + client + jeton crees', r.job_reference);
    ok++;
  } else {
    console.log('  ECHEC  create_booking', r);
    ko++;
  }

  const traces = (
    await q(
      `select
         (select count(*) from events       where job_id = $1 and type = 'booking.created') e,
         (select count(*) from score_events where job_id = $1) s`,
      [r.job_id],
    )
  ).rows[0];
  if (Number(traces.e) === 1 && Number(traces.s) === 1) {
    console.log('  ok     evenement et score journalises');
    ok++;
  } else {
    console.log('  ECHEC  journalisation', traces);
    ko++;
  }

  const jobsAvant = (await q('select count(*)::int n from jobs')).rows[0].n;
  await should(
    'une donnee invalide n’ecrit RIEN',
    () =>
      q(`select * from create_booking($1, $2, $3, $4, $5, $6)`, [
        JSON.stringify({ nom: 'X', email: 'echec-rollback@example.be', telephone: '0489' }),
        JSON.stringify({ service: 'fin_de_chantier', surface_m2: 99999, commune: 'X' }),
        JSON.stringify({ min: 1, max: 2 }),
        10,
        JSON.stringify({}),
        'e'.repeat(64),
      ]),
    false,
  );
  const jobsApres = (await q('select count(*)::int n from jobs')).rows[0].n;
  const orphelin = (
    await q(`select count(*)::int n from clients where email = 'echec-rollback@example.be'`)
  ).rows[0].n;
  if (jobsAvant === jobsApres && orphelin === 0) {
    console.log('  ok     aucun chantier ni client orphelin laisse');
    ok++;
  } else {
    console.log('  ECHEC  rollback incomplet');
    ko++;
  }

  // --- Jetons de portail ---------------------------------------------------
  console.log('\nPortail — un seul jeton actif a la fois');
  await should(
    'second jeton actif rejete',
    () =>
      q('insert into portal_tokens (job_id, token_hash) values ($1, $2)', [
        r.job_id,
        'a'.repeat(64),
      ]),
    false,
  );
  await q('update portal_tokens set revoked_at = now() where job_id = $1', [r.job_id]);
  await should(
    'nouveau jeton accepte apres revocation',
    () =>
      q('insert into portal_tokens (job_id, token_hash) values ($1, $2)', [
        r.job_id,
        'a'.repeat(64),
      ]),
    true,
  );
  await should(
    'empreinte non hexadecimale rejetee',
    () =>
      q('insert into portal_tokens (job_id, token_hash) values ($1, $2)', [
        j2.id,
        'pas-une-empreinte',
      ]),
    false,
  );

  // --- Limitation de debit -------------------------------------------------
  console.log('\nLimitation de debit');
  let dernier;
  for (let i = 0; i < 12; i++) {
    dernier = (await q(`select * from consume_rate_limit('booking', '203.0.113.7', 10, 3600)`))
      .rows[0];
  }
  const autre = (
    await q(`select * from consume_rate_limit('booking', '203.0.113.8', 10, 3600)`)
  ).rows[0];
  if (dernier.autorise === false && autre.autorise === true && dernier.reset_dans > 0) {
    console.log('  ok     11e requete bloquee, autre IP intacte, Retry-After renseigne');
    ok++;
  } else {
    console.log('  ECHEC  limitation', dernier, autre);
    ko++;
  }

  // --- Creneaux ------------------------------------------------------------
  console.log('\nCreneaux libres');
  const d0 = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const d1 = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
  const libres = (
    await q('select * from free_slots($1, $2::date, $3::date, 240, 30)', [team, d0, d1])
  ).rows;

  const dansLes24h = libres.filter((s) => new Date(s.debut) < new Date(Date.now() + 864e5));
  const dimanches = libres.filter((s) => new Date(s.debut).getUTCDay() === 0);
  if (libres.length > 0 && dansLes24h.length === 0 && dimanches.length === 0) {
    console.log(`  ok     ${libres.length} creneaux, aucun sous 24 h, aucun dimanche`);
    ok++;
  } else {
    console.log('  ECHEC  creneaux', {
      total: libres.length,
      dansLes24h: dansLes24h.length,
      dimanches: dimanches.length,
    });
    ko++;
  }

  if (libres[0]) {
    await q(
      `insert into interventions (job_id, team_id, starts_at, ends_at, ends_at_buffered, status)
       values ($1, $2, $3, $4, $4, 'confirme')`,
      [r.job_id, team, libres[0].debut, libres[0].fin],
    );
    const apresOccupation = (
      await q('select * from free_slots($1, $2::date, $3::date, 240, 30)', [team, d0, d1])
    ).rows;
    const encorePropose = apresOccupation.some(
      (s) => new Date(s.debut).getTime() === new Date(libres[0].debut).getTime(),
    );
    if (!encorePropose) {
      console.log(
        `  ok     creneau occupe retire (${libres.length} -> ${apresOccupation.length})`,
      );
      ok++;
    } else {
      console.log('  ECHEC  creneau occupe encore propose');
      ko++;
    }
  }

  // --- Purge des photos orphelines ----------------------------------------
  console.log('\nPhotos deposees sans chantier');
  await q(
    `insert into photos (phase, storage_path, exif_stripped) values ('avant', 'test/vieille.webp', true)`,
  );
  await q(
    `update photos set created_at = now() - interval '2 days' where storage_path = 'test/vieille.webp'`,
  );
  await q(
    `insert into photos (phase, storage_path, exif_stripped) values ('avant', 'test/recente.webp', true)`,
  );
  const purgees = (await q('select purge_photos_orphelines() n')).rows[0].n;
  if (Number(purgees) === 1) {
    console.log('  ok     orpheline de plus de 24 h purgee, recente conservee');
    ok++;
  } else {
    console.log('  ECHEC  purge', purgees);
    ko++;
  }

  // --- Sprint 3 : communication structuree --------------------------------
  console.log('\nCommunication structuree belge (modulo 97)');
  const comms = (
    await q(`select
      communication_structuree(1, 2026::smallint)   c1,
      communication_structuree(148, 2026::smallint) c148,
      communication_structuree(999, 2026::smallint) c999`)
  ).rows[0];

  const formatOk = [comms.c1, comms.c148, comms.c999].every((c) =>
    /^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/.test(c),
  );

  // La cle de controle est le reste de la division par 97 des 10 premiers
  // chiffres — et 97 si ce reste vaut 0, « 00 » n'etant pas une cle valide.
  const cleOk = [comms.c1, comms.c148, comms.c999].every((c) => {
    const chiffres = c.replace(/[^0-9]/g, '');
    const base = BigInt(chiffres.slice(0, 10));
    const cle = Number(chiffres.slice(10));
    const attendu = Number(base % 97n) === 0 ? 97 : Number(base % 97n);
    return cle === attendu;
  });

  if (formatOk && cleOk) {
    console.log('  ok     format et clé de contrôle corrects', comms.c148);
    ok++;
  } else {
    console.log('  ECHEC  communication structurée', comms);
    ko++;
  }

  const { rows: auto } = await q(
    `insert into invoices (job_id, client_id, montant_htva, tva_montant, montant_ttc)
     values ($1, $2, 100, 21, 121) returning numero, communication`,
    [j2.id, cli],
  );
  if (auto[0]?.communication?.startsWith('+++')) {
    console.log('  ok     attribuée automatiquement à la création', auto[0].communication);
    ok++;
  } else {
    console.log('  ECHEC  communication non attribuée');
    ko++;
  }

  // --- Terrain : le rapport ne s'invente pas -------------------------------
  console.log('\nTerrain — verrous du rapport');
  const teamT = (await q('select id from teams limit 1')).rows[0].id;
  const { rows: interT } = await q(
    `insert into interventions (job_id, team_id, starts_at, ends_at, ends_at_buffered, status)
     values ($1, $2, now() + interval '30 days', now() + interval '30 days 4 hours',
             now() + interval '30 days 5 hours', 'confirme')
     returning id`,
    [j2.id, teamT],
  );
  const interventionId = interT[0].id;

  await should(
    'rapport refusé si l’intervention n’a pas commencé',
    () =>
      q(
        `insert into reports (job_id, intervention_id, observations, checklist)
             values ($1, $2, 'RAS', '[1,2,3,4,5,6]'::jsonb)`,
        [j2.id, interventionId],
      ),
    false,
  );

  await q(`update interventions set status = 'sur_place', sur_place_at = now() where id = $1`, [
    interventionId,
  ]);

  await should(
    'rapport refusé si la checklist est incomplète',
    () =>
      q(
        `insert into reports (job_id, intervention_id, observations, checklist)
             values ($1, $2, 'RAS', '[1,2,3,4,5,6]'::jsonb)`,
        [j2.id, interventionId],
      ),
    false,
  );

  for (let n = 1; n <= 6; n++) {
    await q('insert into checklist_progress (intervention_id, ordre) values ($1, $2)', [
      interventionId,
      n,
    ]);
  }

  await should(
    'rapport accepté une fois les 6 étapes cochées',
    () =>
      q(
        `insert into reports (job_id, intervention_id, observations, checklist)
             values ($1, $2, 'Rayure préexistante photographiée.', '[1,2,3,4,5,6]'::jsonb)`,
        [j2.id, interventionId],
      ),
    true,
  );

  // --- Appariement des photos ----------------------------------------------
  console.log('\nPhotos — appariement avant/après');
  await should(
    'une photo « avant » par paire',
    () =>
      q(
        `insert into photos (job_id, phase, piece, paire, storage_path, exif_stripped)
             values ($1, 'avant', 'Cuisine', 1, 'test/a1.webp', true)`,
        [j2.id],
      ),
    true,
  );
  await should(
    'deux « avant » dans la même paire refusés',
    () =>
      q(
        `insert into photos (job_id, phase, piece, paire, storage_path, exif_stripped)
             values ($1, 'avant', 'Cuisine', 1, 'test/a2.webp', true)`,
        [j2.id],
      ),
    false,
  );
  await should(
    'un « après » dans la même paire accepté',
    () =>
      q(
        `insert into photos (job_id, phase, piece, paire, storage_path, exif_stripped)
             values ($1, 'apres', 'Cuisine', 1, 'test/b1.webp', true)`,
        [j2.id],
      ),
    true,
  );

  // --- Cloture d'intervention ---------------------------------------------
  console.log('\nClôture — durée réelle et avancement du chantier');
  await q(`update interventions set sur_place_at = now() - interval '5 hours' where id = $1`, [
    interventionId,
  ]);
  await q(`update interventions set status = 'termine' where id = $1`, [interventionId]);
  const cloture = (await q('select stage, duree_reelle_min from jobs where id = $1', [j2.id]))
    .rows[0];
  if (
    cloture.stage === 'termine' &&
    cloture.duree_reelle_min >= 295 &&
    cloture.duree_reelle_min <= 305
  ) {
    console.log(`  ok     chantier terminé, durée réelle ${cloture.duree_reelle_min} min`);
    ok++;
  } else {
    console.log('  ECHEC  clôture', cloture);
    ko++;
  }

  // --- Sprint 4 : registre documentaire ------------------------------------
  console.log('\nRegistre documentaire — versionnement');
  const insDoc = (type, numero, hash, version) =>
    q(
      `insert into documents (job_id, type, destinataire, numero, version, storage_path, hash)
       values ($1, $2::document_type, $3::document_destinataire, $4, $5, $6, $7) returning id`,
      [j1.id, type, 'client', numero, version, `${type}/2026/${numero}-v${version}.pdf`, hash],
    );

  const v1 = (await insDoc('devis', 'SUITON-D-2026-0001', 'a'.repeat(64), 1)).rows[0].id;
  const prochaine = (
    await q(`select prochaine_version_document($1, 'devis'::document_type, $2) v`, [
      j1.id,
      'SUITON-D-2026-0001',
    ])
  ).rows[0].v;
  if (Number(prochaine) === 2) {
    console.log('  ok     la version suivante est calculée par la base');
    ok++;
  } else {
    console.log('  ECHEC  prochaine_version_document =', prochaine);
    ko++;
  }

  await insDoc('devis', 'SUITON-D-2026-0001', 'b'.repeat(64), 2);
  const remplace = (await q('select superseded_by from documents where id = $1', [v1])).rows[0];
  if (remplace.superseded_by) {
    console.log('  ok     la version 1 est marquée remplacée automatiquement');
    ok++;
  } else {
    console.log('  ECHEC  version 1 non remplacée');
    ko++;
  }

  await should(
    'deux fois la même version rejetée',
    () => insDoc('devis', 'SUITON-D-2026-0001', 'c'.repeat(64), 2),
    false,
  );
  await should(
    'empreinte non hexadécimale rejetée',
    () => insDoc('facture', 'SUITON-F-2026-0001', 'pas-un-hash', 1),
    false,
  );

  // --- Archive -------------------------------------------------------------
  console.log('\nArchive de chantier');
  await q(
    `insert into job_archives (job_id, reference, contenu, documents_count, montant_ttc)
     values ($1, $2, $3::jsonb, 2, 1385.45)`,
    [j1.id, j1.reference, JSON.stringify({ archive_version: 1, chantier: { id: j1.id } })],
  );
  const archive = (
    await q('select documents_count, montant_ttc from job_archives where job_id = $1', [j1.id])
  ).rows[0];
  if (Number(archive.documents_count) === 2) {
    console.log('  ok     archive écrite avec son instantané dénormalisé');
    ok++;
  } else {
    console.log('  ECHEC  archive', archive);
    ko++;
  }

  await should(
    'contenu d’archive non objet rejeté',
    () =>
      q(
        `insert into job_archives (job_id, reference, contenu) values ($1, 'X', '"texte"'::jsonb)`,
        [j2.id],
      ),
    false,
  );

  // --- Sprint 5 : moteur de donnees ----------------------------------------
  console.log('\nRéférences — refus de mentir avec peu de données');

  const refVide = (
    await q(
      `select * from reference_effective('maison'::property_type, 140, 'standard'::soil_level)`,
    )
  ).rows[0];

  if (
    refVide.origine === 'catalogue' &&
    refVide.confiance === 'aucune' &&
    Number(refVide.n) === 0
  ) {
    console.log(
      '  ok     sans historique, la référence vient du catalogue',
      `${refVide.minutes_par_m2} min/m²`,
    );
    ok++;
  } else {
    console.log('  ECHEC  référence vide', refVide);
    ko++;
  }

  // Trois chantiers comparables : encore insuffisant.
  const faireChantierComplet = async (surface, dureeMin, montant) => {
    const jr = (
      await q(
        `insert into jobs (client_id, service, property_type, soil, surface_m2, commune, stage, duree_reelle_min)
         values ($1, 'fin_de_chantier', 'maison', 'standard', $2, 'Nivelles', 'termine', $3)
         returning id`,
        [cli, surface, dureeMin],
      )
    ).rows[0].id;

    await q(
      `insert into invoices (job_id, client_id, montant_htva, tva_montant, montant_ttc, status, date_emission)
       values ($1, $2, $3, $4, $5, 'emise', current_date)`,
      [jr, cli, montant, montant * 0.21, montant * 1.21],
    );

    await q('select rafraichir_metriques($1)', [jr]);
    return jr;
  };

  for (let i = 0; i < 3; i++) await faireChantierComplet(140, 330 + i * 10, 1100 + i * 20);

  const ref3 = (
    await q(
      `select * from reference_effective('maison'::property_type, 140, 'standard'::soil_level)`,
    )
  ).rows[0];

  if (ref3.origine === 'catalogue' && Number(ref3.n) === 3 && ref3.confiance === 'faible') {
    console.log('  ok     3 chantiers : confiance faible, catalogue conservé');
    ok++;
  } else {
    console.log('  ECHEC  référence à 3', ref3);
    ko++;
  }

  // Cinq chantiers : la mediane observee prend le relais.
  for (let i = 0; i < 2; i++) await faireChantierComplet(140, 350 + i * 10, 1150);

  const ref5 = (
    await q(
      `select * from reference_effective('maison'::property_type, 140, 'standard'::soil_level)`,
    )
  ).rows[0];

  if (ref5.origine === 'observee' && Number(ref5.n) === 5 && ref5.confiance === 'moyenne') {
    console.log(
      '  ok     5 chantiers : la médiane observée prend le relais',
      `${ref5.minutes_par_m2} min/m²`,
    );
    ok++;
  } else {
    console.log('  ECHEC  référence à 5', ref5);
    ko++;
  }

  // Un chantier catastrophique ne doit pas emporter la reference.
  const avantOutlier = Number(ref5.minutes_par_m2);
  await faireChantierComplet(140, 1400, 1150); // 10 min/m², aberrant
  const refOutlier = (
    await q(
      `select * from reference_effective('maison'::property_type, 140, 'standard'::soil_level)`,
    )
  ).rows[0];
  const deplacement = Math.abs(Number(refOutlier.minutes_par_m2) - avantOutlier) / avantOutlier;

  if (deplacement < 0.2) {
    console.log(
      '  ok     la médiane résiste à un chantier aberrant',
      `${avantOutlier} → ${refOutlier.minutes_par_m2} min/m²`,
    );
    ok++;
  } else {
    console.log('  ECHEC  médiane déplacée de', Math.round(deplacement * 100), '%');
    ko++;
  }

  // --- Bandes de surface ---------------------------------------------------
  console.log('\nBandes de surface');
  const bandes = (
    await q(`select bande_surface(40) a, bande_surface(90) b, bande_surface(140) c,
                    bande_surface(250) d, bande_surface(400) e`)
  ).rows[0];
  if (
    bandes.a === 'xs' &&
    bandes.b === 's' &&
    bandes.c === 'm' &&
    bandes.d === 'l' &&
    bandes.e === 'xl'
  ) {
    console.log('  ok     cinq bandes, un studio n’est pas comparé à une villa');
    ok++;
  } else {
    console.log('  ECHEC  bandes', bandes);
    ko++;
  }

  // --- Extraction des metriques --------------------------------------------
  console.log('\nExtraction automatique des métriques');
  await q('select rafraichir_metriques($1)', [j1.id]);
  const m2 = (await q('select * from job_metrics where job_id = $1', [j1.id])).rows[0];

  if (m2 && Number(m2.surface_m2) === 140) {
    console.log('  ok     métriques extraites et idempotentes');
    ok++;
  } else {
    console.log('  ECHEC  métriques', m2);
    ko++;
  }

  const cadence = (
    await q(`select minutes_par_m2 from job_metrics where duree_reelle_min = 330 limit 1`)
  ).rows[0];
  if (cadence && Math.abs(Number(cadence.minutes_par_m2) - 330 / 140) < 0.02) {
    console.log('  ok     cadence min/m² calculée', cadence.minutes_par_m2);
    ok++;
  } else {
    console.log('  ECHEC  cadence', cadence);
    ko++;
  }

  // --- Vues d'agregation ---------------------------------------------------
  console.log('\nVues d’agrégation');
  const vues = [
    'stats_par_service',
    'stats_par_commune',
    'stats_par_equipe',
    'stats_estimation',
    'stats_par_etape',
  ];
  let vuesOk = true;
  for (const v of vues) {
    try {
      await q(`select * from ${v} limit 1`);
    } catch (e) {
      console.log(`  ECHEC  ${v} :`, e.message);
      vuesOk = false;
      ko++;
    }
  }
  if (vuesOk) {
    console.log('  ok     les cinq vues répondent, même sur une base quasi vide');
    ok++;
  }

  // --- Sprint 6 : vues du cockpit ------------------------------------------
  console.log('\nCockpit — les vues répondent sur une base vide');
  const vuesCockpit = [
    'perf_globale',
    'ecart_tarifaire',
    'rendement_par_effectif',
    'retouches_par_service',
    'rentabilite_matrice',
    'references_gabarits',
    'opportunites_communes',
    'evolution_trimestrielle',
  ];

  let cockpitOk = true;
  for (const v of vuesCockpit) {
    try {
      await q(`select * from ${v} limit 1`);
    } catch (e) {
      console.log(`  ECHEC  ${v} :`, e.message);
      cockpitOk = false;
      ko++;
    }
  }
  if (cockpitOk) {
    console.log(`  ok     les ${vuesCockpit.length} vues du cockpit répondent`);
    ok++;
  }

  // perf_globale doit TOUJOURS renvoyer exactement une ligne, meme vide :
  // sans cela le tableau de bord tombe en erreur au premier jour.
  const perf = (await q('select * from perf_globale')).rows;
  if (perf.length === 1) {
    console.log('  ok     perf_globale renvoie une ligne unique, même sans donnée');
    ok++;
  } else {
    console.log('  ECHEC  perf_globale renvoie', perf.length, 'lignes');
    ko++;
  }

  // Le catalogue couvre TOUS les gabarits : 7 biens × 5 bandes × 3 salissures.
  const gabarits = (await q('select count(*)::int n from references_gabarits')).rows[0].n;
  if (Number(gabarits) === 105) {
    console.log('  ok     105 gabarits couverts par le catalogue');
    ok++;
  } else {
    console.log('  ECHEC  gabarits :', gabarits, 'au lieu de 105');
    ko++;
  }

  // Aucun gabarit ne doit rester sans reference exploitable.
  const sansRef = (
    await q('select count(*)::int n from references_gabarits where effective_min_m2 is null')
  ).rows[0].n;
  if (Number(sansRef) === 0) {
    console.log('  ok     aucun gabarit sans référence exploitable');
    ok++;
  } else {
    console.log('  ECHEC  gabarits sans référence :', sansRef);
    ko++;
  }

  console.log('\nChantiers comparables');
  const comparables = (
    await q(
      `select * from chantiers_comparables('maison'::property_type, 140, 'standard'::soil_level, 20)`,
    )
  ).rows;
  if (comparables.length >= 5) {
    console.log(`  ok     ${comparables.length} chantiers comparables retrouvés`);
    ok++;
  } else {
    console.log('  ECHEC  comparables :', comparables.length);
    ko++;
  }

  // Un chantier d'une autre bande de surface ne doit PAS ressortir.
  const horsBande = comparables.filter(
    (c) => Number(c.surface_m2) < 110 || Number(c.surface_m2) >= 180,
  );
  if (horsBande.length === 0) {
    console.log('  ok     seuls les chantiers de la même bande de surface remontent');
    ok++;
  } else {
    console.log('  ECHEC  chantiers hors bande :', horsBande.length);
    ko++;
  }

  // --- Sprint 7 : SUITON Intelligence --------------------------------------
  console.log('\nIntelligence — traçabilité des décisions');

  await should(
    'un rejet sans motif est refusé',
    () =>
      q(`insert into recommandations (code, famille, statut, titre, action, decide_le)
             values ('t:1', 'tarification', 'rejetee', 'T', 'A', now())`),
    false,
  );

  await should(
    'un rejet motivé est accepté',
    () =>
      q(`insert into recommandations (code, famille, statut, titre, action, motif_rejet, decide_le)
             values ('t:2', 'tarification', 'rejetee', 'T', 'A', 'Marché tendu', now())`),
    true,
  );

  await should(
    'une décision sans date est refusée',
    () =>
      q(`insert into recommandations (code, famille, statut, titre, action)
             values ('t:3', 'planning', 'acceptee', 'T', 'A')`),
    false,
  );

  await should(
    'une fourchette de gain inversée est refusée',
    () =>
      q(`insert into recommandations (code, famille, titre, action, gain_min, gain_max)
             values ('t:4', 'qualite', 'T', 'A', 900, 300)`),
    false,
  );

  await should(
    'deux recommandations actives de même code sont refusées',
    async () => {
      await q(
        `insert into recommandations (code, famille, titre, action) values ('t:5', 'qualite', 'T', 'A')`,
      );
      await q(
        `insert into recommandations (code, famille, titre, action) values ('t:5', 'qualite', 'T', 'A')`,
      );
    },
    false,
  );

  // --- Experiences ---------------------------------------------------------
  console.log('\nExpériences contrôlées');

  await should(
    'une période de test antérieure à la référence est refusée',
    () =>
      q(`insert into experiences (titre, hypothese, famille, reference_debut, reference_fin, test_debut)
             values ('X', 'H', 'tarification', '2026-06-01', '2026-09-01', '2026-07-01')`),
    false,
  );

  await should(
    'un indicateur inconnu est refusé',
    () =>
      q(`insert into experiences (titre, hypothese, famille, indicateur, reference_debut, reference_fin, test_debut)
             values ('X', 'H', 'tarification', 'inventé', '2026-06-01', '2026-09-01', '2026-09-01')`),
    false,
  );

  await should(
    'une clôture sans conclusion est refusée',
    () =>
      q(`insert into experiences (titre, hypothese, famille, statut, reference_debut, reference_fin, test_debut)
             values ('X', 'H', 'tarification', 'terminee', '2026-06-01', '2026-09-01', '2026-09-01')`),
    false,
  );

  const { rows: expRows } = await q(
    `insert into experiences (titre, hypothese, famille, indicateur, service, property_type,
                              reference_debut, reference_fin, test_debut, test_fin, statut)
     values ('Hausse maisons', 'Le taux d''acceptation tient', 'tarification', 'ca_horaire',
             'fin_de_chantier', 'maison',
             (current_date - 180), (current_date - 90), (current_date - 90), current_date, 'en_cours')
     returning id`,
  );
  const expId = expRows[0].id;

  const mesures = (await q('select * from mesurer_experience($1)', [expId])).rows;
  if (Array.isArray(mesures)) {
    console.log(
      `  ok     mesure d'expérience exécutable (${mesures.length} période(s) trouvée(s))`,
    );
    ok++;
  } else {
    console.log('  ECHEC  mesure impossible');
    ko++;
  }

  // La mesure exclut les checklists suspectes, comme partout ailleurs.
  const sqlMesure = (await q(`select prosrc from pg_proc where proname = 'mesurer_experience'`))
    .rows[0].prosrc;
  if (sqlMesure.includes('checklist_suspecte')) {
    console.log('  ok     les chantiers à checklist suspecte sont exclus de la mesure');
    ok++;
  } else {
    console.log('  ECHEC  checklists suspectes non exclues');
    ko++;
  }

  // --- Vues ----------------------------------------------------------------
  console.log('\nVues intelligence');
  let vuesIntelOk = true;
  for (const v of ['saisonnalite', 'volume_par_segment']) {
    try {
      await q(`select * from ${v} limit 1`);
    } catch (e) {
      console.log(`  ECHEC  ${v} :`, e.message);
      vuesIntelOk = false;
      ko++;
    }
  }
  if (vuesIntelOk) {
    console.log('  ok     saisonnalité et volume par segment répondent');
    ok++;
  }

  const volumes = (await q('select * from volume_par_segment')).rows;
  if (volumes.every((v) => Number(v.jours_couverts) >= 1)) {
    console.log('  ok     jours_couverts toujours ≥ 1 — pas de division par zéro');
    ok++;
  } else {
    console.log('  ECHEC  jours_couverts nul détecté');
    ko++;
  }

  // --- Sprint 8 : Playbook -------------------------------------------------
  console.log('\nPlaybook — modèles et boucle fermée');

  const modeles = (await q('select count(*)::int n from playbook_modeles where actif')).rows[0]
    .n;
  if (Number(modeles) === 5) {
    console.log('  ok     5 playbooks réutilisables disponibles');
    ok++;
  } else {
    console.log('  ECHEC  playbooks :', modeles);
    ko++;
  }

  const avecPrerequis = (
    await q('select count(*)::int n from playbook_modeles where cardinality(prerequis) > 0')
  ).rows[0].n;
  if (Number(avecPrerequis) >= 4) {
    console.log('  ok     les playbooks portent leurs prérequis');
    ok++;
  } else {
    console.log('  ECHEC  playbooks sans prérequis');
    ko++;
  }

  await should(
    'une décision finale sans date est refusée',
    () =>
      q(`insert into experiences (titre, hypothese, famille, decision,
                                      reference_debut, reference_fin, test_debut)
             values ('X', 'H', 'tarification', 'generaliser',
                     '2026-06-01', '2026-09-01', '2026-09-01')`),
    false,
  );

  const { rows: expPB } = await q(
    `insert into experiences (titre, hypothese, famille, indicateur, modele_code,
                              recommandation_code, intervention,
                              reference_debut, reference_fin, test_debut, test_fin,
                              statut, decision, decide_le, conclusion, valeur_annuelle)
     values ('Hausse maisons', 'Le volume tient', 'tarification', 'ca_horaire',
             'hausse_tarifaire', 'tarif:x', '+8 %',
             (current_date - 180), (current_date - 90), (current_date - 90), current_date,
             'terminee', 'generaliser', now(), 'CA horaire +11 %, volume stable.', 4200)
     returning id`,
  );

  // --- Valeur creee : seules les generalisations comptent ------------------
  console.log('\nValeur créée — seules les généralisations comptent');

  await q(
    `insert into experiences (titre, hypothese, famille, reference_debut, reference_fin,
                              test_debut, test_fin, statut, decision, decide_le,
                              conclusion, valeur_annuelle)
     values ('Test arrêté', 'H', 'planning', (current_date - 180), (current_date - 90),
             (current_date - 90), current_date, 'terminee', 'arreter', now(),
             'Aucun effet.', 9999)`,
  );

  const valeur = (await q('select * from valeur_creee limit 1')).rows[0];
  if (Number(valeur.valeur_annuelle) === 4200 && Number(valeur.generalisees) === 1) {
    console.log(
      '  ok     la valeur d’une expérience arrêtée n’est PAS comptabilisée',
      `${valeur.valeur_annuelle} €`,
    );
    ok++;
  } else {
    console.log('  ECHEC  valeur créée', valeur);
    ko++;
  }

  if (Number(valeur.arretees) === 1 && Number(valeur.experiences_tranchees) === 2) {
    console.log('  ok     les expériences arrêtées sont comptées, sans valeur');
    ok++;
  } else {
    console.log('  ECHEC  comptage', valeur);
    ko++;
  }

  // --- Memoire d'entreprise ------------------------------------------------
  console.log('\nMémoire d’entreprise');
  const memoire = (await q('select * from memoire_entreprise')).rows;
  const ligne = memoire.find((m) => m.id === expPB[0].id);
  if (ligne && ligne.modele === 'Hausse tarifaire ciblée' && ligne.intervention === '+8 %') {
    console.log('  ok     chaque expérience close laisse un récit relisible');
    ok++;
  } else {
    console.log('  ECHEC  mémoire', ligne);
    ko++;
  }

  const enCours = memoire.filter((m) => m.decision === 'en_attente' && !m.decide_le);
  if (enCours.length === 0) {
    console.log('  ok     seules les expériences closes entrent dans la mémoire');
    ok++;
  } else {
    console.log('  ECHEC  expériences non closes dans la mémoire :', enCours.length);
    ko++;
  }

  // --- Statut reporte ------------------------------------------------------
  console.log('\nReport de décision');
  await should(
    'une recommandation peut être reportée',
    () =>
      q(`insert into recommandations (code, famille, statut, titre, action, reportee_au, decide_le)
             values ('t:report', 'prospection', 'reportee', 'T', 'A', current_date + 30, now())`),
    true,
  );

  const decisions = (await q('select * from decisions_par_annee limit 1')).rows[0];
  if (decisions && Number(decisions.reportees) >= 1) {
    console.log('  ok     les reports sont comptés séparément des rejets');
    ok++;
  } else {
    console.log('  ECHEC  decisions_par_annee', decisions);
    ko++;
  }

  // --- RLS -----------------------------------------------------------------
  console.log('\nRLS');
  const sansRls = (
    await q(`select t.tablename from pg_tables t join pg_class c on c.relname = t.tablename
             where t.schemaname='public' and not c.relrowsecurity`)
  ).rows;
  if (sansRls.length === 0) {
    console.log('  ok     RLS active sur toutes les tables publiques');
    ok++;
  } else {
    console.log('  ECHEC  sans RLS :', sansRls.map((r) => r.tablename).join(', '));
    ko++;
  }
  const pol = (await q(`select count(*)::int n from pg_policies where schemaname='public'`))
    .rows[0].n;
  console.log(`         ${pol} politiques`);
} finally {
  // Tout est annule : ce script ne laisse aucune trace en base.
  await q('rollback');
  await c.end();
}

console.log(`\n=== ${ok} verifications passees, ${ko} echec(s) ===`);
process.exit(ko > 0 ? 1 : 0);
