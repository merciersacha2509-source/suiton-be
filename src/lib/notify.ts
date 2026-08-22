import 'server-only';
import { Resend } from 'resend';
import { publicEnv, serverEnv } from '@/lib/env';
import { capturer, modeCapture } from '@/lib/emails/capture';

/**
 * Notifications restantes : accuse de reception, confirmation d'intervention
 * et alertes internes.
 *
 * Les courriers porteurs d'un document (devis, rapport, facture) vivent dans
 * `lib/emails/` : ils y joignent le PDF, ce qui exige le registre
 * documentaire et n'a donc rien a faire ici.
 *
 * Courriers transactionnels.
 *
 * Regle unique : un envoi qui echoue ne fait JAMAIS echouer l'operation
 * metier. Un client dont la reservation est enregistree mais qui ne recoit
 * pas l'accuse de reception peut etre rappele ; un client dont la
 * reservation a echoue parce que Resend etait en panne est perdu.
 *
 * Tous les envois renvoient donc un resultat, jamais une exception.
 */

export interface ResultatEnvoi {
  envoye: boolean;
  id?: string;
  erreur?: string;
}

function client(): Resend | null {
  const cle = serverEnv().RESEND_API_KEY;
  return cle ? new Resend(cle) : null;
}

async function envoyer(
  destinataire: string,
  sujet: string,
  html: string,
  texte: string,
): Promise<ResultatEnvoi> {
  // EMAIL_MODE=preview : rien ne part. Ce test vient AVANT la lecture de la
  // cle Resend, volontairement — une cle presente dans un .env.local ne doit
  // pas suffire a envoyer un courriel depuis une machine de developpement.
  if (modeCapture()) {
    return capturer({ destinataire, sujet, html, texte });
  }

  const resend = client();

  if (!resend) {
    // Sans cle, on trace le courrier en console : en developpement, on veut
    // voir passer le lien de portail sans configurer Resend.
    console.info(`[notify] (non configure) a=${destinataire} sujet="${sujet}"\n${texte}`);
    return { envoye: false, erreur: 'RESEND_API_KEY absente' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: serverEnv().RESEND_FROM,
      to: destinataire,
      subject: sujet,
      html,
      text: texte,
    });
    if (error) return { envoye: false, erreur: error.message };
    return { envoye: true, id: data?.id };
  } catch (e) {
    const erreur = e instanceof Error ? e.message : 'erreur inconnue';
    console.error('[notify] echec', erreur);
    return { envoye: false, erreur };
  }
}

/* --------------------------------------------------------------------------
 * Gabarit
 * --------------------------------------------------------------------------
 * Tableaux et styles en ligne : c'est laid a lire, mais c'est ce que les
 * clients de messagerie savent rendre. Aucune image distante, aucune police
 * externe — les deux sont bloquees par defaut chez la plupart.
 * ------------------------------------------------------------------------ */
function gabarit(titre: string, corps: string, cta?: { libelle: string; url: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#F4F6F5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B2239">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E2E7E6;border-radius:8px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #E2E7E6">
<span style="font-size:17px;font-weight:600;letter-spacing:.22em">SUITON</span>
</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:18px;font-weight:600">${titre}</h1>
<div style="font-size:14px;line-height:1.65">${corps}</div>
${
  cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td style="background:#0B2239;border-radius:8px">
<a href="${cta.url}" style="display:inline-block;padding:12px 22px;color:#F4F6F5;text-decoration:none;font-size:14px;font-weight:500">${cta.libelle}</a>
</td></tr></table>
<p style="margin-top:14px;font-size:12px;color:#64748B;word-break:break-all">${cta.url}</p>`
    : ''
}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #E2E7E6;font-size:12px;color:#64748B">
SUITON · Rue Boussart 7, 7850 Enghien · TVA BE1040784957<br>0489 21 01 24 · suiton.detailing@gmail.com
</td></tr></table></body></html>`;
}

/* -------------------------------------------------------------------------- */

export async function accuseReception(params: {
  email: string;
  prenom: string;
  reference: string;
  urlPortail: string;
  delaiHeures: number;
}): Promise<ResultatEnvoi> {
  const corps = `<p>Bonjour ${params.prenom},</p>
<p>Votre demande est enregistrée sous la référence <strong>${params.reference}</strong>.</p>
<p>Vous recevez votre devis sous ${params.delaiHeures} heures ouvrées. En attendant, le lien ci-dessous vous donne accès à votre dossier : il reste valable et se met à jour à chaque étape.</p>`;

  const texte = `Bonjour ${params.prenom},

Votre demande est enregistrée sous la référence ${params.reference}.
Vous recevez votre devis sous ${params.delaiHeures} heures ouvrées.

Suivre votre dossier : ${params.urlPortail}

SUITON · 0489 21 01 24`;

  return envoyer(
    params.email,
    `Votre demande ${params.reference} — SUITON`,
    gabarit('Demande bien reçue', corps, {
      libelle: 'Suivre mon dossier',
      url: params.urlPortail,
    }),
    texte,
  );
}

export async function confirmationIntervention(params: {
  email: string;
  prenom: string;
  reference: string;
  quand: string;
  adresse: string;
  urlPortail: string;
}): Promise<ResultatEnvoi> {
  const corps = `<p>Bonjour ${params.prenom},</p>
<p>Votre intervention est confirmée.</p>
<p><strong>${params.quand}</strong><br>${params.adresse}</p>
<p>Vous recevrez un rappel la veille. Si vous devez décaler, faites-le depuis votre dossier.</p>`;

  const texte = `Bonjour ${params.prenom},

Intervention confirmée : ${params.quand}
${params.adresse}

Votre dossier : ${params.urlPortail}

SUITON · 0489 21 01 24`;

  return envoyer(
    params.email,
    `Intervention confirmée — ${params.reference}`,
    gabarit('Intervention confirmée', corps, {
      libelle: 'Voir mon dossier',
      url: params.urlPortail,
    }),
    texte,
  );
}

/**
 * Notification interne. Elle contient tout ce qui permet de decider s'il
 * faut rappeler tout de suite : c'est ce qu'on lit sur un telephone en
 * trente secondes.
 */
export async function notifierInterne(params: {
  reference: string;
  bande: string;
  score: number;
  service: string;
  commune: string;
  surface: number;
  estimation: string;
  urgent: boolean;
  nom: string;
  telephone: string;
  email: string;
  jobId: string;
}): Promise<ResultatEnvoi> {
  const destinataire = serverEnv().NOTIFY_EMAIL;
  if (!destinataire) return { envoye: false, erreur: 'NOTIFY_EMAIL absente' };

  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}/chantiers/${params.jobId}`;
  const priorite =
    params.bande === 'A+' || params.bande === 'A' ? ' — À RAPPELER SOUS 2 H' : '';

  const corps = `<p><strong>${params.reference}</strong> · bande ${params.bande} (${params.score})${params.urgent ? ' · <strong>URGENT</strong>' : ''}</p>
<p>${params.service} · ${params.surface} m² · ${params.commune}<br>Estimation ${params.estimation}</p>
<p>${params.nom}<br>
<a href="tel:${params.telephone.replace(/\s/g, '')}">${params.telephone}</a><br>
<a href="mailto:${params.email}">${params.email}</a></p>`;

  return envoyer(
    destinataire,
    `${params.bande} · ${params.reference} · ${params.commune}${priorite}`,
    gabarit('Nouvelle demande', corps, { libelle: 'Ouvrir le chantier', url }),
    `${params.reference} · ${params.bande} (${params.score})\n${params.service} ${params.surface} m² ${params.commune}\n${params.estimation}\n${params.nom} ${params.telephone} ${params.email}\n${url}`,
  );
}

/**
 * Demande de rappel depuis la page contact.
 *
 * Le sujet porte le numero de telephone : sur un ecran de telephone, la liste
 * des courriels suffit alors a rappeler, sans ouvrir le message.
 */
export async function notifierRappel(params: {
  nom: string;
  telephone: string;
  message: string;
  ip: string;
}): Promise<ResultatEnvoi> {
  const destinataire = serverEnv().NOTIFY_EMAIL;
  if (!destinataire) return { envoye: false, erreur: 'NOTIFY_EMAIL absente' };

  const tel = params.telephone.replace(/\s/g, '');
  const corps = `<p><strong>${params.nom}</strong><br>
<a href="tel:${tel}">${params.telephone}</a></p>
${params.message ? `<p style="white-space:pre-wrap">${params.message}</p>` : '<p><em>Aucun message.</em></p>'}`;

  return envoyer(
    destinataire,
    `Rappel demandé — ${params.nom} — ${params.telephone}`,
    gabarit('Demande de rappel', corps, { libelle: 'Appeler', url: `tel:${tel}` }),
    `${params.nom}\n${params.telephone}\n\n${params.message || '(aucun message)'}`,
  );
}

/**
 * Demande professionnelle depuis la page /professionnels.
 *
 * Le sujet porte la societe et le type de besoin : c'est ce qui permet de
 * trier "grille annuelle" (a chiffrer) de "devis ponctuel" (a traiter comme
 * une reservation classique) sans ouvrir le message.
 */
export async function notifierDemandePro(params: {
  societe: string;
  contact: string;
  email: string;
  telephone: string;
  besoin: 'ponctuel' | 'annuel';
  chantiersParMois: string;
  surfaceMoyenne: string;
  frequence: string;
  zone: string;
  message: string;
  ip: string;
}): Promise<ResultatEnvoi> {
  const destinataire = serverEnv().NOTIFY_EMAIL;
  if (!destinataire) return { envoye: false, erreur: 'NOTIFY_EMAIL absente' };

  const tel = params.telephone.replace(/\s/g, '');
  const libelleBesoin = params.besoin === 'annuel' ? 'Grille annuelle' : 'Devis ponctuel';

  const lignes: [string, string][] = [
    ['Société', params.societe],
    ['Contact', params.contact],
    ['Besoin', libelleBesoin],
    ['Chantiers / mois', params.chantiersParMois || '—'],
    ['Surface moyenne', params.surfaceMoyenne || '—'],
    ['Fréquence', params.frequence || '—'],
    ['Zone d’intervention', params.zone || '—'],
  ];

  const corps = `<p><strong>${params.societe}</strong> — ${libelleBesoin}</p>
<p>${lignes.map(([k, v]) => `${k} : ${v}`).join('<br>')}</p>
<p><a href="tel:${tel}">${params.telephone}</a> · <a href="mailto:${params.email}">${params.email}</a></p>
${params.message ? `<p style="white-space:pre-wrap">${params.message}</p>` : ''}`;

  return envoyer(
    destinataire,
    `${libelleBesoin} — ${params.societe}`,
    gabarit('Demande professionnelle', corps, { libelle: 'Appeler', url: `tel:${tel}` }),
    `${params.societe} — ${libelleBesoin}\n${lignes.map(([k, v]) => `${k}: ${v}`).join('\n')}\n${params.telephone} ${params.email}\n\n${params.message || '(aucun message)'}`,
  );
}

/** Alerte technique. Volontairement seche : elle sert a reagir, pas a lire. */
export async function alerterPanne(sujet: string, detail: string): Promise<ResultatEnvoi> {
  const destinataire = serverEnv().NOTIFY_EMAIL;
  if (!destinataire) return { envoye: false, erreur: 'NOTIFY_EMAIL absente' };

  return envoyer(
    destinataire,
    `[SUITON OS] ${sujet}`,
    gabarit(
      'Incident technique',
      `<pre style="font-size:12px;white-space:pre-wrap">${detail}</pre>`,
    ),
    `${sujet}\n\n${detail}`,
  );
}
