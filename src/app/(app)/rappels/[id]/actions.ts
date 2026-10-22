'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export interface RappelActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const STAGES = ['nouveau', 'contacte', 'traite', 'perdu'] as const;

export async function changerEtapeRappelAction(
  _prev: RappelActionState,
  formData: FormData,
): Promise<RappelActionState> {
  await requireCapability('rappels.write');

  const parsed = z
    .object({
      rappelId: z.string().uuid(),
      stage: z.enum(STAGES),
      motif: z.string().trim().max(500).optional(),
    })
    .safeParse({
      rappelId: formData.get('rappelId'),
      stage: formData.get('stage'),
      motif: formData.get('motif') || undefined,
    });

  if (!parsed.success) return { error: 'Étape invalide.' };

  // Meme regle que pour un chantier perdu : sans motif, la raison se perd
  // avec la demande.
  if (parsed.data.stage === 'perdu' && !parsed.data.motif) {
    return { error: 'Indiquez pourquoi cette demande est perdue.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('rappels')
    .update({
      stage: parsed.data.stage,
      ...(parsed.data.stage === 'perdu' ? { perdu_motif: parsed.data.motif } : {}),
    })
    .eq('id', parsed.data.rappelId);

  if (error) return { error: 'La mise à jour a échoué.' };

  revalidatePath(`/rappels/${parsed.data.rappelId}`);
  revalidatePath('/rappels');
  return { ok: true, message: 'Étape mise à jour.' };
}
