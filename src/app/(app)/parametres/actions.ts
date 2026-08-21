'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { settingsUpdateSchema } from '@/lib/validation/settings';
import type { PropertyType } from '@/types/database';

export interface SettingsState {
  ok?: boolean;
  error?: string;
  issues?: string[];
}

function num(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

/**
 * Mise a jour de la grille tarifaire.
 *
 * La grille est la source unique du prix : la modifier ici change le
 * calculateur public, l'estimation d'une nouvelle demande et le devis, sans
 * deploiement. Les devis DEJA emis conservent leur montant — ils sont figes
 * en base.
 *
 * L'historique est ecrit par un trigger et non par cette action : une action
 * qui oublierait de journaliser rendrait le journal incomplet sans que
 * personne ne s'en apercoive.
 */
export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireCapability('settings.write');
  const supabase = await createClient();

  const { data: courant, error: lectureErreur } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle();

  if (lectureErreur || !courant) {
    return { error: 'Réglages introuvables. Appliquez les migrations.' };
  }

  const services = ['fin_de_chantier', 'apres_renovation', 'vitres'] as const;
  const niveaux = ['leger', 'standard', 'lourd'] as const;

  const prix_m2 = Object.fromEntries(
    services.map((s) => [
      s,
      Object.fromEntries(
        niveaux.map((n) => [
          n,
          { min: num(formData, `${s}.${n}.min`), max: num(formData, `${s}.${n}.max`) },
        ]),
      ),
    ]),
  );

  const zones = {
    principale: {
      frais: num(formData, 'zone.principale.frais'),
      libelle: String(formData.get('zone.principale.libelle') ?? ''),
    },
    secondaire: {
      frais: num(formData, 'zone.secondaire.frais'),
      libelle: String(formData.get('zone.secondaire.libelle') ?? ''),
    },
    exceptionnelle: {
      frais: num(formData, 'zone.exceptionnelle.frais'),
      libelle: String(formData.get('zone.exceptionnelle.libelle') ?? ''),
    },
  };

  const coef_bien = Object.fromEntries(
    (['studio', 'appartement', 'maison', 'villa', 'bureaux', 'commerce', 'autre'] as const).map(
      (b) => [b, num(formData, `coef.${b}`)],
    ),
  ) as Record<PropertyType, number>;

  const parsed = settingsUpdateSchema.safeParse({
    prix_m2,
    coef_bien,
    zones,
    majoration_urgence: num(formData, 'majoration_urgence') / 100,
    seuil_surface_devis: num(formData, 'seuil_surface_devis'),
    tva_taux: num(formData, 'tva_taux') / 100,
    delai_devis_heures: num(formData, 'delai_devis_heures'),
    garantie_heures: num(formData, 'garantie_heures'),
    tampon_trajet_min: num(formData, 'tampon_trajet_min'),
  });

  if (!parsed.success) {
    return {
      error: 'Certaines valeurs sont invalides.',
      issues: parsed.error.issues.map((i) => `${i.path.join(' · ')} : ${i.message}`),
    };
  }

  const { error } = await supabase
    .from('settings')
    .update({ ...parsed.data, updated_by: session.userId })
    .eq('id', true);

  if (error) {
    return { error: "L'enregistrement a échoué. Vérifiez vos droits." };
  }

  revalidatePath('/parametres');
  revalidatePath('/tableau-de-bord');
  return { ok: true };
}
