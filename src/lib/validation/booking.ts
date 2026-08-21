import { z } from 'zod';
import {
  codePostalBeSchema,
  communeSchema,
  emailSchema,
  nomSchema,
  telephoneSchema,
  tvaBeSchema,
} from '@/lib/validation/common';

/**
 * Schema de la reservation publique. Livré au Sprint 1 parce que le Sprint 2
 * s'y branche directement et que le contrat d'entree doit etre fige avant
 * d'ecrire l'interface.
 *
 * Le MONTANT N'Y FIGURE PAS et n'y figurera jamais : il est recalcule cote
 * serveur a partir de la grille tarifaire.
 */
export const bookingSchema = z
  .object({
    service: z.enum(['fin_de_chantier', 'apres_renovation', 'vitres']),
    property_type: z.enum([
      'studio',
      'appartement',
      'maison',
      'villa',
      'bureaux',
      'commerce',
      'autre',
    ]),
    soil: z.enum(['leger', 'standard', 'lourd']),
    surface_m2: z.number().int().min(10, 'Surface minimale : 10 m²').max(5000),

    commune: communeSchema,
    code_postal: codePostalBeSchema,
    adresse: z.string().trim().max(160).optional(),

    urgent: z.boolean().default(false),
    date_souhaitee: z.string().date().optional(),

    photos: z.array(z.string().uuid()).max(8, 'Huit photos au maximum').default([]),

    /** Precisions libres du client. Bornees : un champ libre sans limite est
     *  un vecteur d'abus. */
    notes: z.string().trim().max(1000).optional(),

    nom: nomSchema,
    email: emailSchema,
    telephone: telephoneSchema,

    est_pro: z.boolean().default(false),
    tva: tvaBeSchema.optional(),

    consent_photos: z.boolean().default(false),
    consent_cgv: z.literal(true, { message: 'Les conditions doivent etre acceptees' }),

    /** Piege a robots : un humain ne le voit pas et le laisse vide. */
    honeypot: z.string().max(0, 'Requete rejetee').default(''),
  })
  .refine((d) => !d.est_pro || Boolean(d.tva), {
    message: 'Le numero de TVA est requis pour un professionnel',
    path: ['tva'],
  });

export type BookingInput = z.infer<typeof bookingSchema>;
