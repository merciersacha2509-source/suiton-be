/**
 * Ligne de tableau, commune au devis et a la facture.
 *
 * Les valeurs sont deja FORMATEES : « 1 145,00 € », pas 1145. Le composant
 * de rendu ne fait aucun calcul et n'a aucune notion de locale — c'est ce
 * qui permet de tester la logique metier sans jamais rendre un PDF.
 */
export interface LigneDocument {
  description: string;
  detail?: string;
  quantite: string;
  unite: string;
  prixUnitaire: string;
  total: string;
}
