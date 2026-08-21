import { describe, expect, it } from 'vitest';
import {
  SEUILS_CONFIANCE,
  comparerALaReference,
  estimerAvecHistorique,
  expliquerConfiance,
  niveauDepuisN,
  type ReferenceEffective,
} from '@/lib/intelligence';

const catalogue: ReferenceEffective = {
  minutesParM2: 2.4,
  q1: null,
  q3: null,
  n: 0,
  confiance: 'aucune',
  origine: 'catalogue',
};

const observee = (n: number, mediane = 2.4): ReferenceEffective => ({
  minutesParM2: mediane,
  q1: mediane * 0.85,
  q3: mediane * 1.2,
  n,
  confiance: niveauDepuisN(n),
  origine: n >= SEUILS_CONFIANCE.moyenne ? 'observee' : 'catalogue',
});

/* -------------------------------------------------------------------------- */

describe('niveaux de confiance', () => {
  it.each([
    [0, 'aucune'],
    [2, 'aucune'],
    [3, 'faible'],
    [4, 'faible'],
    [5, 'moyenne'],
    [9, 'moyenne'],
    [10, 'bonne'],
    [24, 'bonne'],
    [25, 'elevee'],
    [200, 'elevee'],
  ])('%i observations → %s', (n, attendu) => {
    expect(niveauDepuisN(n)).toBe(attendu);
  });

  it('dit explicitement quand la valeur vient du catalogue', () => {
    expect(expliquerConfiance(0, 'catalogue')).toContain('Aucun chantier comparable');
    expect(expliquerConfiance(3, 'catalogue')).toContain('trop peu');
    expect(expliquerConfiance(3, 'catalogue')).toContain('grille tarifaire');
  });

  it('ne prétend jamais à la fiabilité sous 10 observations', () => {
    expect(expliquerConfiance(6, 'observee')).toContain('À confirmer');
    expect(expliquerConfiance(30, 'observee')).toContain('plus fiable');
  });
});

/* -------------------------------------------------------------------------- */

describe('estimation assistée', () => {
  const base = {
    propertyType: 'maison' as const,
    surface: 140,
    soil: 'standard' as const,
    techniciens: 1,
    medianeHtva: 1200,
    grilleMin: 980,
    grilleMax: 1120,
  };

  it('ne propose AUCUN prix tant que l’historique est insuffisant', () => {
    // C'est le garde-fou central : suggerer un prix sur trois chantiers
    // reviendrait a ancrer la tarification sur du bruit.
    for (const n of [0, 1, 2, 3, 4]) {
      const r = estimerAvecHistorique({ ...base, reference: observee(n) });
      expect(r.prixMin).toBeNull();
      expect(r.prixMax).toBeNull();
      expect(r.caHoraire).toBeNull();
    }
  });

  it('propose une fourchette à partir de cinq chantiers comparables', () => {
    const r = estimerAvecHistorique({ ...base, reference: observee(SEUILS_CONFIANCE.moyenne) });
    expect(r.prixMin).not.toBeNull();
    expect(r.prixMax).not.toBeNull();
    expect(r.prixMin!).toBeLessThan(r.prixMax!);
  });

  it('signale quand la durée vient du catalogue', () => {
    const r = estimerAvecHistorique({ ...base, reference: catalogue });
    expect(r.alertes.join(' ')).toContain('catalogue');
    expect(r.confiance).toBe('aucune');
  });

  it('alerte quand l’historique s’écarte franchement de la grille', () => {
    const cher = estimerAvecHistorique({
      ...base,
      medianeHtva: 1500, // très au-dessus de la grille (980–1120)
      reference: observee(12),
    });
    expect(cher.alertes.join(' ')).toContain('sous-évaluée');

    const bas = estimerAvecHistorique({
      ...base,
      medianeHtva: 700,
      reference: observee(12),
    });
    expect(bas.alertes.join(' ')).toContain('remises');
  });

  it('tient compte du rendement décroissant d’une équipe', () => {
    const seul = estimerAvecHistorique({ ...base, techniciens: 1, reference: observee(12) });
    const deux = estimerAvecHistorique({ ...base, techniciens: 2, reference: observee(12) });

    // Deux techniciens vont plus vite, mais pas deux fois plus : on se croise,
    // on se parle, on se repasse le matériel.
    expect(deux.dureeMax).toBeLessThan(seul.dureeMax);
    expect(deux.dureeMax).toBeGreaterThan(seul.dureeMax / 2);
  });

  it('déconseille de surcharger une petite surface', () => {
    const r = estimerAvecHistorique({
      ...base,
      surface: 90,
      techniciens: 3,
      reference: observee(12),
    });
    expect(r.alertes.join(' ')).toContain('on se gêne');
  });

  it('signale une dispersion élevée des durées', () => {
    const disperse: ReferenceEffective = {
      minutesParM2: 2.4,
      q1: 1.4,
      q3: 3.6,
      n: 12,
      confiance: 'bonne',
      origine: 'observee',
    };
    const r = estimerAvecHistorique({ ...base, reference: disperse });
    expect(r.alertes.join(' ')).toContain('visite préalable');
  });

  it('renvoie toujours une durée exploitable, même sans donnée', () => {
    const r = estimerAvecHistorique({ ...base, reference: catalogue });
    expect(r.dureeMin).toBeGreaterThan(0);
    expect(r.dureeMax).toBeGreaterThan(r.dureeMin);
  });
});

/* -------------------------------------------------------------------------- */

describe('comparaison à la référence', () => {
  it('refuse de comparer un premier chantier à lui-même', () => {
    const c = comparerALaReference(2.4, catalogue);
    expect(c.verdict).toBe('indeterminé');
    expect(c.phrase).toContain('devient lui-même la référence');
  });

  it('tolère 15 % d’écart avant de qualifier', () => {
    const ref = observee(12, 2.4);
    expect(comparerALaReference(2.4, ref).verdict).toBe('conforme');
    expect(comparerALaReference(2.7, ref).verdict).toBe('conforme'); // +12,5 %
    expect(comparerALaReference(2.9, ref).verdict).toBe('lent'); // +21 %
    expect(comparerALaReference(1.9, ref).verdict).toBe('rapide'); // −21 %
  });

  it('invite à vérifier la qualité quand un chantier est anormalement rapide', () => {
    const c = comparerALaReference(1.5, observee(12, 2.4));
    expect(c.verdict).toBe('rapide');
    expect(c.phrase).toContain('survolé');
  });

  it('oriente vers le détail par étape quand un chantier est lent', () => {
    const c = comparerALaReference(3.6, observee(12, 2.4));
    expect(c.phrase).toContain('par étape');
  });
});
