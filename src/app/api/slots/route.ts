import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';
import { estimateDuration } from '@/lib/pricing';
import type { SettingsRow } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requeteSchema = z.object({
  surface_m2: z.coerce.number().int().min(10).max(5000),
  soil: z.enum(['leger', 'standard', 'lourd']).default('standard'),
  jours: z.coerce.number().int().min(1).max(60).default(21),
});

/**
 * GET /api/slots — creneaux reellement libres.
 *
 * Le calcul est fait par la base, avec le meme critere de chevauchement que
 * la contrainte EXCLUDE : l'interface ne propose donc jamais un creneau que
 * la base refusera. La duree vient de la surface et de la salissure, pas
 * d'un choix du visiteur.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    await consommerQuota('slots', ipDepuisRequete(request.headers));

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { surface_m2, soil, jours } = requeteSchema.parse(params);

    const supabase = createAdminClient();

    const [{ data: settings }, { data: equipe }] = await Promise.all([
      supabase
        .from('settings')
        .select('tampon_trajet_min')
        .maybeSingle<Pick<SettingsRow, 'tampon_trajet_min'>>(),
      supabase.from('teams').select('id').eq('actif', true).order('nom').limit(1).maybeSingle(),
    ]);

    if (!equipe) {
      // Sans equipe configuree, mieux vaut une liste vide qu'une erreur :
      // le visiteur peut toujours poursuivre sans choisir de creneau.
      return { creneaux: [], duree_min: 0, duree_max: 0 };
    }

    const duree = estimateDuration({ surface_m2, soil });

    const depuis = new Date();
    const jusquAu = new Date(Date.now() + jours * 86_400_000);

    const { data, error } = await supabase.rpc('free_slots', {
      p_team_id: equipe.id,
      p_depuis: depuis.toISOString().slice(0, 10),
      p_jusqu_au: jusquAu.toISOString().slice(0, 10),
      p_duree_min: duree.max,
      p_tampon_min: settings?.tampon_trajet_min ?? 30,
    });

    if (error) {
      console.error('[slots] calcul impossible', error.message);
      return { creneaux: [], duree_min: duree.min, duree_max: duree.max };
    }

    const creneaux = (data ?? []).slice(0, 40).map((c: { debut: string; fin: string }) => ({
      debut: c.debut,
      fin: c.fin,
    }));

    return { creneaux, duree_min: duree.min, duree_max: duree.max };
  });
}
