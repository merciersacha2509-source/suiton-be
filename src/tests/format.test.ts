import { describe, expect, it } from 'vitest';
import { formatDuration, slugify } from '@/lib/format';

describe('formatDuration', () => {
  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [347, '5 h 47'],
    [125, '2 h 05'],
  ])('%i minutes -> %s', (minutes, attendu) => {
    expect(formatDuration(minutes)).toBe(attendu);
  });
});

describe('slugify', () => {
  it('retire les diacritiques', () => {
    expect(slugify('Nettoyage après rénovation à Enghien')).toBe(
      'nettoyage-apres-renovation-a-enghien',
    );
  });

  it('ne laisse ni tiret initial ni tiret final', () => {
    expect(slugify('  — Villa 240 m² —  ')).toBe('villa-240-m2');
  });

  it('est stable : deux appels donnent le meme slug', () => {
    const s = 'Maison 140 m² à Nivelles';
    expect(slugify(s)).toBe(slugify(s));
  });
});
