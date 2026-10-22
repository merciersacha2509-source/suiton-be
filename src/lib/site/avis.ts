/**
 * Avis clients, affiches sur la page d'accueil.
 *
 * Uniquement de vrais avis, reproduits tels qu'ils ont ete donnes, avec
 * l'accord de leur auteur. Tant que la liste est vide, la section n'apparait
 * pas. Aucun avis invente, aucun avis reformule.
 */

export interface Avis {
  id: string;
  /** Texte de l'avis, tel que donne par le client. */
  texte: string;
  /** Nom tel que le client accepte de le voir publie, par exemple « Marie D. ». */
  auteur: string;
  /** Contexte, par exemple « Fin de travaux, Nivelles ». */
  contexte: string;
}

export const AVIS: readonly Avis[] = [];
