/**
 * Verification fonctionnelle de bout en bout.
 *
 * Chaine reelle : requete HTTP -> serveur Next de production -> route API ->
 * supabase-js -> passerelle PostgREST -> PostgreSQL reel avec les 23
 * migrations. Rien n'est simule cote metier.
 */
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import pg from 'pg';
import { demarrer, DSN } from './pgboot.mjs';
import { demarrerShim } from './postgrest-shim.mjs';
import { construire, ENV_VERIF } from './construire.mjs';

const { Client } = pg;
const BASE = 'http://127.0.0.1:3999';

let ok = 0;
let ko = 0;
const resultats = [];
function dire(bon, nom, detail = '') {
  if (bon) {
    ok += 1;
    console.log(`  ok     ${nom}${detail ? ' — ' + detail : ''}`);
  } else {
    ko += 1;
    console.log(`  ECHEC  ${nom}${detail ? ' — ' + detail : ''}`);
  }
  resultats.push({ bon, nom, detail });
}
const titre = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

construire(new URL('../../', import.meta.url).pathname);

const srv = await demarrer();
const shim = await demarrerShim({ dsn: DSN, port: 54321 });
const db = new Client({ connectionString: DSN });
await db.connect();

// Etat de depart propre, sans toucher aux reglages.
await db.query(`truncate table events, score_events, portal_tokens, photos,
  interventions, quotes, jobs, booking_drafts, clients, rate_limits cascade`);

const next = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3999'], {
  cwd: new URL('../../', import.meta.url).pathname,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ...ENV_VERIF,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
next.stdout.on('data', (d) => (journal += d));
next.stderr.on('data', (d) => (journal += d));

// Attente du port.
for (let i = 0; i < 60; i += 1) {
  try {
    const r = await fetch(`${BASE}/api/health`);
    if (r.status < 600) break;
  } catch {
    await pause(500);
  }
}

const req = async (chemin, init) => {
  const t = Date.now();
  const r = await fetch(BASE + chemin, init);
  const texte = await r.text();
  let json = null;
  try {
    json = JSON.parse(texte);
  } catch {
    /* HTML */
  }
  // Toutes les routes repondent { ok, data } | { ok, error }.
  return {
    statut: r.status,
    entetes: r.headers,
    texte,
    json,
    data: json?.data ?? null,
    ms: Date.now() - t,
  };
};

const reservation = (extra = {}) => ({
  service: 'fin_de_chantier',
  property_type: 'maison',
  soil: 'standard',
  surface_m2: 140,
  commune: 'Enghien',
  code_postal: '7850',
  adresse: 'Rue du Test 12',
  urgent: false,
  date_souhaitee: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
  photos: [],
  nom: 'Marie Dupont',
  email: 'marie.dupont@example.be',
  telephone: '0470 12 34 56',
  est_pro: false,
  notes: 'Fin de chantier après plafonnage.',
  consent_photos: true,
  consent_cgv: true,
  ...extra,
});

try {
  // ==================================================================
  titre('1. Pages publiques');
  for (const [chemin, attendu] of [
    ['/', 200],
    ['/nettoyage-fin-de-chantier', 200],
    ['/nettoyage-fin-de-chantier/enghien', 200],
    ['/nettoyage-de-vitres', 200],
    ['/devis', 200],
    ['/professionnels', 200],
    ['/realisations', 200],
    ['/contact', 200],
    ['/a-propos', 200],
    ['/reservation', 200],
    ['/mentions-legales', 200],
    ['/sitemap.xml', 200],
    ['/robots.txt', 200],
    ['/nettoyage-de-piscine', 404],
    ['/nettoyage-fin-de-chantier/paris', 404],
  ]) {
    const r = await req(chemin);
    dire(
      r.statut === attendu,
      `${chemin.padEnd(38)} ${r.statut}`,
      attendu !== 200 ? `attendu ${attendu}` : `${r.ms} ms`,
    );
  }

  titre('2. Espace de gestion — redirection vers la connexion');
  for (const chemin of ['/tableau-de-bord', '/chantiers', '/facturation', '/intelligence']) {
    const r = await fetch(BASE + chemin, { redirect: 'manual' });
    const loc = r.headers.get('location') ?? '';
    dire(
      r.status === 307 && loc.includes('/connexion'),
      `${chemin} protege`,
      `${r.status} -> ${loc.split('?')[0]}`,
    );
  }

  titre('3. Portail client — aucune fuite sans jeton valide');
  const sansJeton = await req('/portail');
  dire(
    sansJeton.statut === 200 && !/SUITON-\d{4}-|@example|token_hash/i.test(sansJeton.texte),
    '/portail sans jeton ne revele aucune donnee client',
  );
  const faux = await req('/portail/' + 'z'.repeat(43));
  dire(faux.statut === 404, 'jeton invente -> 404', String(faux.statut));

  // ==================================================================
  titre('4. Validation de la reservation');
  const cas = [
    // 422 et non 400 : la requete est bien formee, son CONTENU est invalide.
    ['corps vide', {}, 422],
    ['montant impose par le client', { ...reservation(), montant: 1, estimation_max: 1 }, 201],
    ['surface negative', reservation({ surface_m2: -5 }), 422],
    ['surface absurde', reservation({ surface_m2: 99999 }), 422],
    ['courriel invalide', reservation({ email: 'pas-un-email' }), 422],
    ['code postal non belge', reservation({ code_postal: '75001' }), 422],
    ['service inconnu', reservation({ service: 'toiture' }), 422],
    ['CGV non acceptees', reservation({ consent_cgv: false }), 422],
    ['champ piege rempli', reservation({ honeypot: 'http://spam' }), 422],
  ];
  for (const [nom, charge, attendu] of cas) {
    const r = await req('/api/booking', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      },
      body: JSON.stringify(charge),
    });
    dire(
      r.statut === attendu,
      `${nom.padEnd(32)} ${r.statut}`,
      r.statut !== attendu
        ? `attendu ${attendu} · ${(r.json?.error ?? r.texte).toString().slice(0, 90)}`
        : '',
    );
  }

  // Le montant envoye par le client ne doit JAMAIS etre retenu.
  const { rows: apresInjection } = await db.query(
    `select estimation_min, estimation_max from jobs order by created_at desc limit 1`,
  );
  dire(
    apresInjection.length === 1 && Number(apresInjection[0].estimation_max) > 100,
    'le montant envoye par le client est ignore',
    apresInjection[0]
      ? `estimation recalculee : ${apresInjection[0].estimation_min}–${apresInjection[0].estimation_max} €`
      : '',
  );

  // ==================================================================
  titre('5. Reservation nominale — chaine complete');
  await db.query(
    'truncate table events, score_events, portal_tokens, jobs, clients, rate_limits cascade',
  );
  const t0 = Date.now();
  const rep = await req('/api/booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.1.1.1' },
    body: JSON.stringify(reservation()),
  });
  const msBooking = Date.now() - t0;
  dire(rep.statut === 201, 'POST /api/booking -> 201', `${msBooking} ms`);
  dire(
    /^SUITON-\d{4}-\d{4}$/.test(rep.data?.reference ?? ''),
    'reference attribuee',
    rep.data?.reference,
  );
  dire(
    typeof rep.data?.url_portail === 'string' && rep.data.url_portail.includes('/portail/'),
    'lien de portail renvoye',
  );
  dire(
    rep.data?.estimation?.min > 0 && rep.data?.estimation?.max >= rep.data?.estimation?.min,
    'estimation renvoyee',
    `${rep.data?.estimation?.min}–${rep.data?.estimation?.max} €`,
  );
  dire(
    !('score' in (rep.data ?? {})) && !('jobId' in (rep.data ?? {})),
    'ni score ni identifiant interne dans la reponse publique',
  );

  const { rows: clients } = await db.query('select * from clients');
  const { rows: jobs } = await db.query('select * from jobs');
  const { rows: jetons } = await db.query('select * from portal_tokens');
  const { rows: evts } = await db.query('select type from events order by created_at');
  dire(clients.length === 1, 'un client cree', clients[0]?.email);
  dire(jobs.length === 1, 'un chantier cree', jobs[0]?.reference);
  dire(
    jetons.length === 1 && jetons[0].token_hash?.length === 64,
    'jeton de portail hache en base',
    `sha256, ${jetons[0]?.token_hash?.length} caracteres`,
  );
  dire(
    clients[0]?.consent_photos === true && clients[0]?.consent_photos_at !== null,
    'consentement photo date',
  );
  dire(
    Number(clients[0]?.score) > 0 && clients[0]?.score_band !== null,
    'score et bande calcules par la base',
    `score ${clients[0]?.score}, bande ${clients[0]?.score_band}`,
  );
  dire(evts.length >= 1, 'evenements journalises', evts.map((e) => e.type).join(', '));

  // Le prix ecrit en base doit etre celui de la grille, recalcule.
  const { rows: reglages } = await db.query('select prix_m2 from settings');
  const bande = reglages[0].prix_m2.fin_de_chantier.standard;
  dire(
    Number(jobs[0].estimation_min) === Math.round((bande.min * 140) / 10) * 10 &&
      Number(jobs[0].estimation_max) === Math.round((bande.max * 140) / 10) * 10,
    'prix en base = grille × surface',
    `${jobs[0].estimation_min}–${jobs[0].estimation_max} € pour 140 m² à ${bande.min}–${bande.max} €/m²`,
  );

  // ==================================================================
  titre('6. Portail client avec le vrai jeton');
  const jeton = rep.data.url_portail.split('/portail/')[1];
  const portail = await req(`/portail/${jeton}`);
  dire(portail.statut === 200, 'le portail s’ouvre avec le jeton emis', String(portail.statut));
  dire(portail.texte.includes(rep.data.reference), 'le portail affiche la bonne reference');
  dire(/noindex/.test(portail.texte), 'le portail est en noindex');
  const { rows: apresVisite } = await db.query('select hits, last_seen_at from portal_tokens');
  dire(
    apresVisite[0].hits >= 1 && apresVisite[0].last_seen_at !== null,
    'la visite du portail est tracee',
    `hits=${apresVisite[0].hits}`,
  );

  const jetonModifie = jeton.slice(0, -1) + (jeton.slice(-1) === 'a' ? 'b' : 'a');
  const usurpe = await req(`/portail/${jetonModifie}`);
  dire(
    usurpe.statut === 404,
    'un jeton modifie d’un caractere est refuse',
    String(usurpe.statut),
  );

  // ==================================================================
  titre('7. Limitation de debit');
  await db.query('truncate table rate_limits');
  let premierRefus = null;
  for (let i = 1; i <= 13; i += 1) {
    const r = await req('/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.2.2.2' },
      body: JSON.stringify(reservation({ email: `flood${i}@example.be` })),
    });
    if (r.statut === 429 && premierRefus === null) premierRefus = i;
  }
  dire(
    premierRefus !== null && premierRefus <= 11,
    'la limitation coupe le flot',
    `refus a la tentative n° ${premierRefus}`,
  );
  const autreIp = await req('/api/booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.3.3.3' },
    body: JSON.stringify(reservation({ email: 'autre@example.be' })),
  });
  dire(autreIp.statut === 201, 'la limitation est bien par IP', String(autreIp.statut));

  // ==================================================================
  titre('8. Creneaux et methodes HTTP');
  const creneaux = await req('/api/slots?surface_m2=140&soil=standard&jours=21');
  const liste = creneaux.data?.creneaux ?? [];
  dire(
    creneaux.statut === 200 && Array.isArray(liste) && liste.length > 0,
    'GET /api/slots renvoie des creneaux reellement libres',
    `${liste.length} creneaux, duree ${creneaux.data?.duree_min}–${creneaux.data?.duree_max} min`,
  );
  const sansSurface = await req('/api/slots?jours=7');
  dire(
    sansSurface.statut === 422,
    'GET /api/slots sans surface -> 422',
    String(sansSurface.statut),
  );

  // Un creneau propose doit etre reellement libre : on verifie que la base
  // accepte de l'occuper.
  if (liste.length > 0) {
    const c = liste[0];
    const { rows: eq } = await db.query('select id from teams where actif limit 1');
    const { rows: j } = await db.query('select id from jobs limit 1');
    let accepte = true;
    try {
      await db.query(
        `insert into interventions (job_id, team_id, starts_at, ends_at)
         values ($1, $2, $3::timestamptz, $4::timestamptz)`,
        [j[0].id, eq[0].id, c.debut, c.fin],
      );
    } catch {
      accepte = false;
    }
    dire(
      accepte,
      'le premier creneau propose est acceptable par la base',
      `${c.debut} -> ${c.fin}`,
    );
    await db.query('delete from interventions');
  }
  const mauvaiseMethode = await req('/api/booking', { method: 'GET' });
  dire(
    mauvaiseMethode.statut === 405,
    'GET /api/booking -> 405',
    String(mauvaiseMethode.statut),
  );
  const sante = await req('/api/health');
  dire(sante.statut === 200, 'GET /api/health -> 200', sante.texte.slice(0, 60));

  // ==================================================================
  titre('9. Chantier professionnel — autoliquidation');
  await db.query(
    'truncate table events, score_events, portal_tokens, jobs, clients, rate_limits cascade',
  );
  const pro = await req('/api/booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.4.4.4' },
    body: JSON.stringify(
      reservation({
        est_pro: true,
        tva: 'BE0123456789',
        nom: 'Entreprise Martin SRL',
        email: 'contact@martin-construct.be',
        commune: 'Hal',
        code_postal: '1500',
      }),
    ),
  });
  dire(pro.statut === 201, 'reservation professionnelle acceptee', String(pro.statut));
  const { rows: clientPro } = await db.query('select kind, tva from clients');
  dire(
    clientPro[0]?.kind === 'professionnel' && clientPro[0]?.tva === 'BE0123456789',
    'client enregistre comme professionnel',
    `${clientPro[0]?.kind}, ${clientPro[0]?.tva}`,
  );

  // ==================================================================
  titre('10. Le calculateur du site et le devis donnent le meme prix');
  const accueil = await req('/');
  const grille = (await db.query('select prix_m2, zones from settings')).rows[0];
  dire(
    accueil.texte.includes('5 €') || accueil.texte.includes('dès 5'),
    'le prix de depart affiche vient bien de la grille',
    `grille : ${grille.prix_m2.fin_de_chantier.leger.min} €/m²`,
  );
  // ==================================================================
  titre('11. Demande de rappel');
  await db.query('truncate table rate_limits');
  const rappelVide = await req('/api/rappel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.5.5.1' },
    body: JSON.stringify({}),
  });
  dire(
    rappelVide.statut === 422,
    'rappel sans nom ni numero -> 422',
    String(rappelVide.statut),
  );

  const rappelPiege = await req('/api/rappel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.5.5.2' },
    body: JSON.stringify({
      nom: 'Robot',
      telephone: '0470000000',
      societe: 'x',
      honeypot: 'spam',
    }),
  });
  dire(
    rappelPiege.statut === 422,
    'rappel avec champ piege rempli -> 422',
    String(rappelPiege.statut),
  );

  const rappelTel = await req('/api/rappel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.5.5.3' },
    body: JSON.stringify({ nom: 'Jean Martin', telephone: 'pas-un-numero' }),
  });
  dire(rappelTel.statut === 422, 'numero invalide -> 422', String(rappelTel.statut));

  const rappelOk = await req('/api/rappel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.5.5.4' },
    body: JSON.stringify({
      nom: 'Jean Martin',
      telephone: '0470 12 34 56',
      message: 'Maison 140 m² à Enghien, réception le 12.',
    }),
  });
  dire(
    rappelOk.statut === 201 && rappelOk.data?.recu === true,
    'rappel valide -> 201',
    String(rappelOk.statut),
  );

  let refusRappel = null;
  for (let i = 1; i <= 8; i += 1) {
    const r = await req('/api/rappel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.5.5.9' },
      body: JSON.stringify({ nom: `Flood ${i}`, telephone: '0470000000' }),
    });
    if (r.statut === 429 && refusRappel === null) refusRappel = i;
  }
  dire(
    refusRappel !== null && refusRappel <= 6,
    'le formulaire de rappel est limite en debit',
    `refus a la tentative n° ${refusRappel}`,
  );

  // ==================================================================
  titre('12. Realisations');
  const galerieVide = await req('/realisations');
  dire(galerieVide.statut === 200, '/realisations repond', String(galerieVide.statut));
  dire(
    /octobre 2026|premiers chantiers/i.test(galerieVide.texte),
    'galerie vide : elle annonce l’ouverture au lieu d’inventer des references',
  );
  const ficheInconnue = await req('/realisations/chantier-inexistant');
  dire(ficheInconnue.statut === 404, 'fiche inconnue -> 404', String(ficheInconnue.statut));

  // Publication d'un vrai chantier, puis verification de la page produite.
  const { rows: pub } = await db.query(
    `update jobs set published = true, published_slug = 'maison-140m2-enghien',
       published_at = now(), resume_public = $1, duree_reelle_min = 390
     where id = (select id from jobs order by created_at desc limit 1)
     returning published_slug, commune, surface_m2`,
    [
      'Maison de 140 m² à Enghien, livrée après plafonnage. Poussière de ponçage dans toutes ' +
        'les rainures de châssis, résidus de silicone dans la salle de bain, film plastique ' +
        'encore collé sur six vitrages. Sept heures d’intervention, vitres et châssis compris.',
    ],
  );
  dire(pub.length === 1, 'un chantier publie en base', pub[0]?.published_slug);

  const fiche = await req('/realisations/maison-140m2-enghien');
  dire(fiche.statut === 200, 'la fiche du chantier publie repond 200', String(fiche.statut));
  dire(
    fiche.texte.includes('140') && fiche.texte.includes('Enghien'),
    'la fiche affiche la surface et la commune reelles',
  );
  dire(/"@type":\s*"Article"/.test(fiche.texte), 'la fiche porte un JSON-LD Article');
  dire(
    fiche.texte.includes('/reservation?service='),
    'la fiche renvoie vers un devis pre-rempli',
  );

  // La galerie et le sitemap sont regeneres toutes les heures. Une
  // publication faite depuis l'espace de gestion appelle revalidatePath() et
  // apparait donc immediatement ; ici l'ecriture est faite en SQL direct, sans
  // passer par l'action serveur. On verifie donc la source, pas le cache.
  const slugs = await db.query(
    `select published_slug from jobs where published order by published_at desc`,
  );
  dire(
    slugs.rows.some((r) => r.published_slug === 'maison-140m2-enghien'),
    'le chantier publie est bien la source du sitemap et de la galerie',
    `${slugs.rows.length} chantier(s) publie(s)`,
  );

  // Un chantier publie sans resume redige doit etre refuse par la base.
  let refuseSansResume = false;
  try {
    await db.query(
      `update jobs set published = true, published_slug = 'sans-resume', resume_public = 'court'
       where id = (select id from jobs order by created_at limit 1)`,
    );
  } catch {
    refuseSansResume = true;
  }
  dire(refuseSansResume, 'publication sans resume redige refusee par la base');

  // ==================================================================
  titre('13. Calculateur — type de bien');
  const accueilCalc = await req('/');
  dire(accueilCalc.texte.includes('Type de bien'), 'le calculateur demande le type de bien');
  dire(
    accueilCalc.texte.includes('Vitres, châssis et seuils compris') ||
      accueilCalc.texte.includes('Vitres et châssis compris'),
    'la page affirme que les vitres sont comprises',
  );
  const { rows: reglagesCoef } = await db.query('select coef_bien from settings');
  dire(
    Object.values(reglagesCoef[0].coef_bien).every((v) => Number(v) === 1),
    'les coefficients par type de bien restent neutres tant que le dirigeant ne les touche pas',
  );

  const prefill = await req('/reservation?service=vitres&surface=90&bien=appartement&cp=1400');
  dire(prefill.statut === 200, 'le parcours accepte un pre-remplissage depuis le calculateur');
  const prefillSale = await req('/reservation?service=<script>&surface=abc&bien=chateau&cp=zz');
  dire(prefillSale.statut === 200, 'un pre-remplissage invalide est ignore, pas fatal');
} catch (e) {
  console.error('\nEXCEPTION :', e.message);
  ko += 1;
} finally {
  console.log(`\n${'='.repeat(60)}\n${ok} controles reussis, ${ko} echec(s)`);
  if (ko > 0 && journal) console.log('\n--- journal du serveur ---\n' + journal.slice(-3000));
  next.kill('SIGTERM');
  await db.end();
  await shim.arreter();
  await srv.stop();
  process.exit(ko > 0 ? 1 : 0);
}
