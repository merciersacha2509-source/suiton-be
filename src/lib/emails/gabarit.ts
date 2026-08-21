import { COULEURS as C } from '@/lib/pdf/tokens';

/**
 * Gabarit d'e-mail SUITON.
 *
 * Tableaux et styles en ligne : c'est laid a lire, mais c'est ce que les
 * clients de messagerie savent rendre. Aucune image distante, aucune police
 * externe — les deux sont bloquees par defaut chez la plupart, et un e-mail
 * qui s'affiche cassé vaut moins qu'un e-mail sobre.
 *
 * La police d'ecran est la pile systeme : Jura et Inter ne sont pas
 * disponibles dans une boite mail. L'identite tient donc aux couleurs, a
 * l'interlettrage du mot-marque et a la structure — pas aux polices.
 */

export interface Bouton {
  libelle: string;
  url: string;
}

export interface Rappel {
  libelle: string;
  valeur: string;
  /** Mise en avant : montant, date d'echeance, communication structuree. */
  fort?: boolean;
}

const PILE = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif';

function rappels(items: Rappel[]): string {
  if (items.length === 0) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse">
${items
  .map(
    (r) => `<tr>
<td style="padding:7px 12px;background:${C.mineral};border-bottom:1px solid #fff;font-size:13px;color:${C.ardoise};width:44%">${r.libelle}</td>
<td style="padding:7px 12px;background:${C.mineral};border-bottom:1px solid #fff;font-size:${r.fort ? '15px;font-weight:600' : '13px'};color:${C.abysse}">${r.valeur}</td>
</tr>`,
  )
  .join('\n')}
</table>`;
}

export function gabaritEmail(params: {
  titre: string;
  corps: string;
  bouton?: Bouton;
  rappels?: Rappel[];
  /** Encadre aqua sous le corps : garantie, promesse, information clef. */
  encadre?: { titre: string; texte: string };
  postScriptum?: string;
}): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:${C.mineral};font-family:${PILE};color:${C.abysse}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${C.mineralSombre};border-radius:8px;border-collapse:separate">

<tr><td style="padding:20px 24px;border-bottom:1px solid ${C.mineralSombre}">
<span style="font-size:17px;font-weight:600;letter-spacing:.22em;color:${C.abysse}">SUITON</span>
<span style="font-size:11px;color:${C.ardoise};letter-spacing:.04em"> &nbsp;·&nbsp; Nettoyage professionnel</span>
</td></tr>

<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:18px;font-weight:600;color:${C.abysse}">${params.titre}</h1>
<div style="font-size:14px;line-height:1.65;color:${C.abysse}">${params.corps}</div>
${rappels(params.rappels ?? [])}
${
  params.encadre
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr>
<td style="border-left:3px solid ${C.aquaDeep};background:${C.aquaWash};padding:12px 14px">
<div style="font-size:13px;font-weight:600;color:${C.abysse};margin-bottom:4px">${params.encadre.titre}</div>
<div style="font-size:13px;line-height:1.55;color:${C.abysse}">${params.encadre.texte}</div>
</td></tr></table>`
    : ''
}
${
  params.bouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td style="background:${C.abysse};border-radius:8px">
<a href="${params.bouton.url}" style="display:inline-block;padding:13px 24px;color:${C.mineral};text-decoration:none;font-size:14px;font-weight:500">${params.bouton.libelle}</a>
</td></tr></table>
<p style="margin:10px 0 0;font-size:11px;color:${C.ardoise};word-break:break-all">${params.bouton.url}</p>`
    : ''
}
${params.postScriptum ? `<p style="margin:18px 0 0;font-size:13px;color:${C.ardoise};line-height:1.6">${params.postScriptum}</p>` : ''}
</td></tr>

<tr><td style="padding:16px 24px;border-top:1px solid ${C.mineralSombre};font-size:11px;line-height:1.6;color:${C.ardoise}">
SUITON · Rue Boussart 7, 7850 Enghien · TVA BE1040784957<br>
0489 21 01 24 · suiton.detailing@gmail.com
</td></tr>

</table></body></html>`;
}

/** Version texte. Certains clients ne rendent que celle-ci, et les filtres
 *  anti-spam penalisent un e-mail HTML sans equivalent texte. */
export function texteEmail(params: {
  salutation: string;
  corps: string[];
  rappels?: Rappel[];
  lien?: { libelle: string; url: string };
}): string {
  const lignes = [params.salutation, '', ...params.corps];

  if (params.rappels?.length) {
    lignes.push('');
    for (const r of params.rappels) lignes.push(`${r.libelle} : ${r.valeur}`);
  }

  if (params.lien) {
    lignes.push('', `${params.lien.libelle} : ${params.lien.url}`);
  }

  lignes.push('', 'SUITON · 0489 21 01 24 · suiton.detailing@gmail.com');
  return lignes.join('\n');
}
