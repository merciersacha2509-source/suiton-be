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

/**
 * Liens signes vers des photos deposees hors reservation (formulaire de
 * rappel avec photos, notamment). Les photos existent deja dans le bucket
 * `chantiers` (deposees via /api/photos/upload) mais n'ont pas de job_id —
 * on les retrouve donc par id plutot que par chemin.
 *
 * Duree volontairement plus longue que la miniature d'upload (1 h) : le
 * lien part dans un e-mail que l'equipe ouvre parfois le lendemain.
 */
const DUREE_NOTIFICATION = 60 * 60 * 24 * 3; // 3 jours

export async function urlsPhotosParId(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  const { data, error } = await createAdminClient()
    .from('photos')
    .select('storage_path, thumb_path')
    .in('id', ids);

  if (error || !data) {
    console.error('[storage] lecture photos impossible', error?.message);
    return [];
  }

  const chemins = data.map((p) => p.thumb_path ?? p.storage_path);
  const urls = await urlsSignees('chantiers', chemins, DUREE_NOTIFICATION);
  return urls.filter((u): u is string => Boolean(u));
}
