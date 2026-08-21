import type { ZoneTier } from '@/types/database';

/**
 * Zone tarifaire d'apres le code postal.
 *
 * La table est explicite plutot que calculee par distance : une API de
 * geocodage sur le chemin critique de la reservation ajoute une latence et
 * un point de panne pour une information qui ne change jamais.
 *
 * Zone principale : Enghien et sa couronne (~20 km).
 * Zone secondaire : Brabant wallon, Hainaut, sud de Bruxelles.
 * Le reste bascule en zone exceptionnelle, donc sur devis.
 */

const PRINCIPALE = new Set([
  '7850', // Enghien
  '7830', // Silly
  '7860', // Lessines
  '7861', // Lessines (Papignies)
  '7822', // Ath (Ghislenghien)
  '1547', // Bever
  '1547',
  '1500', // Halle
  '1502',
  '1540', // Herne
  '1541',
  '1560', // Hoeilaart — limite
  '7801', // Ath
  '7900', // Leuze
]);

const SECONDAIRE_PREFIXES = [
  '13', // Brabant wallon (Wavre, Ottignies…)
  '14', // Nivelles, Braine
  '15', // Halle, Pajottenland
  '16', // Rebecq, Tubize
  '10', // Bruxelles
  '11',
  '12',
  '70', // Mons, La Louviere
  '71',
  '72',
  '73',
  '74',
  '78', // Tournai, Ath
  '79',
];

export function zonePourCodePostal(codePostal: string): ZoneTier {
  const cp = codePostal.trim();
  if (PRINCIPALE.has(cp)) return 'principale';

  const prefixe = cp.slice(0, 2);
  if (SECONDAIRE_PREFIXES.includes(prefixe)) return 'secondaire';

  return 'exceptionnelle';
}

export const LIBELLES_ZONE: Record<ZoneTier, string> = {
  principale: 'Zone principale',
  secondaire: 'Zone secondaire',
  exceptionnelle: 'Hors zone — sur devis',
};
