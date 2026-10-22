import { z } from 'zod';
import { emailSchema } from '@/lib/validation/common';

/**
 * Demande de rappel.
 *
 * Le numero reste le seul champ vraiment necessaire : c'est ce qu'on promet
 * d'utiliser. E-mail et adresse sont facultatifs et n'apparaissent que sur
 * les formulaires qui en ont besoin (`avecEmail` / `avecAdresse` sur
 * `FormulaireRappel`) — le parcours contact d'origine n'en demande toujours
 * que trois : les ajouter ici sans les afficher partout serait inutile.
 */
export const rappelSchema = z.object({
  nom: z.string().trim().min(2, 'Votre nom, même le prénom seul.').max(120, 'Nom trop long.'),
  telephone: z
    .string()
    .trim()
    .min(8, 'Numéro trop court.')
    .max(24, 'Numéro trop long.')
    // Numeros belges et internationaux : on accepte les separateurs usuels
    // plutot que d'imposer un format que personne ne connait par cœur.
    .regex(/^[+0-9 ().\-/]{8,24}$/, 'Numéro invalide. Exemple : 0489 21 01 24'),
  /** Facultatif : chaine vide acceptee, sinon adresse e-mail valide. */
  email: z.union([z.literal(''), emailSchema]).optional().default(''),
  adresse: z.string().trim().max(160, 'Adresse trop longue.').optional().default(''),
  message: z.string().trim().max(1000, 'Message trop long.').optional().default(''),
  /** Page d'origine — permet de retrouver la demande dans le tableau de bord. */
  source: z.enum(['contact', 'nettoyage-auto', 'nettoyage-textile', 'fin-de-location', 'vitres']),
  /** Photos deposees via /api/photos/upload (memes id que la reservation). */
  photos: z.array(z.string().uuid()).max(8, 'Huit photos au maximum').optional().default([]),
  /** Champ piege. Rempli = robot : les humains ne voient pas ce champ. */
  honeypot: z.string().max(0, 'Requete rejetee').default(''),
});

export type RappelInput = z.infer<typeof rappelSchema>;
