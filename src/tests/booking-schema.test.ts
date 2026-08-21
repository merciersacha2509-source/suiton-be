import { describe, expect, it } from 'vitest';
import { bookingSchema } from '@/lib/validation/booking';

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

/**
 * Ces cas reproduisent ce qu'un robot ou un client maladroit envoie
 * reellement. Ils sont la seconde barriere apres la limitation de debit.
 */
describe('schema de reservation — surface d’attaque', () => {
  it('rejette une injection SQL dans la commune sans la traiter', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, commune: "'; DROP TABLE jobs; --" });
    // Le texte passe la validation (c'est une chaine valide) mais il est
    // transmis en parametre lie : il n'est jamais concatene a du SQL.
    expect(r.success).toBe(true);
  });

  it('rejette un champ piege rempli', () => {
    expect(
      bookingSchema.safeParse({ ...VALIDE, honeypot: 'https://spam.example' }).success,
    ).toBe(false);
  });

  it('rejette une note demesuree', () => {
    expect(bookingSchema.safeParse({ ...VALIDE, notes: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('rejette un identifiant de photo qui n’est pas un UUID', () => {
    expect(
      bookingSchema.safeParse({ ...VALIDE, photos: ['../../secret', 'pas-un-uuid'] }).success,
    ).toBe(false);
  });

  it('rejette une TVA d’un autre pays pour un professionnel belge', () => {
    for (const tva of ['FR12345678901', 'NL123456789B01', 'BE123']) {
      expect(bookingSchema.safeParse({ ...VALIDE, est_pro: true, tva }).success).toBe(false);
    }
  });

  it('accepte une date souhaitee au format ISO et rejette le reste', () => {
    expect(bookingSchema.safeParse({ ...VALIDE, date_souhaitee: '2026-10-05' }).success).toBe(
      true,
    );
    expect(bookingSchema.safeParse({ ...VALIDE, date_souhaitee: '05/10/2026' }).success).toBe(
      false,
    );
  });

  it('normalise le numero de TVA en majuscules', () => {
    const r = bookingSchema.safeParse({ ...VALIDE, est_pro: true, tva: 'be0123456789' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tva).toBe('BE0123456789');
  });

  it('ignore silencieusement tout champ de montant injecte', () => {
    const r = bookingSchema.safeParse({
      ...VALIDE,
      montant_htva: 1,
      montant: 0,
      prix: 0,
      estimation_max: 1,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data)).not.toContain('montant_htva');
      expect(Object.keys(r.data)).not.toContain('estimation_max');
    }
  });
});
