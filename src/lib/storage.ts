import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Acces au stockage.
 *
 * Les buckets sont prives : aucune URL n'est devinable, aucun fichier n'est
 * servi directement. Toute lecture passe par une URL signee de courte duree,
 * generee ici.
 *
 * Ce module existe pour concentrer l'usage du client de service en UN point
 * verifiable, au lieu de le laisser essaimer dans les pages. La regle ESLint
 * `no-restricted-imports` interdit d'importer le client admin ailleurs.
 */

export type Bucket = 'chantiers' | 'documents';

const DUREE_PAR_DEFAUT = 900; // 15 minutes

export async function urlSignee(
  bucket: Bucket,
  chemin: string,
  secondes = DUREE_PAR_DEFAUT,
): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(chemin, secondes);

  if (error) {
    console.error(`[storage] signature impossible (${bucket}/${chemin})`, error.message);
    return null;
  }
  return data.signedUrl;
}

/** Signe plusieurs chemins en parallele. Les echecs deviennent null. */
export async function urlsSignees(
  bucket: Bucket,
  chemins: string[],
  secondes = DUREE_PAR_DEFAUT,
): Promise<(string | null)[]> {
  return Promise.all(chemins.map((c) => urlSignee(bucket, c, secondes)));
}

/**
 * Recupere un document archive.
 *
 * Sert a joindre le PDF a l'e-mail : un lien signe expire, une piece jointe
 * reste dans la boite du client pour toujours.
 */
export async function telecharger(bucket: Bucket, chemin: string): Promise<Buffer | null> {
  const { data, error } = await createAdminClient().storage.from(bucket).download(chemin);

  if (error || !data) {
    console.error(`[storage] téléchargement impossible (${bucket}/${chemin})`, error?.message);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function televerser(
  bucket: Bucket,
  chemin: string,
  contenu: Buffer,
  contentType: string,
): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = await createAdminClient()
    .storage.from(bucket)
    .upload(chemin, contenu, { contentType, upsert: true });

  return error ? { ok: false, erreur: error.message } : { ok: true };
}
