import 'server-only';
import { Font } from '@react-pdf/renderer';
import path from 'node:path';

/**
 * Polices SUITON dans les PDF.
 *
 * Jura pour les titres, Inter pour le texte — exactement les polices du web,
 * pour que le devis et le site ne paraissent pas venir de deux entreprises
 * differentes.
 *
 * Les fichiers sont des TTF versionnes dans le depot (`fonts/`), convertis
 * depuis les WOFF2 de @fontsource. Trois raisons de ne pas les telecharger
 * au moment du rendu :
 *   1. @react-pdf n'accepte ni WOFF ni WOFF2 ;
 *   2. une requete reseau sur le chemin critique d'un devis est un point de
 *      panne de plus ;
 *   3. le rendu doit etre identique aujourd'hui et dans trois ans, meme si
 *      un CDN disparait.
 *
 * `Font.registerHyphenationCallback` desactive la cesure : @react-pdf coupe
 * les mots par defaut, ce qui donne « autoliqui-dation » au milieu d'une
 * mention legale.
 */

let enregistrees = false;

export function enregistrerPolices(): void {
  if (enregistrees) return;

  const dossier = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fonts');

  Font.register({
    family: 'Jura',
    fonts: [
      { src: path.join(dossier, 'Jura-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dossier, 'Jura-Medium.ttf'), fontWeight: 500 },
      { src: path.join(dossier, 'Jura-SemiBold.ttf'), fontWeight: 600 },
    ],
  });

  // Aucune cesure : mieux vaut une ligne un peu courte qu'un mot coupe au
  // milieu d'une mention legale — « autoliqui-dation » fait amateur.
  Font.registerHyphenationCallback((mot) => [mot]);

  Font.register({
    family: 'Inter',
    fonts: [
      { src: path.join(dossier, 'Inter-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dossier, 'Inter-Medium.ttf'), fontWeight: 500 },
      { src: path.join(dossier, 'Inter-SemiBold.ttf'), fontWeight: 600 },
    ],
  });

  enregistrees = true;
}
