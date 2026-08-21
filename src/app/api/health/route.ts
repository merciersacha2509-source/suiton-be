import { handle } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Sonde de sante. Verifie que la base repond, pas seulement que le processus
 * Node est vivant : un serveur qui repond 200 sans base ne sert a rien.
 */
export async function GET() {
  return handle(async () => {
    const supabase = await createClient();
    const started = Date.now();
    const { error } = await supabase.from('settings').select('id').limit(1);

    return {
      service: 'suiton-os',
      version: '1.0.0-sprint1',
      base: error ? 'indisponible' : 'ok',
      latence_ms: Date.now() - started,
      horodatage: new Date().toISOString(),
    };
  });
}
