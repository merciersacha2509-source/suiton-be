import { z } from 'zod';
import { emailSchema } from '@/lib/validation/common';

export const loginSchema = z.object({
  email: emailSchema,
  motDePasse: z.string().min(8, 'Le mot de passe fait au moins 8 caracteres').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
