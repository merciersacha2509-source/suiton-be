'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { emailSchema, nomSchema, telephoneSchema, communeSchema } from '@/lib/validation/common';

export interface ClientActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

export async function modifierClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  await requireCapability('clients.write');

  const parsed = z
    .object({
      clientId: z.string().uuid(),
      nom: nomSchema,
      email: emailSchema,
      telephone: telephoneSchema,
      commune: z.union([z.literal(''), communeSchema]).optional(),
      adresse: z.string().trim().max(160).optional(),
      code_postal: z.string().trim().max(10).optional(),
    })
    .safeParse({
      clientId: formData.get('clientId'),
      nom: formData.get('nom'),
      email: formData.get('email'),
      telephone: formData.get('telephone'),
      commune: formData.get('commune') || '',
      adresse: formData.get('adresse') || undefined,
      code_postal: formData.get('code_postal') || undefined,
    });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Champ invalide.' };

  const supabase = await createClient();
  const { clientId, ...champs } = parsed.data;
  const { error } = await supabase.from('clients').update(champs).eq('id', clientId);

  if (error) return { error: 'La mise à jour a échoué.' };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
  return { ok: true, message: 'Fiche mise à jour.' };
}
