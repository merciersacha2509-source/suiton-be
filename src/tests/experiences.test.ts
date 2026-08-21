import { describe, expect, it } from 'vitest';
import {
  analyserExperience,
  dureeConseillee,
  suggererDepuisRecommandation,
  type Echantillon,
} from '@/lib/experiences';

const ech = (n: number, mediane: number, etendue = 0.2): Echantillon => ({
  n,
  mediane,
  q1: mediane * (1 - etendue),
  q3: mediane * (1 + etendue),
});

/* -------------------------------------------------------------------------- */

describe('refus de conclure', () => {
  it('refuse sous cinq chantiers d’un côté ou de l’autre', () => {
    // Le point le plus important du module : une experience qui se termine
    // sur « on ne peut pas savoir » vaut mieux qu'une qui conclut a tort.
    const petitTest = analyserExperience({
      reference: ech(20, 60),
      test: ech(3, 80),
      indicateur: 'ca_horaire',
    });
    expect(petitTest.verdict).toBe('indeterminé');
    expect(petitTest.conclusion).toContain('Impossible de conclure');
    expect(petitTest.suite).toContain('Prolongez');

    const petiteRef = analyserExperience({
      reference: ech(2, 60),
      test: ech(20, 80),
      indicateur: 'ca_horaire',
    });
    expect(petiteRef.verdict).toBe('indeterminé');
    expect(petiteRef.conclusion).toContain('référence');
  });

  it('refuse quand la médiane n’est pas calculable', () => {
    const r = analyserExperience({
      reference: { n: 10, mediane: null, q1: null, q3: null },
      test: ech(10, 70),
      indicateur: 'ca_horaire',
    });
    expect(r.verdict).toBe('indeterminé');
  });

  it('ne conclut pas sous 10 % d’écart', () => {
    const r = analyserExperience({
      reference: ech(20, 60),
      test: ech(20, 63),
      indicateur: 'ca_horaire',
    });
    expect(r.verdict).toBe('neutre');
    expect(r.conclusion).toContain('bruit');
  });
});

/* -------------------------------------------------------------------------- */

describe('recouvrement interquartile', () => {
  it('émet une réserve quand les moitiés centrales se chevauchent', () => {
    // Medianes distantes de 20 % mais distributions tres etalees : la
    // difference peut tenir a la composition des chantiers.
    const r = analyserExperience({
      reference: ech(20, 60, 0.5), // 30 → 90
      test: ech(20, 72, 0.5), // 36 → 108
      indicateur: 'ca_horaire',
    });
    expect(r.verdict).toBe('positif');
    expect(r.reserves.join(' ')).toContain('chevauchent');
    expect(r.suite).toContain('Prolongez');
  });

  it('conclut nettement quand les distributions sont séparées', () => {
    const r = analyserExperience({
      reference: ech(20, 60, 0.05), // 57 → 63
      test: ech(20, 80, 0.05), // 76 → 84
      indicateur: 'ca_horaire',
    });
    expect(r.verdict).toBe('positif');
    expect(r.reserves.join(' ')).not.toContain('chevauchent');
    expect(r.suite).toContain('généraliser');
  });
});

/* -------------------------------------------------------------------------- */

describe('sens de l’indicateur', () => {
  it('une hausse du CA horaire est une bonne nouvelle', () => {
    expect(
      analyserExperience({
        reference: ech(20, 60, 0.05),
        test: ech(20, 75, 0.05),
        indicateur: 'ca_horaire',
      }).verdict,
    ).toBe('positif');
  });

  it('une hausse de la cadence en min/m² est une mauvaise nouvelle', () => {
    // Plus de minutes par m² = moins efficace.
    const r = analyserExperience({
      reference: ech(20, 2.4, 0.05),
      test: ech(20, 3.0, 0.05),
      indicateur: 'minutes_par_m2',
    });
    expect(r.verdict).toBe('negatif');
    expect(r.suite).toContain('Revenez à la situation antérieure');
  });

  it('une baisse de la cadence est une bonne nouvelle', () => {
    expect(
      analyserExperience({
        reference: ech(20, 2.4, 0.05),
        test: ech(20, 1.9, 0.05),
        indicateur: 'minutes_par_m2',
      }).verdict,
    ).toBe('positif');
  });
});

/* -------------------------------------------------------------------------- */

describe('prudence sur les échantillons modestes', () => {
  it('signale qu’un résultat sur peu de chantiers oriente sans prouver', () => {
    const r = analyserExperience({
      reference: ech(6, 60, 0.05),
      test: ech(6, 80, 0.05),
      indicateur: 'ca_horaire',
    });
    expect(r.reserves.join(' ')).toContain('oriente');
    expect(r.reserves.join(' ')).toContain('ne prouve pas');
  });

  it('tranche par la prudence sur une dégradation douteuse', () => {
    const r = analyserExperience({
      reference: ech(20, 60, 0.5),
      test: ech(20, 48, 0.5),
      indicateur: 'ca_horaire',
    });
    expect(r.verdict).toBe('negatif');
    expect(r.suite).toContain('Arrêtez par prudence');
  });
});

/* -------------------------------------------------------------------------- */

describe('suggestions', () => {
  it('transforme une recommandation tarifaire en expérience', () => {
    const s = suggererDepuisRecommandation({
      code: 'tarif:fin_de_chantier:maison:m:standard',
      famille: 'tarification',
      titre: 'Augmenter de 12 %',
      chantiersConcernes: 20,
      experience: {
        titre: '+12 % sur les maisons',
        hypothese: 'Le taux d’acceptation tient.',
        dureeJours: 60,
      },
    });
    expect(s?.justification).toContain('ne se rebaisse pas');
    expect(s?.dureeJours).toBe(60);
  });

  it('ne suggère rien quand la recommandation ne porte pas d’expérience', () => {
    expect(
      suggererDepuisRecommandation({
        code: 'planning:sureffectif:3',
        famille: 'planning',
        titre: 'Ne plus envoyer 3 personnes',
        chantiersConcernes: 8,
        experience: null,
      }),
    ).toBeNull();
  });
});

describe('durée conseillée', () => {
  it('déduit la durée du rythme réel', () => {
    expect(dureeConseillee(5).jours).toBe(30);
    expect(dureeConseillee(1).jours).toBe(150);
    expect(dureeConseillee(2).jours).toBe(90);
  });

  it('propose un défaut prudent sans rythme connu', () => {
    const d = dureeConseillee(0);
    expect(d.jours).toBe(90);
    expect(d.explication).toContain('pari raisonnable');
  });

  it('explique toujours son calcul', () => {
    expect(dureeConseillee(3).explication).toContain('chantiers nécessaires');
  });
});
