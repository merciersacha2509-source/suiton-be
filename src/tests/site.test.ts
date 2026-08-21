import { describe, expect, it } from 'vitest';
import { SERVICES, parSlug } from '@/lib/site/services';
import { COMMUNES, communeParSlug } from '@/lib/site/communes';
import { ENTREPRISE, GARANTIES, ETAPES_CLIENT } from '@/lib/site/entreprise';

/**
 * Invariants du contenu editorial.
 *
 * Ces tests ne verifient pas du code : ils verifient du texte. C'est
 * volontaire. Une page locale dont le titre depasse 65 caracteres est
 * tronquee dans les resultats de recherche, et deux pages qui partagent une
 * meta description se cannibalisent. Ce sont des regressions silencieuses :
 * rien ne casse, le trafic ne vient simplement jamais.
 *
 * Ils servent aussi de garde-fou a la redaction future : ajouter une neuvieme
 * commune en copiant la huitieme fait echouer la suite.
 */

const mots = (s: string) => s.trim().split(/\s+/).length;

describe('services', () => {
  it('ont des slugs uniques', () => {
    const slugs = SERVICES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ont des slugs en minuscules, sans accent ni espace', () => {
    for (const s of SERVICES) expect(s.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('ont un titre SEO de 30 a 65 caracteres', () => {
    for (const s of SERVICES) {
      expect(s.titleSeo.length, `${s.slug} : « ${s.titleSeo} »`).toBeGreaterThanOrEqual(30);
      expect(s.titleSeo.length, `${s.slug} : « ${s.titleSeo} »`).toBeLessThanOrEqual(65);
    }
  });

  it('ont une meta description de 70 a 165 caracteres', () => {
    for (const s of SERVICES) {
      expect(s.metaDescription.length, s.slug).toBeGreaterThanOrEqual(70);
      expect(s.metaDescription.length, s.slug).toBeLessThanOrEqual(165);
    }
  });

  it('n’ont ni titre ni description en double', () => {
    expect(new Set(SERVICES.map((s) => s.titleSeo)).size).toBe(SERVICES.length);
    expect(new Set(SERVICES.map((s) => s.metaDescription)).size).toBe(SERVICES.length);
    expect(new Set(SERVICES.map((s) => s.h1)).size).toBe(SERVICES.length);
  });

  it('disent ce qui n’est pas compris', () => {
    // Une page qui ne liste que des inclusions produit des litiges de
    // perimetre. Dire non fait partie de l'offre.
    for (const s of SERVICES) expect(s.exclus.length, s.slug).toBeGreaterThanOrEqual(3);
  });

  it('decrivent un deroulement d’au moins quatre etapes', () => {
    for (const s of SERVICES) expect(s.deroulement.length, s.slug).toBeGreaterThanOrEqual(4);
  });

  it('portent au moins trois questions frequentes, avec des reponses substantielles', () => {
    for (const s of SERVICES) {
      expect(s.faq.length, s.slug).toBeGreaterThanOrEqual(3);
      for (const f of s.faq) {
        expect(f.question.endsWith('?'), `${s.slug} : « ${f.question} »`).toBe(true);
        expect(mots(f.reponse), `${s.slug} : « ${f.question} »`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('ne renvoient qu’a des services connexes existants, jamais a eux-memes', () => {
    for (const s of SERVICES) {
      for (const c of s.connexes) {
        expect(parSlug(c), `${s.slug} -> ${c}`).toBeDefined();
        expect(c).not.toBe(s.slug);
      }
    }
  });

  it('annoncent un prix de depart coherent avec la grille du catalogue', () => {
    for (const s of SERVICES) {
      expect(s.prixDepuis).toBeGreaterThan(0);
      expect(s.prixDepuis).toBeLessThan(20);
    }
  });
});

describe('communes', () => {
  it('ont des slugs et des codes postaux uniques', () => {
    expect(new Set(COMMUNES.map((c) => c.slug)).size).toBe(COMMUNES.length);
    expect(new Set(COMMUNES.map((c) => c.codePostal)).size).toBe(COMMUNES.length);
  });

  it('ont un code postal belge a quatre chiffres', () => {
    for (const c of COMMUNES) expect(c.codePostal).toMatch(/^\d{4}$/);
  });

  it('ont un titre SEO de 30 a 65 caracteres et une description de 70 a 165', () => {
    for (const c of COMMUNES) {
      expect(c.titleSeo.length, `${c.slug} : « ${c.titleSeo} »`).toBeGreaterThanOrEqual(30);
      expect(c.titleSeo.length, `${c.slug} : « ${c.titleSeo} »`).toBeLessThanOrEqual(65);
      expect(c.metaDescription.length, c.slug).toBeGreaterThanOrEqual(70);
      expect(c.metaDescription.length, c.slug).toBeLessThanOrEqual(165);
    }
  });

  it('n’ont ni titre, ni description, ni H1 en double', () => {
    expect(new Set(COMMUNES.map((c) => c.titleSeo)).size).toBe(COMMUNES.length);
    expect(new Set(COMMUNES.map((c) => c.metaDescription)).size).toBe(COMMUNES.length);
    expect(new Set(COMMUNES.map((c) => c.h1)).size).toBe(COMMUNES.length);
  });

  it('portent un contexte local d’au moins soixante mots', () => {
    // C'est le seuil en dessous duquel une page locale n'est plus qu'un
    // gabarit avec un nom substitue.
    for (const c of COMMUNES) {
      expect(c.contexte.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(mots(c.contexte.join(' ')), c.slug).toBeGreaterThanOrEqual(60);
      expect(mots(c.parcImmobilier), c.slug).toBeGreaterThanOrEqual(25);
    }
  });

  it('citent leur propre nom dans leur contexte', () => {
    for (const c of COMMUNES) {
      const racine = c.nom.split(/[\s'-]/)[0] ?? c.nom;
      expect(c.contexte.join(' ') + c.parcImmobilier, c.slug).toContain(racine);
    }
  });

  it('ne partagent aucun paragraphe de contexte entre elles', () => {
    const vus = new Map<string, string>();
    for (const c of COMMUNES) {
      for (const p of c.contexte) {
        const precedent = vus.get(p);
        expect(precedent, `${c.slug} reprend un paragraphe de ${precedent}`).toBeUndefined();
        vus.set(p, c.slug);
      }
    }
  });

  it('enoncent des specificites reellement locales, differentes d’une commune a l’autre', () => {
    const compte = new Map<string, number>();
    for (const c of COMMUNES) {
      expect(c.specificites.length, c.slug).toBeGreaterThanOrEqual(3);
      for (const s of c.specificites) compte.set(s, (compte.get(s) ?? 0) + 1);
    }
    const partagees = [...compte.entries()].filter(([, n]) => n > 1).map(([s]) => s);
    expect(partagees, 'specificites identiques sur plusieurs communes').toEqual([]);
  });

  it('ne renvoient qu’a des communes voisines existantes, jamais a elles-memes', () => {
    for (const c of COMMUNES) {
      expect(c.voisines.length, c.slug).toBeGreaterThanOrEqual(2);
      for (const v of c.voisines) {
        expect(communeParSlug(v), `${c.slug} -> ${v}`).toBeDefined();
        expect(v).not.toBe(c.slug);
      }
    }
  });

  it('ne mettent en avant que des services existants', () => {
    for (const c of COMMUNES) {
      expect(c.servicesPhares.length, c.slug).toBeGreaterThanOrEqual(1);
      for (const s of c.servicesPhares) expect(parSlug(s), `${c.slug} -> ${s}`).toBeDefined();
    }
  });

  it('declarent une distance coherente avec leur zone tarifaire', () => {
    for (const c of COMMUNES) {
      expect(c.distanceKm).toBeGreaterThanOrEqual(0);
      expect(c.distanceKm, `${c.slug} sort du rayon annonce`).toBeLessThanOrEqual(
        ENTREPRISE.rayonKm,
      );
      if (c.zone === 'exceptionnelle') {
        throw new Error(`${c.slug} : aucune page locale ne doit etre en zone exceptionnelle`);
      }
    }
  });

  it('placent Enghien a distance nulle, et elle seule', () => {
    const zero = COMMUNES.filter((c) => c.distanceKm === 0);
    expect(zero.map((c) => c.slug)).toEqual(['enghien']);
  });

  it('forment un maillage reciproque au moins partiel', () => {
    // Chaque commune doit etre citee par au moins une autre : une page locale
    // sans lien entrant depuis le reste du site n'est atteinte que par le
    // pied de page, ce qui suffit rarement.
    for (const c of COMMUNES) {
      const entrants = COMMUNES.filter((a) => a.voisines.includes(c.slug));
      expect(entrants.length, `${c.slug} n'a aucun lien entrant`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('entreprise', () => {
  it('expose des identifiants belges valides', () => {
    expect(ENTREPRISE.tva).toMatch(/^BE\d{10}$/);
    expect(ENTREPRISE.peppol).toBe(`9925:${ENTREPRISE.tva}`);
    expect(ENTREPRISE.telephoneE164).toMatch(/^\+32\d{8,9}$/);
    expect(ENTREPRISE.whatsapp).toBe(ENTREPRISE.telephoneE164.replace('+', ''));
  });

  it('a un numero affiche coherent avec sa forme internationale', () => {
    const chiffres = ENTREPRISE.telephone.replace(/\D/g, '');
    expect(`+32${chiffres.slice(1)}`).toBe(ENTREPRISE.telephoneE164);
  });

  it('se situe bien en Belgique', () => {
    expect(ENTREPRISE.latitude).toBeGreaterThan(49.4);
    expect(ENTREPRISE.latitude).toBeLessThan(51.6);
    expect(ENTREPRISE.longitude).toBeGreaterThan(2.5);
    expect(ENTREPRISE.longitude).toBeLessThan(6.5);
  });

  it('annonce quatre garanties et cinq etapes numerotees dans l’ordre', () => {
    expect(GARANTIES.length).toBe(4);
    expect(ETAPES_CLIENT.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5]);
  });
});
