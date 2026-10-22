/**
 * Chantiers recents, affiches en tete de la page Realisations.
 *
 * Donnees saisies a la main, avec l'accord du client. Tant que la liste est
 * vide, la section n'apparait pas : aucune photo de banque, aucune image
 * generee, aucun chantier invente. Ne pas confondre avec `realisations.ts`,
 * qui lit les chantiers publies depuis la base.
 *
 * Pour ajouter un chantier : deposer les deux photos dans `public/chantiers/`
 * puis ajouter une entree ci-dessous.
 */

export interface PhotoChantier {
  /** Chemin depuis `public/`, par exemple `/chantiers/enghien-avant.jpg`. */
  src: string;
  /** Description pour les lecteurs d'ecran : ce que l'on voit, pas « photo avant ». */
  alt: string;
}

export interface ChantierRecent {
  id: string;
  /** Type de prestation, par exemple « Fin de travaux ». */
  prestation: string;
  commune: string;
  /** Une phrase, ecrite a la main. */
  phrase: string;
  avant: PhotoChantier;
  apres: PhotoChantier;
}

export const CHANTIERS_RECENTS: readonly ChantierRecent[] = [];
