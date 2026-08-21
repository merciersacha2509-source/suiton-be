import { describe, expect, it } from 'vitest';
import {
  SEUIL_OBSERVATIONS,
  produireAlertes,
  raisonAucuneAlerte,
  type EntreesAlertes,
} from '@/lib/alertes';

const VIDE: EntreesAlertes = {
  ecarts: [],
  rendements: [],
  retouches: [],
  communes: [],
  caHoraireGlobal: null,
  precisionEstimation: null,
  couvertureMoyenne: null,
  checklistsSuspectes: 0,
  chantiersComplets: 0,
};

const base = (p: Partial<EntreesAlertes>): EntreesAlertes => ({
  ...VIDE,
  caHoraireGlobal: 60,
  chantiersComplets: 20,
  ...p,
});

const ecart = (n: number, caHoraire: number) => ({
  property_type: 'maison' as const,
  bande: 'm',
  soil: 'standard' as const,
  service: 'fin_de_chantier' as const,
  n,
  facture_mediane: 1200,
  ca_horaire: caHoraire,
});

/* -------------------------------------------------------------------------- */

describe('seuil d’observations', () => {
  it('ne produit AUCUNE alerte sous cinq observations', () => {
    // Le garde-fou central : un ecart sur trois chantiers mesure le hasard.
    // Une alerte fausse coute plus cher qu'une alerte absente — elle fait
    // perdre confiance dans toutes les autres.
    for (const n of [0, 1, 2, 3, 4]) {
      const a = produireAlertes(base({ ecarts: [ecart(n, 30)] }));
      expect(a.filter((x) => x.code.startsWith('sous-facturation'))).toHaveLength(0);
    }
  });

  it('produit l’alerte à partir de cinq observations', () => {
    const a = produireAlertes(base({ ecarts: [ecart(SEUIL_OBSERVATIONS, 30)] }));
    expect(a.some((x) => x.code.startsWith('sous-facturation'))).toBe(true);
  });
});

describe('amplitude minimale', () => {
  it('ignore un écart de moins de 12 % — il tient à la composition, pas au tarif', () => {
    for (const ca of [55, 58, 62, 66]) {
      const a = produireAlertes(base({ ecarts: [ecart(20, ca)] }));
      expect(
        a.filter((x) => x.code.includes('facturation') || x.code.includes('surperf')),
      ).toHaveLength(0);
    }
  });

  it('alerte au-delà de 12 %', () => {
    expect(produireAlertes(base({ ecarts: [ecart(20, 48)] })).length).toBeGreaterThan(0);
    expect(produireAlertes(base({ ecarts: [ecart(20, 75)] })).length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */

describe('sous-facturation', () => {
  it('nomme le segment, chiffre l’écart et dit quoi faire', () => {
    const [a] = produireAlertes(base({ ecarts: [ecart(20, 45)] }));
    expect(a?.titre).toContain('maisons');
    expect(a?.titre).toContain('110 à 180 m²');
    expect(a?.titre).toContain('25 %');
    expect(a?.action).toContain('Relevez la grille');
  });

  it('passe en critique au-delà de 25 % d’écart', () => {
    const [doux] = produireAlertes(base({ ecarts: [ecart(20, 50)] }));
    const [fort] = produireAlertes(base({ ecarts: [ecart(20, 40)] }));
    expect(doux?.gravite).toBe('attention');
    expect(fort?.gravite).toBe('critique');
  });

  it('signale aussi les segments qui surperforment', () => {
    const [a] = produireAlertes(base({ ecarts: [ecart(20, 80)] }));
    expect(a?.gravite).toBe('opportunite');
    expect(a?.action).toContain('prospection');
  });
});

/* -------------------------------------------------------------------------- */

describe('sureffectif', () => {
  const rendements = (cadence3: number) => [
    { techniciens: 1, taille: 'petite' as const, n: 10, cadence: 2.4 },
    { techniciens: 3, taille: 'petite' as const, n: 8, cadence: cadence3 },
  ];

  it('détecte la perte de rendement à trois sur petite surface', () => {
    // Attendu a 3 personnes : 2,4 / 3 = 0,80. Observe 1,00 → +25 % de perte.
    const a = produireAlertes(base({ rendements: rendements(1.0) }));
    const s = a.find((x) => x.code === 'sureffectif:3');
    expect(s).toBeDefined();
    expect(s?.titre).toContain('rendement');
    expect(s?.action).toContain('second chantier');
  });

  it('ne dit rien quand l’équipe tient la cadence attendue', () => {
    const a = produireAlertes(base({ rendements: rendements(0.82) }));
    expect(a.find((x) => x.code === 'sureffectif:3')).toBeUndefined();
  });

  it('reste muet sans point de comparaison à un technicien', () => {
    const a = produireAlertes(
      base({ rendements: [{ techniciens: 3, taille: 'petite', n: 20, cadence: 1.5 }] }),
    );
    expect(a.find((x) => x.code.startsWith('sureffectif'))).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */

describe('retouches', () => {
  it('alerte quand un service concentre plus de 40 % des retouches', () => {
    const a = produireAlertes(
      base({
        retouches: [
          { service: 'vitres', chantiers: 10, retouches: 7, part_pct: null },
          { service: 'fin_de_chantier', chantiers: 20, retouches: 3, part_pct: null },
        ],
      }),
    );
    const r = a.find((x) => x.code === 'retouches:vitres');
    expect(r?.titre).toContain('70 %');
    expect(r?.titre).toContain('vitres');
  });

  it('ignore un total de retouches trop faible pour signifier quoi que ce soit', () => {
    const a = produireAlertes(
      base({ retouches: [{ service: 'vitres', chantiers: 10, retouches: 2, part_pct: null }] }),
    );
    expect(a.find((x) => x.code.startsWith('retouches'))).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */

describe('communes', () => {
  it('mentionne la récurrence quand elle est forte', () => {
    const a = produireAlertes(
      base({
        communes: [
          {
            commune: 'Nivelles',
            chantiers: 12,
            ca_horaire: 75,
            recurrence_pct: 40,
            conversion_pct: 50,
          },
        ],
      }),
    );
    const c = a.find((x) => x.code === 'commune-forte:Nivelles');
    expect(c?.action).toContain('40 %');
    expect(c?.action).toContain('reviennent');
  });

  it('oriente vers le temps de trajet pour une commune faible', () => {
    const a = produireAlertes(
      base({
        communes: [
          {
            commune: 'Tournai',
            chantiers: 8,
            ca_horaire: 45,
            recurrence_pct: 0,
            conversion_pct: 20,
          },
        ],
      }),
    );
    expect(a.find((x) => x.code === 'commune-faible:Tournai')?.action).toContain('trajet');
  });
});

/* -------------------------------------------------------------------------- */

describe('estimation et couverture', () => {
  it('alerte quand la grille de durées ne décrit plus la réalité', () => {
    const a = produireAlertes(base({ precisionEstimation: 35 }));
    const e = a.find((x) => x.code === 'estimation-imprecise');
    expect(e?.gravite).toBe('critique');
    expect(e?.action).toContain('références observées');
  });

  it('reste muette quand les estimations sont correctes', () => {
    expect(
      produireAlertes(base({ precisionEstimation: 75 })).find(
        (x) => x.code === 'estimation-imprecise',
      ),
    ).toBeUndefined();
  });

  it('rappelle que le rapport photo est un argument de vente', () => {
    const a = produireAlertes(base({ couvertureMoyenne: 45 }));
    expect(a.find((x) => x.code === 'couverture-photo')?.action).toContain('litige');
  });
});

describe('checklists suspectes', () => {
  it('alerte dès la première — ce n’est pas une tendance mais un défaut de procédure', () => {
    const a = produireAlertes({ ...VIDE, chantiersComplets: 1, checklistsSuspectes: 1 });
    const c = a.find((x) => x.code === 'checklists-suspectes');
    expect(c).toBeDefined();
    expect(c?.confiance).toBe('elevee');
    expect(c?.action).toContain('exclus des références');
  });
});

/* -------------------------------------------------------------------------- */

describe('assemblage', () => {
  it('trie par gravité puis par poids', () => {
    const a = produireAlertes(
      base({
        ecarts: [ecart(20, 40)], // critique
        communes: [
          {
            commune: 'Nivelles',
            chantiers: 12,
            ca_horaire: 75,
            recurrence_pct: 40,
            conversion_pct: 50,
          },
        ], // opportunité
        couvertureMoyenne: 45, // attention
      }),
    );
    expect(a[0]?.gravite).toBe('critique');
    expect(a[a.length - 1]?.gravite).toBe('opportunite');
  });

  it('plafonne à six — au-delà, la liste devient un mur qu’on cesse de lire', () => {
    const beaucoup = Array.from({ length: 12 }, (_, i) => ({
      ...ecart(20, 40),
      bande: ['xs', 's', 'm', 'l', 'xl'][i % 5]!,
      property_type: (['maison', 'villa', 'studio'] as const)[i % 3]!,
    }));
    expect(produireAlertes(base({ ecarts: beaucoup })).length).toBeLessThanOrEqual(6);
  });

  it('ne produit rien sur une base vide', () => {
    expect(produireAlertes(VIDE)).toHaveLength(0);
  });
});

describe('explication de l’absence d’alerte', () => {
  it('distingue « pas de données » de « rien à signaler »', () => {
    expect(raisonAucuneAlerte(0)).toContain('Aucun chantier');
    expect(raisonAucuneAlerte(3)).toContain('hasard');
    expect(raisonAucuneAlerte(30)).toContain('bonne nouvelle');
  });
});
