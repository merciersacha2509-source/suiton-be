import { describe, expect, it } from 'vitest';
import {
  gainCumule,
  produireRecommandations,
  raisonAucuneRecommandation,
  volumeAnnuel,
  type EntreesRecommandations,
} from '@/lib/recommandations';

const VIDE: EntreesRecommandations = {
  volumes: [],
  rendements: [],
  communes: [],
  retouches: [],
  etapes: [],
  caHoraireGlobal: null,
  chantiersComplets: 0,
  codesRejetes: [],
};

const base = (p: Partial<EntreesRecommandations>): EntreesRecommandations => ({
  ...VIDE,
  caHoraireGlobal: 60,
  chantiersComplets: 40,
  ...p,
});

const segment = (n: number, caHoraire: number, jours = 365) => ({
  service: 'fin_de_chantier' as const,
  property_type: 'maison' as const,
  bande: 'm',
  soil: 'standard' as const,
  chantiers: n,
  jours_couverts: jours,
  panier_median: 1200,
  ca_horaire: caHoraire,
});

/* -------------------------------------------------------------------------- */

describe('volume annuel', () => {
  it('refuse d’extrapoler sous 60 jours d’historique', () => {
    // Projeter une annee depuis trois semaines donnerait des chiffres absurdes.
    const v = volumeAnnuel({ chantiers: 6, jours_couverts: 21 });
    expect(v.extrapole).toBe(false);
    expect(v.estime).toBe(6);
  });

  it('extrapole au-delà de 60 jours', () => {
    const v = volumeAnnuel({ chantiers: 20, jours_couverts: 180 });
    expect(v.extrapole).toBe(true);
    expect(v.estime).toBeGreaterThan(35);
    expect(v.estime).toBeLessThan(45);
  });
});

/* -------------------------------------------------------------------------- */

describe('seuils', () => {
  it('ne recommande RIEN sous cinq observations', () => {
    for (const n of [0, 1, 2, 3, 4]) {
      expect(produireRecommandations(base({ volumes: [segment(n, 40)] }))).toHaveLength(0);
    }
  });

  it('n’émet jamais de recommandation à confiance nulle', () => {
    const r = produireRecommandations(base({ volumes: [segment(20, 40)] }));
    expect(r.every((x) => x.confiance !== 'aucune')).toBe(true);
  });

  it('ne repropose pas ce qui a été rejeté', () => {
    const entrees = base({ volumes: [segment(20, 40)] });
    const [premiere] = produireRecommandations(entrees);
    expect(premiere).toBeDefined();

    const apres = produireRecommandations({ ...entrees, codesRejetes: [premiere!.code] });
    expect(apres.find((x) => x.code === premiere!.code)).toBeUndefined();
  });

  it('plafonne à cinq décisions', () => {
    const beaucoup = Array.from({ length: 15 }, (_, i) => ({
      ...segment(20, 40),
      bande: ['xs', 's', 'm', 'l', 'xl'][i % 5]!,
      property_type: (['maison', 'villa', 'studio'] as const)[i % 3]!,
    }));
    expect(produireRecommandations(base({ volumes: beaucoup })).length).toBeLessThanOrEqual(5);
  });
});

/* -------------------------------------------------------------------------- */

describe('gain — fourchette, jamais un chiffre', () => {
  it('produit toujours une borne basse strictement inférieure à la haute', () => {
    const [r] = produireRecommandations(base({ volumes: [segment(20, 40)] }));
    expect(r?.gainMin).not.toBeNull();
    expect(r!.gainMin!).toBeLessThan(r!.gainMax!);
  });

  it('la borne basse suppose que la moitié des clients refusent', () => {
    const [r] = produireRecommandations(base({ volumes: [segment(20, 40)] }));
    // Borne basse = moitie de la borne haute, par construction.
    expect(r!.gainMin!).toBeCloseTo(r!.gainMax! / 2, -1);
  });

  it('plafonne la hausse recommandée à 15 %', () => {
    // Un segment a 50 % sous la moyenne ne doit pas declencher une
    // recommandation de +50 % : on ne recommande pas un pari, on suggere une
    // experience.
    const [r] = produireRecommandations(base({ volumes: [segment(20, 30)] }));
    expect(r?.titre).toContain('15 %');
  });

  it('signale quand le gain est un plancher faute d’historique', () => {
    const [r] = produireRecommandations(base({ volumes: [segment(20, 40, 30)] }));
    expect(r?.explication.join(' ')).toContain('plancher');
  });

  it('cumule les fourchettes sans les confondre', () => {
    const r = produireRecommandations(base({ volumes: [segment(20, 40)] }));
    const total = gainCumule(r);
    expect(total.min).toBeLessThan(total.max);
  });
});

/* -------------------------------------------------------------------------- */

describe('explicabilité — aucune boîte noire', () => {
  it('chaque recommandation porte son raisonnement ET ses hypothèses', () => {
    const r = produireRecommandations(
      base({
        volumes: [segment(20, 40)],
        rendements: [
          { techniciens: 1, taille: 'petite', n: 12, cadence: 2.4 },
          { techniciens: 3, taille: 'petite', n: 8, cadence: 1.1 },
        ],
        communes: [
          {
            commune: 'Nivelles',
            chantiers: 12,
            ca_horaire: 75,
            panier: 1300,
            recurrence_pct: 40,
            conversion_pct: 55,
          },
        ],
        retouches: [
          { service: 'vitres', chantiers: 10, retouches: 7 },
          { service: 'fin_de_chantier', chantiers: 20, retouches: 3 },
        ],
        etapes: [
          { ordre: 3, libelle: 'Aspiration', observations: 20, mediane_min: 60, p90_min: 140 },
        ],
      }),
    );

    expect(r.length).toBeGreaterThan(0);
    for (const reco of r) {
      expect(reco.explication.length).toBeGreaterThanOrEqual(3);
      expect(reco.hypotheses.length).toBeGreaterThanOrEqual(2);
      expect(reco.action.length).toBeGreaterThan(20);
    }
  });

  it('nomme l’hypothèse la plus fragile d’une hausse tarifaire', () => {
    const [r] = produireRecommandations(base({ volumes: [segment(20, 40)] }));
    expect(r?.hypotheses.join(' ')).toContain('volume ne baisse pas');
  });
});

/* -------------------------------------------------------------------------- */

describe('familles', () => {
  it('propose une expérience contrôlée pour toute hausse tarifaire', () => {
    const [r] = produireRecommandations(base({ volumes: [segment(20, 40)] }));
    expect(r?.experience).not.toBeNull();
    expect(r?.experience?.dureeJours).toBeGreaterThanOrEqual(30);
  });

  it('valorise le sureffectif en heures ET en euros', () => {
    const r = produireRecommandations(
      base({
        rendements: [
          { techniciens: 1, taille: 'petite', n: 12, cadence: 2.4 },
          { techniciens: 3, taille: 'petite', n: 8, cadence: 1.1 },
        ],
      }),
    );
    const p = r.find((x) => x.famille === 'planning');
    expect(p?.gainNonMonetaire).toContain('h');
    expect(p?.hypotheses.join(' ')).toContain('réaffectée');
  });

  it('ne cible que les étapes dispersées, pas les étapes uniformément longues', () => {
    const uniforme = produireRecommandations(
      base({
        etapes: [
          {
            ordre: 2,
            libelle: 'Dépoussiérage',
            observations: 20,
            mediane_min: 90,
            p90_min: 110,
          },
        ],
      }),
    );
    expect(uniforme.find((x) => x.famille === 'productivite')).toBeUndefined();

    const disperse = produireRecommandations(
      base({
        etapes: [
          { ordre: 3, libelle: 'Aspiration', observations: 20, mediane_min: 60, p90_min: 140 },
        ],
      }),
    );
    expect(disperse.find((x) => x.famille === 'productivite')).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */

describe('priorisation', () => {
  it('classe sur le gain MINIMAL, pas maximal', () => {
    // Un pari optimiste ne doit pas passer devant une certitude modeste.
    const r = produireRecommandations(
      base({
        volumes: [
          { ...segment(40, 45), bande: 'm' }, // beaucoup d'observations
          { ...segment(5, 20), bande: 'l', panier_median: 3000 }, // gain max énorme, peu fiable
        ],
      }),
      5,
    );
    expect(r[0]?.chantiersConcernes).toBe(40);
  });

  it('écrase les recommandations faiblement fondées', () => {
    const solide = produireRecommandations(base({ volumes: [segment(40, 45)] }))[0];
    const fragile = produireRecommandations(base({ volumes: [segment(5, 45)] }))[0];
    expect(solide!.score).toBeGreaterThan(fragile!.score);
  });
});

describe('absence de recommandation', () => {
  it('distingue les trois raisons de ne rien proposer', () => {
    expect(raisonAucuneRecommandation(0)).toContain('Aucun chantier');
    expect(raisonAucuneRecommandation(3)).toContain('hasard');
    expect(raisonAucuneRecommandation(3)).toContain('coûte plus cher');
    expect(raisonAucuneRecommandation(40)).toContain('correspondent');
  });

  it('ne produit rien sur une base vide', () => {
    expect(produireRecommandations(VIDE)).toHaveLength(0);
  });
});
