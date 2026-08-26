import { describe, expect, it } from 'vitest';
import { estimate, estimateDuration } from '@/lib/pricing';
import { SETTINGS } from './fixtures';

describe('estimate', () => {
  it('applique la bande du service et du niveau de salissure', () => {
    const r = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 140,
        zone: 'principale',
        urgent: false,
      },
      SETTINGS,
    );
    // 140 x 7 = 980 ; 140 x 8 = 1120
    expect(r.min).toBe(980);
    expect(r.max).toBe(1120);
    expect(r.surDevis).toBe(false);
  });

  it('ajoute les frais de zone avant la majoration', () => {
    const r = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 100,
        zone: 'secondaire',
        urgent: false,
      },
      SETTINGS,
    );
    // (100 x 7) + 25 = 725 ; (100 x 8) + 25 = 825
    expect(r.min).toBe(730); // arrondi commercial a 10 EUR
    expect(r.max).toBe(830);
    expect(r.detail.fraisZone).toBe(25);
  });

  it('applique la majoration urgence de 20 % sur base + frais de zone', () => {
    const normal = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 100,
        zone: 'principale',
        urgent: false,
      },
      SETTINGS,
    );
    const urgent = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 100,
        zone: 'principale',
        urgent: true,
      },
      SETTINGS,
    );
    expect(normal.max).toBe(800);
    expect(urgent.max).toBe(960); // 800 x 1,2
  });

  it('bascule sur devis au-dela du seuil de surface', () => {
    const r = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 301,
        zone: 'principale',
        urgent: false,
      },
      SETTINGS,
    );
    expect(r.surDevis).toBe(true);
  });

  it('bascule sur devis en zone exceptionnelle quelle que soit la surface', () => {
    const r = estimate(
      {
        service: 'vitres',
        soil: 'standard',
        surface_m2: 40,
        zone: 'exceptionnelle',
        urgent: false,
      },
      SETTINGS,
    );
    expect(r.surDevis).toBe(true);
  });

  it('suit la grille quand elle change — pas de prix ecrit en dur', () => {
    const modifie = {
      ...SETTINGS,
      prix_m2: {
        ...SETTINGS.prix_m2,
        fin_de_chantier: { ...SETTINGS.prix_m2.fin_de_chantier, standard: { min: 7, max: 12 } },
      },
    };
    const r = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 140,
        zone: 'principale',
        urgent: false,
      },
      modifie,
    );
    expect(r.max).toBe(1680); // 140 x 12
  });

  it('echoue clairement si la grille est incomplete', () => {
    const casse = { ...SETTINGS, prix_m2: { ...SETTINGS.prix_m2, vitres: undefined } } as never;
    expect(() =>
      estimate(
        { service: 'vitres', soil: 'standard', surface_m2: 50, zone: 'principale', urgent: false },
        casse,
      ),
    ).toThrow(/Grille tarifaire incomplete/);
  });

  it('produit une fourchette croissante sur tous les services et niveaux', () => {
    const services = ['fin_de_chantier', 'vitres'] as const;
    const niveaux = ['standard', 'lourd'] as const;
    for (const service of services) {
      for (const soil of niveaux) {
        const r = estimate(
          { service, soil, surface_m2: 120, zone: 'principale', urgent: false },
          SETTINGS,
        );
        expect(r.max).toBeGreaterThanOrEqual(r.min);
      }
    }
  });
});

describe('estimateDuration', () => {
  it('croit avec la salissure', () => {
    const standard = estimateDuration({ surface_m2: 140, soil: 'standard' });
    const lourd = estimateDuration({ surface_m2: 140, soil: 'lourd' });
    expect(lourd.min).toBeGreaterThan(standard.min);
  });
});

describe('coefficient par type de bien', () => {
  it('ne change rien tant qu’il vaut 1', () => {
    const base = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 140,
        zone: 'principale',
        urgent: false,
      },
      SETTINGS,
    );
    const avecType = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 140,
        zone: 'principale',
        urgent: false,
        property_type: 'villa',
      },
      SETTINGS,
    );
    // Toute la garantie de la migration tient dans cette assertion : ajouter
    // la dimension « type de bien » ne modifie aucun prix par elle-meme.
    expect(avecType.min).toBe(base.min);
    expect(avecType.max).toBe(base.max);
    expect(avecType.detail.coefBien).toBe(1);
  });

  it('applique le coefficient quand le dirigeant l’a ajuste', () => {
    const reglages = { ...SETTINGS, coef_bien: { ...SETTINGS.coef_bien, villa: 1.2 } };
    const r = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 100,
        zone: 'principale',
        urgent: false,
        property_type: 'villa',
      },
      reglages,
    );
    // 100 m² × 7–8 €/m² × 1,2 = 840–960, arrondi commercial a 10 €.
    expect(r.min).toBe(840);
    expect(r.max).toBe(960);
    expect(r.detail.coefBien).toBe(1.2);
  });

  it('retombe sur 1 si le coefficient est absent de la grille', () => {
    const sansCoef = {
      ...SETTINGS,
      coef_bien: undefined as unknown as typeof SETTINGS.coef_bien,
    };
    const r = estimate(
      {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 100,
        zone: 'principale',
        urgent: false,
        property_type: 'maison',
      },
      sansCoef,
    );
    expect(r.detail.coefBien).toBe(1);
    expect(r.min).toBe(700);
  });
});
