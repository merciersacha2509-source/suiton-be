'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export interface PlaybookState {
  ok?: boolean;
  message?: string;
  error?: string;
}

/**
 * Accepter une recommandation LANCE l'expérience.
 *
 * C'est le maillon qui fermait mal la boucle : une recommandation acceptée
 * qui ne devient pas une expérience mesurée n'apprend rien — c'est une
 * intention. Ici, accepter crée le test, prêt à être mesuré.
 */
export async function accepterEtLancerAction(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  const session = await requireCapability('settings.write');

  const parsed = z
    .object({
      code: z.string().min(3).max(200),
      famille: z.enum(['tarification', 'planning', 'prospection', 'qualite', 'productivite']),
      titre: z.string().min(3).max(300),
      action: z.string().min(3).max(600),
      modeleCode: z.string().min(2).max(60),
      intervention: z.string().trim().min(3).max(300),
      hypothese: z.string().trim().min(10).max(500),
      dureeJours: z.coerce.number().int().min(30).max(365),
      indicateur: z.enum(['ca_horaire', 'minutes_par_m2', 'facture_htva', 'couverture_photo']),
      seuilEffet: z.coerce.number().min(1).max(100),
      seuilN: z.coerce.number().int().min(3).max(50),
      gainMin: z.coerce.number().nullable().optional(),
      gainMax: z.coerce.number().nullable().optional(),
      chantiers: z.coerce.number().int().min(0).default(0),
      confiance: z.enum(['aucune', 'faible', 'moyenne', 'bonne', 'elevee']),
      propertyType: z.string().optional(),
      bande: z.string().optional(),
      soil: z.string().optional(),
      service: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Plan invalide.' };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const aujourdhui = new Date();

  // Référence de durée identique, juste avant. Comparer trois mois d'hiver à
  // six mois d'été mesurerait la saison, pas l'expérience.
  const jour = (dt: Date) => dt.toISOString().slice(0, 10);
  const refDebut = new Date(aujourdhui.getTime() - d.dureeJours * 2 * 86_400_000);
  const refFin = new Date(aujourdhui.getTime() - 86_400_000);
  const testFin = new Date(aujourdhui.getTime() + d.dureeJours * 86_400_000);

  const { data: experience, error: erreurExp } = await supabase
    .from('experiences')
    .insert({
      titre: d.titre,
      hypothese: d.hypothese,
      famille: d.famille,
      statut: 'en_cours',
      modele_code: d.modeleCode,
      recommandation_code: d.code,
      intervention: d.intervention,
      indicateur: d.indicateur,
      seuil_effet_pct: d.seuilEffet,
      seuil_n: d.seuilN,
      service: d.service || null,
      property_type: d.propertyType || null,
      bande: d.bande || null,
      soil: d.soil || null,
      reference_debut: jour(refDebut),
      reference_fin: jour(refFin),
      test_debut: jour(aujourdhui),
      test_fin: jour(testFin),
      cree_par: session.userId,
    })
    .select('id')
    .single();

  if (erreurExp || !experience) {
    return { error: `Lancement impossible : ${erreurExp?.message ?? 'inconnu'}` };
  }

  const { error } = await supabase.from('recommandations').upsert(
    {
      code: d.code,
      famille: d.famille,
      statut: 'experimentee',
      titre: d.titre,
      action: d.action,
      gain_min: d.gainMin,
      gain_max: d.gainMax,
      chantiers_concernes: d.chantiers,
      confiance: d.confiance,
      experience_id: experience.id,
      decide_par: session.userId,
      decide_le: new Date().toISOString(),
    },
    { onConflict: 'code' },
  );

  if (error) return { error: "La recommandation n'a pas pu être tracée." };

  revalidatePath('/playbook');
  revalidatePath('/intelligence');

  return {
    ok: true,
    message: `Expérience lancée pour ${d.dureeJours} jours. Le système comparera avec les ${d.dureeJours} jours précédents et vous proposera une décision.`,
  };
}

/* -------------------------------------------------------------------------- */

export async function reporterAction(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  const session = await requireCapability('settings.write');

  const parsed = z
    .object({
      code: z.string().min(3),
      famille: z.enum(['tarification', 'planning', 'prospection', 'qualite', 'productivite']),
      titre: z.string().min(3),
      action: z.string().min(3),
      date: z.string().date(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: 'Date invalide.' };

  if (new Date(parsed.data.date) <= new Date()) {
    return { error: 'Choisissez une date future.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('recommandations').upsert(
    {
      code: parsed.data.code,
      famille: parsed.data.famille,
      statut: 'reportee',
      titre: parsed.data.titre,
      action: parsed.data.action,
      reportee_au: parsed.data.date,
      decide_par: session.userId,
      decide_le: new Date().toISOString(),
    },
    { onConflict: 'code' },
  );

  if (error) return { error: 'Le report a échoué.' };

  revalidatePath('/playbook');
  return {
    ok: true,
    message: `Reportée au ${parsed.data.date}. Elle réapparaîtra à cette date.`,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * Décision finale sur une expérience.
 *
 * La valeur annuelle n'est enregistrée QUE sur une généralisation. Une
 * expérience prolongée ou arrêtée ne produit aucune valeur comptabilisée :
 * on ne compte pas ce qu'on n'a pas prouvé.
 */
export async function trancherAction(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  await requireCapability('settings.write');

  const parsed = z
    .object({
      id: z.string().uuid(),
      decision: z.enum(['generaliser', 'prolonger', 'arreter']),
      conclusion: z.string().trim().min(5).max(600),
      valeur: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: 'Notez ce que vous retenez de cette expérience.' };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const maj: Record<string, unknown> = {
    decision: d.decision,
    decide_le: new Date().toISOString(),
    conclusion: d.conclusion,
  };

  if (d.decision === 'prolonger') {
    // On repousse la fin de test de la même durée, l'expérience continue.
    const { data: e } = await supabase
      .from('experiences')
      .select('test_debut, test_fin')
      .eq('id', d.id)
      .maybeSingle();

    if (e?.test_fin) {
      const duree = new Date(e.test_fin).getTime() - new Date(String(e.test_debut)).getTime();
      maj.test_fin = new Date(new Date(e.test_fin).getTime() + duree)
        .toISOString()
        .slice(0, 10);
    }
    maj.statut = 'en_cours';
    maj.decision = 'prolonger';
  } else {
    maj.statut = 'terminee';
    // Seule une généralisation porte une valeur.
    maj.valeur_annuelle = d.decision === 'generaliser' ? (d.valeur ?? null) : null;
  }

  const { error } = await supabase.from('experiences').update(maj).eq('id', d.id);
  if (error) return { error: 'La décision n’a pas pu être enregistrée.' };

  revalidatePath('/playbook');
  revalidatePath('/intelligence');

  const messages = {
    generaliser:
      'Généralisée. Pensez à ajuster la grille tarifaire en conséquence — le système ne le fait pas pour vous.',
    prolonger: 'Prolongée. Le système continuera de mesurer.',
    arreter: 'Arrêtée. Le résultat est conservé dans la mémoire d’entreprise.',
  };

  return { ok: true, message: messages[d.decision] };
}
