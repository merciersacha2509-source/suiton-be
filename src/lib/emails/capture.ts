import 'server-only';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serverEnv, appEnv } from '@/lib/env';

/**
 * Capture des courriels en mode preview.
 *
 * POURQUOI. Un site de vente envoie des courriels a de vraies personnes. En
 * developpement et en preview, ces personnes ne doivent JAMAIS les recevoir —
 * et pourtant il faut pouvoir verifier qu'ils sont corrects, complets et
 * lisibles. Les deux besoins sont incompatibles avec un envoi reel.
 *
 * En `EMAIL_MODE=preview`, rien ne part. Chaque message est ecrit sur disque
 * avec son destinataire, son sujet, son HTML et sa version texte, et devient
 * consultable sur /dev/emails.
 *
 * Le defaut de EMAIL_MODE est `preview`. Ce choix est deliberement
 * asymetrique : un oubli de configuration doit produire un courriel non
 * envoye, jamais un courriel parti chez un vrai client. On rattrape le
 * premier ; pas le second.
 */

const DOSSIER = join(process.cwd(), '.emails');

export interface CourrielCapture {
  fichier: string;
  horodatage: string;
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
  piecesJointes: string[];
}

/** Vrai quand aucun courriel ne doit reellement partir. */
export function modeCapture(): boolean {
  return serverEnv().EMAIL_MODE !== 'production';
}

/**
 * Ecrit un courriel sur disque au lieu de l'envoyer.
 *
 * L'ecriture ne doit jamais faire echouer l'operation metier : si le disque
 * est en lecture seule — c'est le cas des fonctions Vercel hors /tmp — on
 * journalise et on continue. Le courriel n'aura simplement pas ete capture.
 */
export async function capturer(courriel: {
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
  piecesJointes?: string[];
}): Promise<{ envoye: false; erreur: string }> {
  const horodatage = new Date().toISOString();
  const nom = `${horodatage.replace(/[:.]/g, '-')}-${courriel.sujet
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}.json`;

  try {
    await mkdir(DOSSIER, { recursive: true });
    await writeFile(
      join(DOSSIER, nom),
      JSON.stringify(
        {
          horodatage,
          destinataire: courriel.destinataire,
          sujet: courriel.sujet,
          html: courriel.html,
          texte: courriel.texte,
          piecesJointes: courriel.piecesJointes ?? [],
          environnement: appEnv(),
        },
        null,
        2,
      ),
      'utf8',
    );
  } catch (e) {
    console.warn(
      `[courriel] capture impossible (${(e as Error).message}) — message non ecrit sur disque`,
    );
  }

  console.info(
    `[courriel] CAPTURE (EMAIL_MODE=preview) a=${courriel.destinataire} sujet="${courriel.sujet}"`,
  );

  // On renvoie `envoye: false` : c'est la verite. Le code appelant continue
  // normalement, et l'interface n'affirme pas au client qu'un courriel est
  // parti alors qu'il ne l'est pas.
  return { envoye: false, erreur: 'EMAIL_MODE=preview — courriel capturé, non envoyé' };
}

/** Courriels captures, du plus recent au plus ancien. */
export async function courrielsCaptures(): Promise<CourrielCapture[]> {
  try {
    const fichiers = (await readdir(DOSSIER)).filter((f) => f.endsWith('.json')).sort().reverse();

    return Promise.all(
      fichiers.slice(0, 100).map(async (fichier) => {
        const brut = JSON.parse(await readFile(join(DOSSIER, fichier), 'utf8')) as Omit<
          CourrielCapture,
          'fichier'
        >;
        return { ...brut, fichier };
      }),
    );
  } catch {
    return [];
  }
}
