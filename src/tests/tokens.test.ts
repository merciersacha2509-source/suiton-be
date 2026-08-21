import { beforeAll, describe, expect, it } from 'vitest';

/**
 * lib/tokens lit le poivre via serverEnv(). On le renseigne AVANT l'import,
 * sinon la validation Zod echoue au chargement du module.
 */
beforeAll(() => {
  process.env.PORTAL_TOKEN_PEPPER = 'poivre-de-test-suffisamment-long-1234';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-service-de-test-suffisamment-longue';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-anon-de-test-suffisamment-longue';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
});

describe('jetons de portail', () => {
  it('produit un jeton de 32 octets en base64url', async () => {
    const { genererJetonPortail } = await import('@/lib/tokens');
    const jeton = genererJetonPortail();

    expect(jeton).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(jeton, 'base64url')).toHaveLength(32);
  });

  it('ne produit jamais deux fois le meme jeton', async () => {
    const { genererJetonPortail } = await import('@/lib/tokens');
    const lot = new Set(Array.from({ length: 500 }, () => genererJetonPortail()));
    expect(lot.size).toBe(500);
  });

  it('hache en SHA-256 hexadecimal — jamais de jeton en clair en base', async () => {
    const { genererJetonPortail, hacherJeton } = await import('@/lib/tokens');
    const jeton = genererJetonPortail();
    const hash = hacherJeton(jeton);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(jeton);
  });

  it('est deterministe : meme jeton, meme empreinte', async () => {
    const { hacherJeton } = await import('@/lib/tokens');
    expect(hacherJeton('abc')).toBe(hacherJeton('abc'));
    expect(hacherJeton('abc')).not.toBe(hacherJeton('abd'));
  });

  it('compare a temps constant sans lever sur des longueurs differentes', async () => {
    const { comparerHash } = await import('@/lib/tokens');
    expect(comparerHash('a'.repeat(64), 'a'.repeat(64))).toBe(true);
    expect(comparerHash('a'.repeat(64), 'b'.repeat(64))).toBe(false);
    expect(comparerHash('court', 'beaucoup-plus-long')).toBe(false);
  });

  it('rejette les jetons manifestement fabriques avant toute requete', async () => {
    const { jetonPlausible, genererJetonPortail } = await import('@/lib/tokens');

    expect(jetonPlausible(genererJetonPortail())).toBe(true);
    for (const faux of ['', 'abc', '../../etc/passwd', 'a'.repeat(200), "' OR 1=1--"]) {
      expect(jetonPlausible(faux)).toBe(false);
    }
  });

  it('construit une URL de portail sans double barre oblique', async () => {
    const { urlPortail } = await import('@/lib/tokens');
    expect(urlPortail('JETON', 'https://suiton.be/')).toBe('https://suiton.be/portail/JETON');
    expect(urlPortail('JETON', 'https://suiton.be')).toBe('https://suiton.be/portail/JETON');
  });
});
