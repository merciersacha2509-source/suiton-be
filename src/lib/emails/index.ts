import 'server-only';
import { capturer, modeCapture } from '@/lib/emails/capture';
import { Resend } from 'resend';
import { serverEnv } from '@/lib/env';
import { gabaritEmail, texteEmail, type Rappel } from '@/lib/emails/gabarit';

/**
 * Courriers transactionnels SUITON.
 *
 * Deux regles absolues :
 *
 * 1. UN ENVOI QUI ECHOUE N'ANNULE JAMAIS L'OPERATION METIER. Un client dont
 *    la facture est emise mais qui n'a pas recu l'e-mail peut etre rappele ;
 *    une facture qui n'existe pas parce que Resend etait en panne, non.
 *    Toutes ces fonctions renvoient donc un resultat, jamais une exception.
 *
 * 2. LE DOCUMENT EST JOINT. Un lien signe expire ; une piece jointe reste
 *    dans la boite du client pour toujours. Le lien accompagne la piece
 *    jointe, il ne la remplace pas.
 */

export interface ResultatEnvoi {
  envoye: boolean;
  id?: string;
  erreur?: string;
}

export interface PieceJointe {
  nom: string;
  contenu: Buffer;
}

interface Envoi {
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
  pieces?: PieceJointe[];
}

async function envoyer(e: Envoi): Promise<ResultatEnvoi> {
  // EMAIL_MODE=preview : le courriel est ecrit sur disque, avec le nom de ses
  // pieces jointes. Le PDF lui-meme n'est pas duplique — il est deja dans le
  // registre documentaire, et la question a verifier ici est « le bon document
  // est-il joint au bon message ? », pas son contenu.
  if (modeCapture()) {
    return capturer({
      destinataire: e.destinataire,
      sujet: e.sujet,
      html: e.html,
      texte: e.texte,
      piecesJointes: (e.pieces ?? []).map((p) => `${p.nom} (${(p.contenu.length / 1024).toFixed(0)} ko)`),
    });
  }

  const cle = serverEnv().RESEND_API_KEY;

  if (!cle) {
    // Sans cle, on trace en console : en developpement on veut voir passer
    // les liens de portail sans configurer Resend.
    console.info(
      `[email] (non configuré) à=${e.destinataire} sujet="${e.sujet}" pièces=${e.pieces?.length ?? 0}\n${e.texte}`,
    );
    return { envoye: false, erreur: 'RESEND_API_KEY absente' };
  }

  try {
    const { data, error } = await new Resend(cle).emails.send({
      from: serverEnv().RESEND_FROM,
      to: e.destinataire,
      subject: e.sujet,
      html: e.html,
      text: e.texte,
      attachments: e.pieces?.map((p) => ({ filename: p.nom, content: p.contenu })),
    });

    if (error) return { envoye: false, erreur: error.message };
    return { envoye: true, id: data?.id };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'erreur inconnue';
    console.error('[email] échec', message);
    return { envoye: false, erreur: message };
  }
}

const prenomDe = (nom: string) => nom.split(' ')[0] ?? nom;

/* ==========================================================================
 * 1 — Envoi du devis
 * ======================================================================== */

export async function emailDevis(p: {
  email: string;
  nom: string;
  numero: string;
  montant: string;
  validiteJours: number;
  valideJusquAu: string;
  acompte: string | null;
  urlPortail: string;
  pdf?: Buffer;
}): Promise<ResultatEnvoi> {
  const rappels: Rappel[] = [
    { libelle: 'Devis', valeur: p.numero },
    { libelle: 'Montant', valeur: p.montant, fort: true },
    { libelle: 'Valable jusqu’au', valeur: p.valideJusquAu },
  ];
  if (p.acompte) rappels.push({ libelle: 'Acompte à la commande', valeur: p.acompte });

  return envoyer({
    destinataire: p.email,
    sujet: `Votre devis ${p.numero} — SUITON`,
    html: gabaritEmail({
      titre: 'Votre devis est prêt',
      corps: `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Voici votre devis. Il est joint à cet e-mail, et vous pouvez aussi l’accepter en ligne depuis votre dossier — c’est plus rapide qu’un scan.</p>`,
      rappels,
      encadre: {
        titre: 'Compris dans ce prix',
        texte:
          'Vitres et châssis — jamais en supplément. Rapport photo avant/après remis à la fin du chantier. Garantie retouche 48 h : un point non conforme est repris sans frais.',
      },
      bouton: { libelle: 'Voir et accepter le devis', url: p.urlPortail },
      postScriptum:
        'Une question, un point à ajuster ? Répondez simplement à cet e-mail, ou appelez le 0489 21 01 24.',
    }),
    texte: texteEmail({
      salutation: `Bonjour ${prenomDe(p.nom)},`,
      corps: [
        `Votre devis ${p.numero} est prêt : ${p.montant}.`,
        `Valable ${p.validiteJours} jours, jusqu’au ${p.valideJusquAu}.`,
        'Vitres et châssis compris, rapport photo avant/après, garantie retouche 48 h.',
      ],
      rappels,
      lien: { libelle: 'Voir et accepter en ligne', url: p.urlPortail },
    }),
    pieces: p.pdf ? [{ nom: `Devis ${p.numero} - SUITON.pdf`, contenu: p.pdf }] : undefined,
  });
}

/* ==========================================================================
 * 2 — Rappel de devis
 * ======================================================================== */

export async function emailRappelDevis(p: {
  email: string;
  nom: string;
  numero: string;
  montant: string;
  valideJusquAu: string;
  joursRestants: number;
  urlPortail: string;
}): Promise<ResultatEnvoi> {
  // Le ton change avec l'urgence. Une relance a J+2 qui parle d'expiration
  // est agressive ; une relance a J-3 qui n'en parle pas est inutile.
  const urgent = p.joursRestants <= 5;

  const corps = urgent
    ? `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Votre devis ${p.numero} expire dans ${p.joursRestants} jour${p.joursRestants > 1 ? 's' : ''}. Passé cette date, nous devrons le réémettre aux conditions du moment.</p>
<p>Si le projet a été reporté ou confié ailleurs, dites-le-nous en une ligne : cela nous évite de vous relancer.</p>`
    : `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Je reviens vers vous au sujet du devis ${p.numero}. Il reste valable jusqu’au ${p.valideJusquAu}.</p>
<p>Un point à ajuster, une date à caler ? Répondez à cet e-mail, on s’adapte.</p>`;

  return envoyer({
    destinataire: p.email,
    sujet: urgent
      ? `Votre devis ${p.numero} expire bientôt`
      : `Votre devis ${p.numero} — SUITON`,
    html: gabaritEmail({
      titre: urgent ? 'Votre devis arrive à échéance' : 'Où en êtes-vous ?',
      corps,
      rappels: [
        { libelle: 'Devis', valeur: p.numero },
        { libelle: 'Montant', valeur: p.montant, fort: true },
        { libelle: 'Valable jusqu’au', valeur: p.valideJusquAu, fort: urgent },
      ],
      bouton: { libelle: 'Accepter en ligne', url: p.urlPortail },
    }),
    texte: texteEmail({
      salutation: `Bonjour ${prenomDe(p.nom)},`,
      corps: [
        `Votre devis ${p.numero} (${p.montant}) reste valable jusqu’au ${p.valideJusquAu}.`,
        urgent
          ? `Il expire dans ${p.joursRestants} jour(s).`
          : 'Un point à ajuster ? Répondez à cet e-mail.',
      ],
      lien: { libelle: 'Accepter en ligne', url: p.urlPortail },
    }),
  });
}

/* ==========================================================================
 * 3 — Confirmation de chantier
 * ======================================================================== */

export async function emailConfirmationChantier(p: {
  email: string;
  nom: string;
  reference: string;
  quand: string;
  adresse: string;
  dureeEstimee: string;
  urlPortail: string;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: p.email,
    sujet: `Intervention confirmée — ${p.quand}`,
    html: gabaritEmail({
      titre: 'C’est confirmé',
      corps: `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Votre intervention est calée. Nous vous préviendrons la veille, puis le matin même quand nous prendrons la route.</p>`,
      rappels: [
        { libelle: 'Quand', valeur: p.quand, fort: true },
        { libelle: 'Où', valeur: p.adresse },
        { libelle: 'Durée estimée', valeur: p.dureeEstimee },
        { libelle: 'Référence', valeur: p.reference },
      ],
      encadre: {
        titre: 'Ce dont nous avons besoin',
        texte:
          'Un accès au bâtiment et un point d’eau. Si l’accès demande une clé, un code ou une présence, indiquez-le-nous depuis votre dossier — cela nous évite un déplacement pour rien.',
      },
      bouton: { libelle: 'Voir mon dossier', url: p.urlPortail },
      postScriptum:
        'Besoin de décaler ? Appelez le 0489 21 01 24. Sans frais tant que c’est plus de 48 h à l’avance.',
    }),
    texte: texteEmail({
      salutation: `Bonjour ${prenomDe(p.nom)},`,
      corps: ['Votre intervention est confirmée.'],
      rappels: [
        { libelle: 'Quand', valeur: p.quand },
        { libelle: 'Où', valeur: p.adresse },
        { libelle: 'Durée estimée', valeur: p.dureeEstimee },
      ],
      lien: { libelle: 'Votre dossier', url: p.urlPortail },
    }),
  });
}

/* ==========================================================================
 * 4 — Rapport disponible
 * ======================================================================== */

export async function emailRapport(p: {
  email: string;
  nom: string;
  numero: string;
  reference: string;
  comparaisons: number;
  garantieJusquAu: string;
  urlPortail: string;
  pdf?: Buffer;
  attestationPdf?: Buffer;
  attestationNumero?: string;
}): Promise<ResultatEnvoi> {
  const pieces: PieceJointe[] = [];
  if (p.pdf) pieces.push({ nom: `Rapport ${p.numero} - SUITON.pdf`, contenu: p.pdf });
  if (p.attestationPdf && p.attestationNumero) {
    pieces.push({
      nom: `Attestation ${p.attestationNumero} - SUITON.pdf`,
      contenu: p.attestationPdf,
    });
  }

  return envoyer({
    destinataire: p.email,
    sujet: `Votre chantier est terminé — rapport ${p.numero}`,
    html: gabaritEmail({
      titre: 'Votre chantier est terminé',
      corps: `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Le rapport est joint à cet e-mail : la procédure suivie étape par étape, avec l’heure de chacune${
        p.comparaisons > 0
          ? `, ${p.comparaisons} comparaison${p.comparaisons > 1 ? 's' : ''} avant/après`
          : ''
      }, et nos observations sur l’état du bien.</p>
<p>L’attestation de fin de chantier est également jointe : elle vous sert si vous devez justifier la prestation auprès d’un tiers.</p>`,
      rappels: [
        { libelle: 'Rapport', valeur: p.numero },
        { libelle: 'Chantier', valeur: p.reference },
        { libelle: 'Garantie jusqu’au', valeur: p.garantieJusquAu, fort: true },
      ],
      encadre: {
        titre: 'Garantie retouche 48 heures',
        texte:
          'Un point ne vous convient pas ? Signalez-le avant la date ci-dessus : nous repassons sans frais et sans discussion. Un appel au 0489 21 01 24 suffit.',
      },
      bouton: { libelle: 'Voir mon dossier', url: p.urlPortail },
    }),
    texte: texteEmail({
      salutation: `Bonjour ${prenomDe(p.nom)},`,
      corps: [
        `Votre chantier est terminé. Rapport ${p.numero} en pièce jointe.`,
        `Garantie retouche 48 h : un point non conforme est repris sans frais, jusqu’au ${p.garantieJusquAu}.`,
      ],
      lien: { libelle: 'Votre dossier', url: p.urlPortail },
    }),
    pieces: pieces.length > 0 ? pieces : undefined,
  });
}

/* ==========================================================================
 * 5 — Facture
 * ======================================================================== */

export async function emailFacture(p: {
  email: string;
  nom: string;
  numero: string;
  montant: string;
  echeance: string;
  communication: string;
  iban: string;
  autoliquidation: boolean;
  urlPortail: string;
  pdf?: Buffer;
}): Promise<ResultatEnvoi> {
  const rappels: Rappel[] = [
    { libelle: 'Facture', valeur: p.numero },
    { libelle: 'Montant', valeur: p.montant, fort: true },
    { libelle: 'À régler pour le', valeur: p.echeance, fort: true },
    { libelle: 'IBAN', valeur: p.iban || '—' },
    { libelle: 'Communication', valeur: p.communication, fort: true },
  ];

  return envoyer({
    destinataire: p.email,
    sujet: `Facture ${p.numero} — SUITON`,
    html: gabaritEmail({
      titre: 'Votre facture',
      corps: `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Voici la facture de votre chantier, jointe à cet e-mail.</p>
<p>Merci de reprendre la <strong>communication structurée</strong> telle quelle dans votre virement : c’est elle qui nous permet de rapprocher votre paiement automatiquement, sans relance inutile de notre part.</p>${
        p.autoliquidation
          ? '<p>TVA en autoliquidation : elle est à déclarer par vos soins, conformément à l’article 20 de l’AR n° 1.</p>'
          : ''
      }`,
      rappels,
      bouton: { libelle: 'Voir mon dossier', url: p.urlPortail },
      postScriptum:
        'Une question sur cette facture ? Répondez à cet e-mail, nous vous répondons sous 24 h ouvrées.',
    }),
    texte: texteEmail({
      salutation: `Bonjour ${prenomDe(p.nom)},`,
      corps: [
        `Facture ${p.numero} : ${p.montant}, à régler pour le ${p.echeance}.`,
        'Merci de reprendre la communication structurée telle quelle dans votre virement.',
      ],
      rappels,
      lien: { libelle: 'Votre dossier', url: p.urlPortail },
    }),
    pieces: p.pdf ? [{ nom: `Facture ${p.numero} - SUITON.pdf`, contenu: p.pdf }] : undefined,
  });
}

/* ==========================================================================
 * 6 — Demande d'avis
 * ==========================================================================
 * AUCUNE condition de satisfaction. Tous les chantiers clos sont sollicites,
 * a la meme echeance, avec le meme message. Filtrer selon la satisfaction
 * presumee est du « review gating » : Google le sanctionne par le retrait
 * retroactif des avis existants.
 * ======================================================================== */

export async function emailDemandeAvis(p: {
  email: string;
  nom: string;
  reference: string;
  urlAvis: string;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: p.email,
    sujet: 'Deux minutes pour nous aider ?',
    html: gabaritEmail({
      titre: 'Votre avis compte',
      corps: `<p>Bonjour ${prenomDe(p.nom)},</p>
<p>Nous sommes une jeune entreprise : chaque avis pèse lourd pour nous, bien plus que pour une société installée depuis vingt ans.</p>
<p>Si le résultat vous a convenu, deux minutes suffisent. Si quelque chose n’allait pas, dites-le-nous d’abord — nous préférons corriger que d’être notés sur une erreur que nous pouvions réparer.</p>`,
      bouton: { libelle: 'Laisser un avis', url: p.urlAvis },
      postScriptum: 'Vous préférez ne pas ? Aucun souci, nous n’en reparlerons pas.',
    }),
    texte: texteEmail({
      salutation: `Bonjour ${prenomDe(p.nom)},`,
      corps: [
        'Si le résultat vous a convenu, un avis nous aiderait beaucoup.',
        'Si quelque chose n’allait pas, dites-le-nous d’abord : nous préférons corriger.',
      ],
      lien: { libelle: 'Laisser un avis', url: p.urlAvis },
    }),
  });
}

/* ==========================================================================
 * Interne
 * ======================================================================== */

export async function emailInterne(p: {
  sujet: string;
  titre: string;
  corps: string;
  rappels?: Rappel[];
  bouton?: { libelle: string; url: string };
}): Promise<ResultatEnvoi> {
  const destinataire = serverEnv().NOTIFY_EMAIL;
  if (!destinataire) return { envoye: false, erreur: 'NOTIFY_EMAIL absente' };

  return envoyer({
    destinataire,
    sujet: `[SUITON OS] ${p.sujet}`,
    html: gabaritEmail({
      titre: p.titre,
      corps: p.corps,
      rappels: p.rappels,
      bouton: p.bouton,
    }),
    texte: texteEmail({ salutation: p.titre, corps: [p.corps.replace(/<[^>]+>/g, '')] }),
  });
}
