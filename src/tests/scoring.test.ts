import { describe, expect, it } from 'vitest';
import {
  COMPORTEMENT_PLAFOND,
  SCORE_MAX,
  computeComportement,
  computeScore,
  computeSocle,
  scoreBand,
  type RuleCode,
  type ScoreSocleInput,
} from '@/lib/scoring';

const PARTICULIER: ScoreSocleInput = {
  montantEstime: 900,
  clientKind: 'particulier',
  segment: null,
  recurrenceAnnuelle: 1,
  zone: 'principale',
  delaiJours: 20,
  aDesPhotos: false,
};

const ENTREPRISE: ScoreSocleInput = {
  montantEstime: 2400,
  clientKind: 'professionnel',
  segment: 'entreprise_generale',
  recurrenceAnnuelle: 8,
  zone: 'principale',
  delaiJours: 10,
  aDesPhotos: true,
};

describe('socle', () => {
  it('ne depasse jamais 100', () => {
    expect(computeSocle(ENTREPRISE)).toBeLessThanOrEqual(100);
  });

  it('classe une entreprise generale au-dessus d’un particulier equivalent', () => {
    expect(computeSocle(ENTREPRISE)).toBeGreaterThan(computeSocle(PARTICULIER));
  });

  it('valorise un dossier avec photos', () => {
    const sans = computeSocle(PARTICULIER);
    const avec = computeSocle({ ...PARTICULIER, aDesPhotos: true });
    expect(avec - sans).toBe(8);
  });

  it('est deterministe : deux appels identiques donnent le meme resultat', () => {
    expect(computeSocle(ENTREPRISE)).toBe(computeSocle(ENTREPRISE));
  });
});

describe('signaux comportementaux', () => {
  it('plafonne le cumul positif a +40', () => {
    const beaucoup: RuleCode[] = [
      'repond_moins_2h',
      'deja_client',
      'a_recommande',
      'devis_ouvert_2x',
      'retour_site_7j',
      'photos_apres_coup',
      'a_laisse_avis',
      'consulte_3_pages',
    ];
    expect(computeComportement(beaucoup)).toBe(COMPORTEMENT_PLAFOND);
  });

  it('plafonne le cumul negatif a -40', () => {
    const negatifs: RuleCode[] = [
      'silence_7j',
      'devis_dormant_14j',
      'silence_7j',
      'devis_dormant_14j',
    ];
    expect(computeComportement(negatifs)).toBe(-COMPORTEMENT_PLAFOND);
  });

  it('vaut 0 sans signal', () => {
    expect(computeComportement([])).toBe(0);
  });
});

describe('score total', () => {
  it('reste borne entre 0 et 140', () => {
    const haut = computeScore(ENTREPRISE, [
      'deja_client',
      'a_recommande',
      'repond_moins_2h',
      'devis_ouvert_2x',
    ]);
    expect(haut).toBeLessThanOrEqual(SCORE_MAX);
    expect(haut).toBeGreaterThanOrEqual(0);

    const bas = computeScore(
      { ...PARTICULIER, montantEstime: 200, zone: 'exceptionnelle', delaiJours: 90 },
      ['silence_7j', 'devis_dormant_14j', 'silence_7j'],
    );
    expect(bas).toBeGreaterThanOrEqual(0);
  });
});

describe('bandes', () => {
  // Ces seuils sont dupliques dans la colonne generee clients.score_band.
  // Toute modification ici DOIT etre reportee dans la migration correspondante.
  it.each([
    [140, 'A+'],
    [110, 'A+'],
    [109, 'A'],
    [85, 'A'],
    [84, 'B'],
    [55, 'B'],
    [54, 'C'],
    [0, 'C'],
  ])('score %i -> bande %s', (score, attendu) => {
    expect(scoreBand(score)).toBe(attendu);
  });
});
