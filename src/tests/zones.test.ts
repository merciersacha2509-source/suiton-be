import { describe, expect, it } from 'vitest';
import { zonePourCodePostal } from '@/lib/zones';

describe('zones tarifaires', () => {
  it('classe Enghien et sa couronne en zone principale', () => {
    for (const cp of ['7850', '7830', '7860', '1540']) {
      expect(zonePourCodePostal(cp)).toBe('principale');
    }
  });

  it('classe le Brabant wallon et le Hainaut en zone secondaire', () => {
    for (const cp of ['1400', '1300', '7000', '7100', '1000']) {
      expect(zonePourCodePostal(cp)).toBe('secondaire');
    }
  });

  it('classe le reste du pays en zone exceptionnelle', () => {
    // Liege, Namur, Anvers, Gand : hors perimetre, donc sur devis.
    for (const cp of ['4000', '5000', '2000', '9000', '8000']) {
      expect(zonePourCodePostal(cp)).toBe('exceptionnelle');
    }
  });

  it('tolere les espaces autour du code postal', () => {
    expect(zonePourCodePostal(' 7850 ')).toBe('principale');
  });
});
