import { describe, expect, it } from 'vitest';
import { computeAmounts, resolveVat } from '@/lib/vat';

describe('regime de TVA', () => {
  it('applique 21 % a un particulier', () => {
    const r = resolveVat({
      clientKind: 'particulier',
      clientVat: null,
      travauxImmobiliers: true,
    });
    expect(r.regime).toBe('standard_21');
    expect(r.taux).toBe(0.21);
    expect(r.mention).toBe('');
  });

  it('applique l’autoliquidation entre assujettis belges sur travaux immobiliers', () => {
    const r = resolveVat({
      clientKind: 'professionnel',
      clientVat: 'BE0123456789',
      travauxImmobiliers: true,
    });
    expect(r.regime).toBe('autoliquidation');
    expect(r.taux).toBe(0);
    // La mention est obligatoire : son absence engage la responsabilite
    // de l'emetteur.
    expect(r.mention).toContain('Autoliquidation');
    expect(r.mention).toContain('AR n° 1');
  });

  it('n’applique pas l’autoliquidation hors travaux immobiliers', () => {
    const r = resolveVat({
      clientKind: 'professionnel',
      clientVat: 'BE0123456789',
      travauxImmobiliers: false,
    });
    expect(r.regime).toBe('standard_21');
  });

  it('n’applique pas l’autoliquidation sans numero de TVA valide', () => {
    for (const tva of [null, '', 'BE123', 'FR12345678901', 'BE12345678901']) {
      const r = resolveVat({
        clientKind: 'professionnel',
        clientVat: tva,
        travauxImmobiliers: true,
      });
      expect(r.regime).toBe('standard_21');
    }
  });
});

describe('montants', () => {
  it('respecte HTVA + TVA = TTC (contrainte SQL quotes_ttc_coherent)', () => {
    const a = computeAmounts(1120, 0.21);
    expect(a.htva).toBe(1120);
    expect(a.tva).toBe(235.2);
    expect(a.ttc).toBe(1355.2);
    expect(Math.abs(a.ttc - (a.htva + a.tva))).toBeLessThan(0.01);
  });

  it('met la TVA a zero en autoliquidation', () => {
    const a = computeAmounts(1120, 0);
    expect(a.tva).toBe(0);
    expect(a.ttc).toBe(1120);
  });

  it('reste coherent sur des montants a decimales', () => {
    for (const m of [0.01, 33.33, 987.43, 12345.67]) {
      const a = computeAmounts(m, 0.21);
      expect(Math.abs(a.ttc - (a.htva + a.tva))).toBeLessThan(0.01);
    }
  });
});
