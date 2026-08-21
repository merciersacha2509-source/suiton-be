import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { RateLimitError } from '@/lib/errors';

/**
 * Limitation de debit adossee a la base.
 *
 * Un compteur en memoire ne limite rien sur Vercel : chaque requete peut
 * atterrir sur une instance differente. La table `rate_limits` et la
 * fonction `consume_rate_limit` sont donc la seule source de verite.
 */

export interface Quota {
  /** Nombre d'appels autorises dans la fenetre. */
  limite: number;
  /** Duree de la fenetre, en secondes. */
  fenetreSecondes: number;
}

export const QUOTAS = {
  booking: { limite: 10, fenetreSecondes: 3600 },
  draft: { limite: 30, fenetreSecondes: 3600 },
  upload: { limite: 20, fenetreSecondes: 3600 },
  slots: { limite: 60, fenetreSecondes: 3600 },
  // Un rappel se demande une fois, pas dix. Une limite basse suffit et rend
  // le formulaire inutile comme relais de spam.
  rappel: { limite: 5, fenetreSecondes: 3600 },
  portail: { limite: 60, fenetreSecondes: 3600 },
  portail_action: { limite: 10, fenetreSecondes: 3600 },
} as const satisfies Record<string, Quota>;

export type QuotaName = keyof typeof QUOTAS;

/**
 * Consomme un jeton de quota. Leve RateLimitError si le quota est epuise.
 *
 * En cas d'indisponibilite de la base, on LAISSE PASSER. Bloquer toutes les
 * reservations parce que le compteur est en panne coute plus cher que de
 * laisser passer quelques requetes de trop.
 */
export async function consommerQuota(nom: QuotaName, cle: string): Promise<void> {
  const quota = QUOTAS[nom];
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_bucket: nom,
    p_cle: cle,
    p_limite: quota.limite,
    p_fenetre_secondes: quota.fenetreSecondes,
  });

  if (error) {
    console.error('[rate-limit] compteur indisponible, requete laissee passer', error.message);
    return;
  }

  const ligne = Array.isArray(data) ? data[0] : data;
  if (ligne && ligne.autorise === false) {
    throw new RateLimitError(
      'Trop de demandes depuis cette connexion. Réessayez plus tard, ou appelez le 0489 21 01 24.',
      ligne.reset_dans ?? quota.fenetreSecondes,
    );
  }
}

/**
 * Adresse IP du client.
 *
 * Sur Vercel, x-forwarded-for peut contenir une chaine de proxys ; la
 * premiere entree est l'adresse d'origine. On tronque a 45 caracteres
 * (longueur maximale d'une IPv6) pour ne pas laisser un en-tete forge
 * remplir la table.
 */
export function ipDepuisRequete(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const brut = forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'inconnue';
  return brut.slice(0, 45);
}
