import { z } from 'zod';

/**
 * Demande de rappel.
 *
 * Trois champs. C'est un choix, pas une omission : le parcours de
 * reservation collecte deja tout ce qu'il faut pour chiffrer. Ce formulaire
 * s'adresse a l'autre visiteur — celui qui veut qu'on l'appelle, sans
 * remplir six etapes. Lui demander sa surface et son code postal le ferait
 * partir.
 *
 * Le numero est le seul champ vraiment necessaire : c'est ce qu'on promet
 * d'utiliser.
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
  message: z.string().trim().max(1000, 'Message trop long.').optional().default(''),
  /** Photos deposees via /api/photos/upload (memes id que la reservation). */
  photos: z.array(z.string().uuid()).max(8, 'Huit photos au maximum').optional().default([]),
  /** Champ piege. Rempli = robot : les humains ne voient pas ce champ. */
  honeypot: z.string().max(0, 'Requete rejetee').default(''),
});

export type RappelInput = z.infer<typeof rappelSchema>;
