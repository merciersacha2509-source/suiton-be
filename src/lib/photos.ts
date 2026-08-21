import 'server-only';
import sharp from 'sharp';
import { AppError } from '@/lib/errors';

/**
 * Traitement des photos de chantier.
 *
 * Trois raisons de ne jamais stocker le fichier brut :
 *
 * 1. RGPD — un JPEG de telephone contient les coordonnees GPS du lieu de
 *    prise de vue. Le rapport PDF transmis au client de votre client
 *    contiendrait alors l'adresse du domicile du premier.
 * 2. Poids — huit photos brutes depassent 40 Mo et ne passent pas en piece
 *    jointe.
 * 3. Orientation — l'EXIF porte la rotation. Si on supprime les metadonnees
 *    sans appliquer la rotation d'abord, la moitie des photos apparaissent
 *    couchees.
 *
 * sharp ne recopie aucune metadonnee par defaut : la purge est donc acquise
 * dES lors qu'on repasse par lui. `.rotate()` sans argument applique
 * l'orientation EXIF avant que celle-ci ne disparaisse.
 */

export const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;
export const LARGEUR_MAX = 1600;
export const LARGEUR_MINIATURE = 400;
export const QUALITE = 82;

export const TYPES_ACCEPTES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export interface PhotoTraitee {
  principale: Buffer;
  miniature: Buffer;
  largeur: number;
  hauteur: number;
  octets: number;
}

/** 422 : le fichier est syntaxiquement recu, semantiquement inutilisable. */
export class PhotoInvalideError extends AppError {
  constructor(message: string) {
    super(message, 422, 'photo_invalide');
  }
}

export async function traiterPhoto(entree: Buffer): Promise<PhotoTraitee> {
  if (entree.byteLength > TAILLE_MAX_OCTETS) {
    throw new PhotoInvalideError('Image trop lourde (20 Mo maximum).');
  }

  let metadonnees;
  try {
    metadonnees = await sharp(entree).metadata();
  } catch {
    throw new PhotoInvalideError("Ce fichier n'est pas une image exploitable.");
  }

  if (!metadonnees.width || !metadonnees.height) {
    throw new PhotoInvalideError("Ce fichier n'est pas une image exploitable.");
  }

  // Garde-fou anti « bombe de decompression » : une image de 60 000 px de
  // cote tient dans quelques kilo-octets compresses et sature la memoire de
  // la fonction a la decompression.
  if (metadonnees.width > 20000 || metadonnees.height > 20000) {
    throw new PhotoInvalideError('Dimensions aberrantes.');
  }

  const base = sharp(entree, { failOn: 'error' }).rotate();

  const principale = await base
    .clone()
    .resize({
      width: LARGEUR_MAX,
      height: LARGEUR_MAX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITE })
    .toBuffer({ resolveWithObject: true });

  const miniature = await base
    .clone()
    .resize({
      width: LARGEUR_MINIATURE,
      height: LARGEUR_MINIATURE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 70 })
    .toBuffer();

  return {
    principale: principale.data,
    miniature,
    largeur: principale.info.width,
    hauteur: principale.info.height,
    octets: principale.data.byteLength,
  };
}

/**
 * Chemin de stockage. Ni le nom d'origine ni l'adresse n'y figurent : un
 * chemin devinable est une fuite, et un nom de fichier vient du client.
 */
export function cheminPhoto(
  prefixe: string,
  id: string,
): { principale: string; miniature: string } {
  const annee = new Date().getUTCFullYear();
  return {
    principale: `${annee}/${prefixe}/${id}.webp`,
    miniature: `${annee}/${prefixe}/${id}-mini.webp`,
  };
}
