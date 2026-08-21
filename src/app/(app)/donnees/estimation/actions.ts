'use server';

import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { estimationAssistee } from '@/lib/services/analytics';
import { zonePourCodePostal } from '@/lib/zones';
import type { NiveauConfiance, SettingsRow } from '@/types/database';

export interface EstimationState {
  resultat?: {
    dureeMin: number;
    dureeMax: number;
    prixMin: number | null;
    prixMax: number | null;
    caHoraire: number | null;
    confiance: NiveauConfiance;
    explication: string;
    alertes: string[];
    grilleMin: number;
    grilleMax: number;
    zone: string;
  };
  error?: string;
}

const schema = z.object({
  service: z.enum(['fin_de_chantier', 'apres_renovation', 'vitres']),
  propertyType: z.enum([
    'studio',
    'appartement',
    'maison',
    'villa',
    'bureaux',
    'commerce',
    'autre',
  ]),
  soil: z.enum(['leger', 'standard', 'lourd']),
  surface: z.coerce.number().int().min(10).max(5000),
  codePostal: z.string().regex(new RegExp('^[0-9]{4}$'), 'Code postal belge à 4 chiffres'),
  techniciens: z.coerce.number().int().min(1).max(6),
  urgent: z.coerce.boolean().default(false),
});

/**
 * Estimation assistee.
 *
 * Le calcul vit dans `lib/intelligence` et les agregats dans les vues SQL :
 * cette action ne fait que router. Toute regle ajoutee ici finirait par
 * diverger de celle appliquee au moment de produire le devis.
 */
export async function estimerAction(
  _prev: EstimationState,
  formData: FormData,
): Promise<EstimationState> {
  await requireCapability('quotes.write');

  const parsed = schema.safeParse({
    service: formData.get('service'),
    propertyType: formData.get('propertyType'),
    soil: formData.get('soil'),
    surface: formData.get('surface'),
    codePostal: formData.get('codePostal'),
    techniciens: formData.get('techniciens'),
    urgent: formData.get('urgent') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Paramètres invalides.' };
  }

  // Client de session, pas le client de service : la politique
  // `settings_read` autorise deja tout utilisateur authentifie a lire les
  // reglages. Contourner la RLS ici n'apporterait rien.
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle<SettingsRow>();

  if (!settings) return { error: 'Réglages absents.' };

  const zone = zonePourCodePostal(parsed.data.codePostal);

  const r = await estimationAssistee({
    service: parsed.data.service,
    propertyType: parsed.data.propertyType,
    surface: parsed.data.surface,
    soil: parsed.data.soil,
    zone,
    urgent: parsed.data.urgent,
    techniciens: parsed.data.techniciens,
    settings,
  });

  return {
    resultat: {
      dureeMin: r.dureeMin,
      dureeMax: r.dureeMax,
      prixMin: r.prixMin,
      prixMax: r.prixMax,
      caHoraire: r.caHoraire,
      confiance: r.confiance,
      explication: r.explication,
      alertes: r.alertes,
      grilleMin: r.grille.min,
      grilleMax: r.grille.max,
      zone,
    },
  };
}
