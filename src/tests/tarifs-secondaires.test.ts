import { describe, expect, it } from 'vitest';
import {
  OPTIONS_VEHICULE,
  PRIX_APPEL_VEHICULE,
  TAILLES_VEHICULE,
  ajouterTva,
  FIN_LOCATION,
  OPTIONS_FIN_LOCATION,
  calculerCanape,
  calculerFinLocation,
  calculerMatelas,
  calculerTapis,
  retirerTva,
  calculerVehicule,
  eur,
  formatDuree,
  formatPlageDuree,
  type IdOptionVehicule,
  type IdTailleVehicule,
} from '@/lib/site/tarifs-secondaires';

describe('nettoyage de véhicules — taille + options (prix TVAC)', () => {
  // [libellé, taille, options, total TVAC, HTVA dérivé]
  const cas: [string, IdTailleVehicule, IdOptionVehicule[], number, number][] = [
    ['compacte, intérieur seul', 'compacte', [], 70, 57.85],
    ['grand, intérieur seul', 'grand', [], 90, 74.38],
    ['compacte + shampouinage', 'compacte', ['shampouinage'], 90, 74.38],
    ['compacte + total vapeur', 'compacte', ['vapeur'], 90, 74.38],
    ['compacte + shampouinage + vapeur', 'compacte', ['shampouinage', 'vapeur'], 110, 90.91],
    ['grand + shampouinage + total vapeur', 'grand', ['shampouinage', 'vapeur'], 130, 107.44],
  ];

  it.each(cas)('%s', (_nom, taille, options, tvac, htva) => {
    const r = calculerVehicule(taille, options);
    expect(r.tvac).toBe(tvac);
    expect(r.htva).toBe(htva);
  });

  it('grille affichée : intérieur 70 / 90 €, +20 € shampouinage, +20 € vapeur', () => {
    expect(TAILLES_VEHICULE.map((t) => t.prixTvac)).toEqual([70, 90]);
    expect(OPTIONS_VEHICULE.find((o) => o.id === 'shampouinage')?.prixTvac).toBe(20);
    expect(OPTIONS_VEHICULE.find((o) => o.id === 'vapeur')?.prixTvac).toBe(20);
    expect(PRIX_APPEL_VEHICULE).toBe(70);
  });

  it("pas d'option extérieur : seules deux options existent", () => {
    expect(OPTIONS_VEHICULE.map((o) => o.id)).toEqual(['shampouinage', 'vapeur']);
  });

  it('les options coûtent pareil quelle que soit la taille', () => {
    for (const o of OPTIONS_VEHICULE) {
      const petit = calculerVehicule('compacte', [o.id]).tvac - 70;
      const grand = calculerVehicule('grand', [o.id]).tvac - 90;
      expect(petit).toBe(o.prixTvac);
      expect(grand).toBe(o.prixTvac);
    }
  });

  it('durées : chaque option prend 15 à 30 min, le grand véhicule est plus long', () => {
    const petit = calculerVehicule('compacte', []);
    expect([petit.dureeMin, petit.dureeMax]).toEqual([105, 105]);
    const grand = calculerVehicule('grand', []);
    expect([grand.dureeMin, grand.dureeMax]).toEqual([130, 130]);
    const shampouinage = calculerVehicule('compacte', ['shampouinage']);
    expect([shampouinage.dureeMin, shampouinage.dureeMax]).toEqual([120, 135]);
    const tout = calculerVehicule('compacte', ['shampouinage', 'vapeur']);
    expect([tout.dureeMin, tout.dureeMax]).toEqual([135, 165]);
  });

  it('prix TVAC ronds : le total est la somme exacte, sans écart d’un centime', () => {
    for (const t of TAILLES_VEHICULE) {
      const somme = t.prixTvac + OPTIONS_VEHICULE.reduce((s, o) => s + o.prixTvac, 0);
      expect(calculerVehicule(t.id, ['shampouinage', 'vapeur']).tvac).toBe(somme);
      expect(Number.isInteger(somme)).toBe(true);
    }
  });

  it('formate les durées et les plages', () => {
    expect(formatDuree(105)).toBe('1 h 45');
    expect(formatDuree(130)).toBe('2 h 10');
    expect(formatDuree(120)).toBe('2 h');
    expect(formatPlageDuree(15, 30)).toBe('15 min à 30 min');
    expect(formatPlageDuree(60, 60)).toBe('1 h');
    expect(formatPlageDuree(135, 165)).toBe('2 h 15 à 2 h 45');
  });
});

describe('nettoyage de canapés — paliers par nombre de places, vapeur forfaitaire', () => {
  it.each([
    [2, 50, 60],
    [4, 70, 80],
    [6, 110, 120],
    [8, 130, 140],
  ])('%i places : %i à %i €', (places, min, max) => {
    expect(calculerCanape(places, false)).toEqual({ min, max, supplementVapeur: 0 });
  });

  it('paliers intermédiaires : 3, 5 et 7 places', () => {
    expect(calculerCanape(3, false)).toMatchObject({ min: 60, max: 70 });
    expect(calculerCanape(5, false)).toMatchObject({ min: 90, max: 100 });
    expect(calculerCanape(7, false)).toMatchObject({ min: 120, max: 130 });
  });

  it('plancher : un canapé 1 place ne descend pas sous 50 à 60 €', () => {
    expect(calculerCanape(1, false)).toMatchObject({ min: 50, max: 60 });
  });

  it('au-delà de 8 places : +10 € par place', () => {
    expect(calculerCanape(9, false)).toMatchObject({ min: 140, max: 150 });
    expect(calculerCanape(12, false)).toMatchObject({ min: 170, max: 180 });
  });

  it('les prix croissent avec le nombre de places', () => {
    for (let n = 2; n <= 12; n++) {
      expect(calculerCanape(n, false).min).toBeGreaterThanOrEqual(calculerCanape(n - 1, false).min);
    }
  });

  it('total vapeur : +20 € par canapé, quelle que soit la taille', () => {
    expect(calculerCanape(2, true)).toEqual({ min: 70, max: 80, supplementVapeur: 20 });
    expect(calculerCanape(6, true)).toEqual({ min: 130, max: 140, supplementVapeur: 20 });
  });
});

describe('nettoyage de matelas — fourchette par taille', () => {
  it('aucun matelas : zéro', () => {
    expect(calculerMatelas({})).toEqual({ min: 0, max: 0, nombre: 0 });
  });

  it('1 place 50 à 60 €, 2 places 70 à 80 €', () => {
    expect(calculerMatelas({ 'une-place': 1 })).toEqual({ min: 50, max: 60, nombre: 1 });
    expect(calculerMatelas({ 'deux-places': 1 })).toEqual({ min: 70, max: 80, nombre: 1 });
  });

  it('additionne les tailles', () => {
    expect(calculerMatelas({ 'une-place': 2, 'deux-places': 1 })).toEqual({
      min: 170,
      max: 200,
      nombre: 3,
    });
  });

  it('borne les quantités absurdes', () => {
    expect(calculerMatelas({ 'grand-lit': 999 }).nombre).toBe(6);
    expect(calculerMatelas({ 'grand-lit': -3 }).nombre).toBe(0);
  });
});

describe('nettoyage de tapis — prix par pièce, dégressif', () => {
  it('un tapis 80 €, deux tapis 100 €', () => {
    expect(calculerTapis(1)).toBe(80);
    expect(calculerTapis(2)).toBe(100);
  });

  it('+20 € par tapis supplémentaire', () => {
    expect(calculerTapis(4)).toBe(140);
  });

  it('zéro tapis : zéro ; quantités absurdes bornées', () => {
    expect(calculerTapis(0)).toBe(0);
    expect(calculerTapis(-2)).toBe(0);
    expect(calculerTapis(999)).toBe(180);
  });
});

describe('nettoyage de fin de location — forfait jusqu’à 90 m²', () => {
  it('forfait de 490 € TVAC', () => {
    expect(FIN_LOCATION.forfaitTvac).toBe(490);
    expect(calculerFinLocation(60)).toEqual({ statut: 'forfait', tvac: 490 });
  });

  it('surface inconnue ou exactement 90 m² : le forfait s’applique', () => {
    expect(calculerFinLocation(null)).toEqual({ statut: 'forfait', tvac: 490 });
    expect(calculerFinLocation(90)).toEqual({ statut: 'forfait', tvac: 490 });
  });

  it('au-delà de 90 m² : sur devis, aucun prix', () => {
    expect(calculerFinLocation(91)).toEqual({ statut: 'devis', tvac: null });
  });

  it('réfrigérateur et textiles sont hors forfait, sans prix affiché ; pas d’option four', () => {
    expect(OPTIONS_FIN_LOCATION.map((o) => o.id)).toEqual(['frigo', 'textiles']);
    for (const o of OPTIONS_FIN_LOCATION) expect(o).not.toHaveProperty('prixTvac');
  });
});

describe('affichage', () => {
  it('conversion TVA conservée pour les montants HTVA hérités', () => {
    expect(ajouterTva(30)).toBe(36.3);
    expect(retirerTva(79)).toBe(65.29);
  });

  it('montants formatés sans demi-centime', () => {
    expect(eur(90).replace(/\s/g, ' ')).toBe('90 €');
    expect(eur(108.9).replace(/\s/g, ' ')).toBe('108,90 €');
    expect(eur(37.5).replace(/\s/g, ' ')).toBe('37,50 €');
  });
});
