import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { GrillePublique } from '@/lib/pricing';

/**
 * Grille tarifaire pour les pages publiques.
 *
 * Les pages du site sont regenerees par ISR : la grille est lue une fois par
 * fenetre de revalidation, pas a chaque visite. Le calculateur affiche donc
 * une estimation instantanee, sans aller-retour reseau a la frappe.
 *
 * Le repli n'est pas un detail de confort : si Supabase est indisponible au
 * moment d'une regeneration, un site commercial qui renvoie une erreur 500
 * perd des demandes. Il vaut mieux afficher une estimation issue du dernier
 * catalogue connu — et le devis, lui, reste toujours recalcule cote serveur
 * a partir de la vraie ligne `settings`.
 */
export type { GrillePublique };

/** Repli aligne sur `20260901000900_seed_settings.sql`. */
export const GRILLE_REPLI: GrillePublique = {
  prix_m2: {
    fin_de_chantier: {
      leger: { min: 5, max: 5 },
      standard: { min: 7, max: 8 },
      lourd: { min: 10, max: 14 },
    },
    apres_renovation: {
      leger: { min: 4, max: 5 },
      standard: { min: 6, max: 7 },
      lourd: { min: 9, max: 12 },
    },
    vitres: {
      leger: { min: 3, max: 4 },
      standard: { min: 4, max: 5 },
      lourd: { min: 6, max: 8 },
    },
  },
  // Neutres : le catalogue de repli ne doit pas majorer ni minorer.
  coef_bien: {
    studio: 1,
    appartement: 1,
    maison: 1,
    villa: 1,
    bureaux: 1,
    commerce: 1,
    autre: 1,
  },
  zones: {
    principale: { frais: 0, libelle: 'Enghien et 20 km' },
    secondaire: { frais: 25, libelle: 'Brabant wallon, Hainaut' },
    exceptionnelle: { frais: 800, libelle: 'Hors zone — sur devis' },
  },
  majoration_urgence: 0.25,
  seuil_surface_devis: 400,
  delai_devis_heures: 24,
};

/**
 * Delai au-dela duquel on cesse d'attendre la base.
 *
 * Sans plafond explicite, une base injoignable ne provoque pas une erreur :
 * elle provoque une ATTENTE. Mesure en conditions degradees, la page de
 * reservation mettait 7 secondes a repondre avant de basculer sur le
 * catalogue — le repli fonctionnait, mais sept secondes apres.
 *
 * Deux secondes suffisent tres largement : une lecture d'une ligne sur une
 * base saine repond en quelques millisecondes. Au-dela, quelque chose ne va
 * pas, et il vaut mieux servir une estimation issue du catalogue tout de
 * suite qu'un ecran blanc plus tard. Le devis, lui, reste toujours calcule
 * a partir de la vraie ligne `settings`.
 */
const DELAI_MAX_MS = 2_000;

export const grillePublique = cache(async (): Promise<GrillePublique> => {
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), DELAI_MAX_MS);
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('settings')
      .select(
        'prix_m2, coef_bien, zones, majoration_urgence, seuil_surface_devis, delai_devis_heures',
      )
      .abortSignal(arret.signal)
      .maybeSingle<GrillePublique>();
    return data ?? GRILLE_REPLI;
  } catch {
    return GRILLE_REPLI;
  } finally {
    clearTimeout(minuteur);
  }
});
