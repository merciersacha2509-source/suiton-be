'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export interface DecisionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const FAMILLES = [
  'tarification',
  'planning',
  'prospection',
  'qualite',
  'productivite',
] as const;

/**
 * Trace une decision sur une recommandation.
 *
 * Le moteur recalcule les recommandations a chaque affichage — elles sont
 * deterministes. Ce qu'on enregistre ici, c'est la DECISION : ce qui a ete
 * accepte, rejete, et pourquoi. Sans cette trace, on repropose indefiniment
 * ce que le dirigeant a deja ecarte pour de bonnes raisons.
 *
 * L'instantane du contexte est conserve : c'est la seule facon de juger
 * apres coup si la decision etait raisonnable AVEC LES DONNEES DE L'EPOQUE.
 */
export async function deciderAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const session = await requireCapability('settings.write');

  const parsed = z
    .object({
      code: z.string().min(3).max(200),
      famille: z.enum(FAMILLES),
      titre: z.string().min(3).max(300),
      action: z.string().min(3).max(600),
      statut: z.enum(['acceptee', 'rejetee']),
      motif: z.string().trim().max(500).optional(),
      gainMin: z.coerce.number().nullable().optional(),
      gainMax: z.coerce.number().nullable().optional(),
      chantiers: z.coerce.number().int().min(0).default(0),
      confiance: z.enum(['aucune', 'faible', 'moyenne', 'bonne', 'elevee']),
      contexte: z.string().optional(),
    })
    .safeParse({
      code: formData.get('code'),
      famille: formData.get('famille'),
      titre: formData.get('titre'),
      action: formData.get('action'),
      statut: formData.get('statut'),
      motif: formData.get('motif') || undefined,
      gainMin: formData.get('gainMin') || null,
      gainMax: formData.get('gainMax') || null,
      chantiers: formData.get('chantiers') || 0,
      confiance: formData.get('confiance'),
      contexte: formData.get('contexte') || undefined,
    });

  if (!parsed.success) return { error: 'Décision invalide.' };

  // Un rejet sans motif ne s'apprend pas : dans six mois, on ne saura plus
  // si c'était une mauvaise idée ou juste le mauvais moment.
  if (parsed.data.statut === 'rejetee' && !parsed.data.motif) {
    return { error: 'Indiquez pourquoi vous écartez cette recommandation.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('recommandations').upsert(
    {
      code: parsed.data.code,
      famille: parsed.data.famille,
      statut: parsed.data.statut,
      titre: parsed.data.titre,
      action: parsed.data.action,
      contexte: parsed.data.contexte ? JSON.parse(parsed.data.contexte) : {},
      gain_min: parsed.data.gainMin,
      gain_max: parsed.data.gainMax,
      chantiers_concernes: parsed.data.chantiers,
      confiance: parsed.data.confiance,
      decide_par: session.userId,
      decide_le: new Date().toISOString(),
      motif_rejet: parsed.data.motif ?? null,
    },
    { onConflict: 'code' },
  );

  if (error) return { error: "L'enregistrement a échoué." };

  revalidatePath('/intelligence');

  return {
    ok: true,
    message:
      parsed.data.statut === 'acceptee'
        ? 'Décision enregistrée. Mesurez le résultat dans trois mois.'
        : 'Recommandation écartée. Elle ne sera plus proposée.',
  };
}

/* -------------------------------------------------------------------------- */

/**
 * Lance une expérience contrôlée.
 *
 * La période de référence est toujours prise AVANT la période de test, sur
 * une durée équivalente : comparer trois mois d'hiver à six mois d'été
 * mesurerait la saison, pas l'expérience.
 */
export async function lancerExperienceAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const session = await requireCapability('settings.write');

  const parsed = z
    .object({
      titre: z.string().trim().min(5).max(200),
      hypothese: z.string().trim().min(10).max(500),
      famille: z.enum(FAMILLES),
      dureeJours: z.coerce.number().int().min(30).max(365),
      indicateur: z.enum(['ca_horaire', 'minutes_par_m2', 'facture_htva', 'couverture_photo']),
      service: z.string().optional(),
      propertyType: z.string().optional(),
      bande: z.string().optional(),
    })
    .safeParse({
      titre: formData.get('titre'),
      hypothese: formData.get('hypothese'),
      famille: formData.get('famille'),
      dureeJours: formData.get('dureeJours'),
      indicateur: formData.get('indicateur'),
      service: formData.get('service') || undefined,
      propertyType: formData.get('propertyType') || undefined,
      bande: formData.get('bande') || undefined,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Paramètres invalides.' };
  }

  const aujourdhui = new Date();
  const duree = parsed.data.dureeJours;

  // Référence de durée identique, juste avant : sinon on compare des saisons.
  const referenceDebut = new Date(aujourdhui.getTime() - duree * 2 * 86_400_000);
  const referenceFin = new Date(aujourdhui.getTime() - 86_400_000);
  const testFin = new Date(aujourdhui.getTime() + duree * 86_400_000);

  const jour = (d: Date) => d.toISOString().slice(0, 10);
  const supabase = await createClient();

  const { error } = await supabase.from('experiences').insert({
    titre: parsed.data.titre,
    hypothese: parsed.data.hypothese,
    famille: parsed.data.famille,
    statut: 'en_cours',
    indicateur: parsed.data.indicateur,
    service: parsed.data.service ?? null,
    property_type: parsed.data.propertyType ?? null,
    bande: parsed.data.bande ?? null,
    reference_debut: jour(referenceDebut),
    reference_fin: jour(referenceFin),
    test_debut: jour(aujourdhui),
    test_fin: jour(testFin),
    cree_par: session.userId,
  });

  if (error) return { error: `Lancement impossible : ${error.message}` };

  revalidatePath('/intelligence');
  return {
    ok: true,
    message: `Expérience lancée pour ${duree} jours. Le système comparera automatiquement avec les ${duree} jours précédents.`,
  };
}

export async function cloturerExperienceAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  await requireCapability('settings.write');

  const id = String(formData.get('id') ?? '');
  const conclusion = String(formData.get('conclusion') ?? '').trim();

  if (!z.string().uuid().safeParse(id).success) return { error: 'Expérience invalide.' };
  if (conclusion.length < 5) return { error: 'Notez ce que vous retenez de cette expérience.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('experiences')
    .update({ statut: 'terminee', conclusion, test_fin: new Date().toISOString().slice(0, 10) })
    .eq('id', id);

  if (error) return { error: 'La clôture a échoué.' };

  revalidatePath('/intelligence');
  return { ok: true, message: 'Expérience clôturée.' };
}
