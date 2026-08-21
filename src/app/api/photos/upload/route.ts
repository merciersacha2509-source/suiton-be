import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { handle } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { televerser, urlSignee } from '@/lib/storage';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';
import {
  PhotoInvalideError,
  TAILLE_MAX_OCTETS,
  TYPES_ACCEPTES,
  cheminPhoto,
  traiterPhoto,
} from '@/lib/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Le traitement sharp d'une photo de 20 Mo depasse la limite par defaut.
export const maxDuration = 30;

/**
 * POST /api/photos/upload — depot d'une photo de chantier.
 *
 * Le fichier transite par le serveur au lieu d'une URL signee remise au
 * navigateur, et c'est deliberé : c'est le seul moyen de garantir que la
 * purge EXIF a lieu. Une URL signee laisserait le client deposer le JPEG
 * brut, coordonnees GPS comprises.
 *
 * Le fichier stocke est donc toujours un WebP re-encode : les metadonnees
 * n'y survivent pas.
 */
export async function POST(request: NextRequest) {
  return handle(
    async () => {
      await consommerQuota('upload', ipDepuisRequete(request.headers));

      const formulaire = await request.formData();
      const fichier = formulaire.get('fichier');

      if (!(fichier instanceof File)) {
        throw new PhotoInvalideError('Aucun fichier reçu.');
      }
      if (fichier.size > TAILLE_MAX_OCTETS) {
        throw new PhotoInvalideError('Image trop lourde (20 Mo maximum).');
      }
      if (!(TYPES_ACCEPTES as readonly string[]).includes(fichier.type)) {
        throw new PhotoInvalideError('Format non accepté. JPEG, PNG, WebP ou HEIC.');
      }

      const brut = Buffer.from(await fichier.arrayBuffer());
      const traitee = await traiterPhoto(brut);

      const id = randomUUID();
      const chemins = cheminPhoto('depots', id);
      const supabase = createAdminClient();

      const [principale, miniature] = await Promise.all([
        televerser('chantiers', chemins.principale, traitee.principale, 'image/webp'),
        televerser('chantiers', chemins.miniature, traitee.miniature, 'image/webp'),
      ]);

      if (!principale.ok || !miniature.ok) {
        throw new Error(`Stockage impossible : ${principale.erreur ?? miniature.erreur}`);
      }

      // job_id reste nul : le chantier n'existe pas encore. La fonction
      // create_booking rattachera la photo, et la purge horaire supprimera
      // les depots jamais convertis.
      const { data, error } = await supabase
        .from('photos')
        .insert({
          id,
          phase: 'contexte',
          piece: 'general',
          storage_path: chemins.principale,
          thumb_path: chemins.miniature,
          largeur: traitee.largeur,
          hauteur: traitee.hauteur,
          poids_octets: traitee.octets,
          exif_stripped: true,
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(`Enregistrement impossible : ${error?.message}`);
      }

      return {
        id: data.id,
        apercu: await urlSignee('chantiers', chemins.miniature, 3600),
        largeur: traitee.largeur,
        hauteur: traitee.hauteur,
      };
    },
    { status: 201 },
  );
}
