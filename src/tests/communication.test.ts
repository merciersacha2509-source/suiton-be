import { describe, expect, it } from 'vitest';

/**
 * Communication structuree belge.
 *
 * Le calcul vit en SQL (`communication_structuree`) parce qu'il doit etre
 * applique par un declencheur, au moment ou le numero de facture est
 * attribue. Ce test reproduit la regle pour verifier que l'implementation
 * SQL — validee par `npm run test:db` — repose sur la bonne arithmetique.
 *
 * Format : +++123/4567/89012+++
 * 10 chiffres libres, puis une cle egale au reste de la division par 97 —
 * et 97 si ce reste vaut 0, « 00 » n'etant pas une cle valide.
 */
function communicationStructuree(numero: number, annee: number): string {
  const base = BigInt(annee) * 1_000_000n + BigInt(Math.min(numero, 999_999));
  const reste = Number(base % 97n);
  const cle = reste === 0 ? 97 : reste;
  const douze = base.toString().padStart(10, '0') + String(cle).padStart(2, '0');
  return `+++${douze.slice(0, 3)}/${douze.slice(3, 7)}/${douze.slice(7, 12)}+++`;
}

describe('communication structurée', () => {
  it('respecte le format belge', () => {
    for (const n of [1, 42, 148, 999, 123456]) {
      expect(communicationStructuree(n, 2026)).toMatch(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
    }
  });

  it('produit une clé de contrôle valide', () => {
    for (const n of [1, 42, 148, 999, 123456]) {
      const chiffres = communicationStructuree(n, 2026).replace(/[^0-9]/g, '');
      const base = BigInt(chiffres.slice(0, 10));
      const cle = Number(chiffres.slice(10));
      const attendu = Number(base % 97n) === 0 ? 97 : Number(base % 97n);
      expect(cle).toBe(attendu);
    }
  });

  it('n’émet jamais la clé 00 — elle est invalide', () => {
    for (let n = 1; n <= 500; n += 1) {
      const chiffres = communicationStructuree(n, 2026).replace(/[^0-9]/g, '');
      expect(chiffres.slice(10)).not.toBe('00');
    }
  });

  it('est unique pour deux factures différentes de la même année', () => {
    const vues = new Set<string>();
    for (let n = 1; n <= 300; n += 1) {
      vues.add(communicationStructuree(n, 2026));
    }
    expect(vues.size).toBe(300);
  });

  it('diffère d’une année à l’autre pour un même numéro', () => {
    expect(communicationStructuree(1, 2026)).not.toBe(communicationStructuree(1, 2027));
  });
});
