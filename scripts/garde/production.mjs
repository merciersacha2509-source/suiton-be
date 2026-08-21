#!/usr/bin/env node
/**
 * Garde-fou de production.
 *
 * Ce script est le SEUL point de passage vers une action qui touche
 * suiton.be. Il ne deploie rien : il affiche ce qui serait fait, l'impact,
 * la procedure de retour arriere, et exige une confirmation tapee a la main.
 *
 * POURQUOI UN SCRIPT PLUTOT QU'UNE REGLE ECRITE. Une regle dans un document
 * se contourne par distraction, a 23 h, un vendredi. Une commande qui refuse
 * de s'executer, non. `npm run deploy:prod` n'existe pas : il faut passer
 * par ici, lire, et taper la phrase.
 *
 * Usage :
 *   node scripts/garde/production.mjs <action>
 *
 * Actions connues : deploy, migrate, dns, env
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const PHRASE = 'GO PRODUCTION SUITON';

const ACTIONS = {
  deploy: {
    titre: 'Deploiement en production',
    environnement: 'https://suiton.be — Vercel, environnement Production',
    impact:
      'Remplace la version actuellement servie aux visiteurs. Les pages statiques\n' +
      '  sont regenerees ; les visiteurs en cours de navigation ne sont pas coupes.',
    rollback:
      'vercel ls suiton  puis  vercel promote <url-du-deploiement-precedent>\n' +
      '  Instantane, sans reconstruction. Voir docs/ROLLBACK.md § 1.',
    commande: 'vercel --prod',
  },
  migrate: {
    titre: 'Application de migrations sur la base de production',
    environnement: 'Supabase — projet de production',
    impact:
      'Modifie le schema de la base reelle. Une migration destructive\n' +
      '  (colonne supprimee, type modifie) n\'est PAS annulable par une commande.',
    rollback:
      'Additive : ne rien faire, le code precedent l\'ignore.\n' +
      '  Destructive : restauration d\'une sauvegarde. Voir docs/ROLLBACK.md § 2.',
    commande: 'supabase db push',
    prealable:
      'supabase db dump -f sauvegarde-$(date +%Y%m%d-%H%M).sql --data-only\n' +
      '  supabase db push --dry-run   ← lire la sortie ligne par ligne',
  },
  dns: {
    titre: 'Modification DNS du domaine suiton.be',
    environnement: 'Registrar — enregistrements A et CNAME',
    impact:
      'Un changement DNS rate n\'est PAS rattrapable rapidement : la propagation\n' +
      '  prend de quelques minutes a plusieurs heures. Le site peut etre injoignable\n' +
      '  pendant tout ce temps.',
    rollback:
      'Retablir les enregistrements precedents, puis attendre la propagation.\n' +
      '  Il n\'existe pas de retour arriere instantane. Voir docs/ROLLBACK.md § 3.',
    commande: '(action manuelle chez le registrar)',
  },
  env: {
    titre: 'Modification des variables d\'environnement de production',
    environnement: 'Vercel — environnement Production',
    impact:
      'Une variable ne prend effet qu\'au PROCHAIN deploiement. Modifier sans\n' +
      '  redeployer donne l\'illusion d\'un changement applique.\n' +
      '  Faire tourner PORTAL_TOKEN_PEPPER invalide TOUS les liens de portail\n' +
      '  deja envoyes aux clients.',
    rollback: 'Reposer l\'ancienne valeur et redeployer. Voir docs/ROLLBACK.md § 4.',
    commande: 'vercel env add <NOM> production',
  },
};

const nom = process.argv[2];
const action = ACTIONS[nom];

if (!action) {
  console.error(
    `Action inconnue : « ${nom ?? '(aucune)'} ».\n` +
      `Actions possibles : ${Object.keys(ACTIONS).join(', ')}`,
  );
  process.exit(1);
}

console.log(`
⚠️  ACTION PRODUCTION

Action           : ${action.titre}
Environnement    : ${action.environnement}
Impact           : ${action.impact}
Rollback         : ${action.rollback}
${action.prealable ? `Prealable        : ${action.prealable}\n` : ''}Commande visee   : ${action.commande}

Confirmation requise.

Cette commande n'execute rien par elle-meme. Elle enregistre votre accord et
affiche la marche a suivre. Le deploiement reste une action manuelle.

Pour confirmer, tapez exactement : ${PHRASE}
Pour annuler, tapez n'importe quoi d'autre, ou Ctrl+C.
`);

const rl = createInterface({ input: stdin, output: stdout });
const reponse = (await rl.question('> ')).trim();
rl.close();

if (reponse !== PHRASE) {
  console.log('\nAnnule. Rien n\'a ete fait.');
  process.exit(1);
}

console.log(`
Accord enregistre — ${new Date().toISOString()}

Marche a suivre :
${action.prealable ? `\n  1. ${action.prealable}\n  2. ${action.commande}` : `\n  ${action.commande}`}

Puis les controles de docs/PRODUCTION.md § « Apres la mise en ligne ».
`);
