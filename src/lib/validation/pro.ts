import { z } from 'zod';

/**
 * Demande professionnelle (page /professionnels).
 *
 * Contrairement au rappel grand public, le lecteur ici est un
 * entrepreneur/promoteur/syndic qui veut une grille annuelle ou un devis
 * ponctuel : la societe, le volume approximatif et la frequence sont ce qui
 * permet de repondre avec un chiffre plutot qu'une question.
 */
export const demandeProSchema = z.object({
  societe: z.string().trim().min(2, 'Nom de société requis.').max(160, 'Trop long.'),
  contact: z.string().trim().min(2, 'Nom du contact requis.').max(120, 'Trop long.'),
  email: z.string().trim().email('Email invalide.').max(160, 'Trop long.'),
  telephone: z
    .string()
    .trim()
    .min(8, 'Numéro trop court.')
    .max(24, 'Numéro trop long.')
    .regex(/^[+0-9 ().\-/]{8,24}$/, 'Numéro invalide. Exemple : 0489 21 01 24'),
  besoin: z.enum(['ponctuel', 'annuel']),
  chantiersParMois: z.string().trim().max(40, 'Trop long.').optional().default(''),
  surfaceMoyenne: z.string().trim().max(40, 'Trop long.').optional().default(''),
  frequence: z.string().trim().max(80, 'Trop long.').optional().default(''),
  zone: z.string().trim().max(160, 'Trop long.').optional().default(''),
  message: z.string().trim().max(1000, 'Message trop long.').optional().default(''),
  /** Champ piege. Rempli = robot : les humains ne voient pas ce champ. */
  honeypot: z.string().max(0, 'Requete rejetee').default(''),
});

export type DemandeProInput = z.infer<typeof demandeProSchema>;
