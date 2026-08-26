import { describe, expect, it } from 'vitest';
import { bookingSchema } from '@/lib/validation/booking';
import { settingsUpdateSchema } from '@/lib/validation/settings';

const VALIDE = {
  service: 'fin_de_chantier',
  property_type: 'maison',
  soil: 'standard',
  surface_m2: 140,
  commune: 'Nivelles',
  code_postal: '1400',
  urgent: false,
  photos: [],
  nom: 'Jean Dupont',
  email: 'jean@example.be',
  telephone: '0489 21 01 24',
  est_pro: false,
  consent_photos: false,
  consent_cgv: true,
  honeypot: '',
};

describe('bookingSchema', () => {
  it('accepte une demande particulier complete', () => {
    expect(bookingSchema.safeParse(VALIDE).success).toBe(true);
  });

  it('refuse une demande dont le piege a robots est rempli', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, honeypot: 'http://spam' });
    expect(r.success).toBe(false);
  });

  it('exige un numero de TVA pour un professionnel', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, est_pro: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('tva'))).toBe(true);
    }
  });

  it('accepte un professionnel avec un numero de TVA belge valide', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, est_pro: true, tva: 'BE0123456789' });
    expect(r.success).toBe(true);
  });

  it('refuse une surface hors bornes', () => {
    expect(bookingSchema.safeParse({ ...VALIDE, surface_m2: 5 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...VALIDE, surface_m2: 9000 }).success).toBe(false);
  });

  it('refuse plus de huit photos', () => {
    const photos = Array.from({ length: 9 }, () => '00000000-0000-4000-8000-000000000000');
    expect(bookingSchema.safeParse({ ...VALIDE, photos }).success).toBe(false);
  });

  it('exige l’acceptation des conditions', () => {
    expect(bookingSchema.safeParse({ ...VALIDE, consent_cgv: false }).success).toBe(false);
  });

  it('n’accepte AUCUN montant en entree', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, montant: 1, prix: 999 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect('montant' in r.data).toBe(false);
      expect('prix' in r.data).toBe(false);
    }
  });

  it('normalise l’adresse e-mail en minuscules', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, email: '  Jean@Example.BE ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('jean@example.be');
  });
});

describe('settingsUpdateSchema', () => {
  const base = {
    prix_m2: {
      fin_de_chantier: {
        standard: { min: 7, max: 8 },
        lourd: { min: 10, max: 14 },
      },
      vitres: {
        standard: { min: 4, max: 5 },
        lourd: { min: 6, max: 8 },
      },
    },
    zones: {
      principale: { frais: 0, libelle: 'Enghien' },
      secondaire: { frais: 25, libelle: 'Hainaut' },
      exceptionnelle: { frais: 800, libelle: 'Hors zone' },
    },
    coef_bien: {
      studio: 1,
      appartement: 1,
      maison: 1,
      villa: 1,
      bureaux: 1,
      commerce: 1,
      autre: 1,
    },
    majoration_urgence: 0.2,
    seuil_surface_devis: 300,
    tva_taux: 0.21,
    delai_devis_heures: 24,
    garantie_heures: 48,
    tampon_trajet_min: 30,
  };

  it('accepte une grille coherente', () => {
    expect(settingsUpdateSchema.safeParse(base).success).toBe(true);
  });

  it('refuse une fourchette inversee', () => {
    const casse = structuredClone(base);
    casse.prix_m2.fin_de_chantier.standard = { min: 9, max: 7 };
    const r = settingsUpdateSchema.safeParse(casse);
    expect(r.success).toBe(false);
  });

  it('refuse un taux de TVA aberrant', () => {
    expect(settingsUpdateSchema.safeParse({ ...base, tva_taux: 0.9 }).success).toBe(false);
  });
});

describe('coefficients par type de bien', () => {
  const grille = {
    prix_m2: {
      fin_de_chantier: {
        standard: { min: 7, max: 8 },
        lourd: { min: 10, max: 14 },
      },
      vitres: {
        standard: { min: 4, max: 5 },
        lourd: { min: 6, max: 8 },
      },
    },
    coef_bien: {
      studio: 1,
      appartement: 1,
      maison: 1,
      villa: 1,
      bureaux: 1,
      commerce: 1,
      autre: 1,
    },
    zones: {
      principale: { frais: 0, libelle: 'Enghien' },
      secondaire: { frais: 25, libelle: 'Hainaut' },
      exceptionnelle: { frais: 800, libelle: 'Hors zone' },
    },
    majoration_urgence: 0.2,
    seuil_surface_devis: 300,
    tva_taux: 0.21,
    delai_devis_heures: 24,
    garantie_heures: 48,
    tampon_trajet_min: 30,
  };

  it('accepte un ajustement raisonnable', () => {
    const r = structuredClone(grille);
    r.coef_bien.villa = 1.2;
    expect(settingsUpdateSchema.safeParse(r).success).toBe(true);
  });

  it('refuse un coefficient aberrant — la faute de frappe qui multiplie par dix', () => {
    const r = structuredClone(grille);
    r.coef_bien.villa = 12;
    expect(settingsUpdateSchema.safeParse(r).success).toBe(false);
  });

  it('refuse un coefficient qui diviserait le devis par dix', () => {
    const r = structuredClone(grille);
    r.coef_bien.studio = 0.1;
    expect(settingsUpdateSchema.safeParse(r).success).toBe(false);
  });

  it('refuse une grille a laquelle il manque un type de bien', () => {
    const r = structuredClone(grille) as Record<string, unknown>;
    delete (r.coef_bien as Record<string, number>).bureaux;
    expect(settingsUpdateSchema.safeParse(r).success).toBe(false);
  });
});
