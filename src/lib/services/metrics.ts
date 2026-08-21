import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Rafraichit la ligne de metriques d'un chantier.
 *
 * Appelee a chaque etape du cycle de vie. La fonction SQL recalcule
 * INTEGRALEMENT la ligne : elle est idempotente, et on evite ainsi des
 * compteurs incrementaux qui finissent toujours par deriver.
 *
 * Best effort : un echec de rafraichissement ne doit jamais faire echouer
 * l'operation metier. Une statistique en retard se rattrape au prochain
 * passage ; un devis perdu, non.
 */
export async function rafraichirMetriques(jobId: string): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc('rafraichir_metriques', {
      p_job_id: jobId,
    });
    if (error) console.warn('[metrics] rafraîchissement impossible', error.message);
  } catch (e) {
    console.warn('[metrics] rafraîchissement impossible', e);
  }
}
