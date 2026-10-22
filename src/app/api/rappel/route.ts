import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { rappelSchema } from '@/lib/validation/rappel';
import { notifierRappel, accuseReceptionRappel } from '@/lib/notify';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';
import { urlsPhotosParId } from '@/lib/storage';
import { enregistrerRappel } from '@/lib/services/rappels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rappel — demande de rappel (contact, vitres sur devis, auto,
 * textile).
 *
 * Memes trois filtres que la reservation : limitation de debit par IP,
 * validation stricte, champ piege. Un formulaire public sans ces trois-la
 * devient une boite a spam en une semaine.
 *
 * Deux ecritures independantes : la ligne dans `rappels` est ce qui rend la
 * demande visible et suivable dans le tableau de bord ; le courriel est un
 * relai immediat. Aucune des deux ne doit bloquer l'autre — la reponse au
 * visiteur reste identique quoi qu'il arrive cote serveur. Lui afficher une
 * erreur technique le ferait partir sans nous laisser son numero.
 */
export async function POST(request: NextRequest) {
  return handle(
    async () => {
      const ip = ipDepuisRequete(request.headers);
      await consommerQuota('rappel', ip);

      const brut: unknown = await request.json().catch(() => null);
      if (brut === null) throw new Error('Corps de requête illisible.');

      const entree = rappelSchema.parse(brut);
      const urlsPhotos = await urlsPhotosParId(entree.photos);

      const enregistrement = await enregistrerRappel({
        nom: entree.nom,
        telephone: entree.telephone,
        email: entree.email || null,
        adresse: entree.adresse || null,
        message: entree.message || null,
        source: entree.source,
        photos: entree.photos,
        ip,
      });

      if (!enregistrement.ok) {
        console.error(
          `[rappel] enregistrement impossible (${enregistrement.erreur}) — ${entree.nom} ${entree.telephone}`,
        );
      }

      const envoi = await notifierRappel({
        nom: entree.nom,
        telephone: entree.telephone,
        email: entree.email || undefined,
        adresse: entree.adresse || undefined,
        message: entree.message,
        ip,
        urlsPhotos,
      });

      if (!envoi.envoye) {
        console.error(
          `[rappel] courriel non parti (${envoi.erreur}) — ${entree.nom} ${entree.telephone}`,
        );
      }

      // Facultatif : ce formulaire ne demande pas toujours l'e-mail.
      if (entree.email) {
        const accuse = await accuseReceptionRappel({ email: entree.email, nom: entree.nom });
        if (!accuse.envoye) {
          console.error(
            `[rappel] accusé de réception non parti (${accuse.erreur}) — ${entree.email}`,
          );
        }
      }

      return { recu: true };
    },
    { status: 201 },
  );
}
