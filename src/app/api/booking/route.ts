import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { bookingSchema } from '@/lib/validation/booking';
import { traiterReservation } from '@/lib/services/booking';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/booking — reception d'une reservation publique.
 *
 * Trois filtres avant tout traitement :
 *   1. limitation de debit par IP        (10/heure)
 *   2. validation Zod stricte            (le montant n'est pas un champ accepte)
 *   3. champ piege                       (rempli = robot, verifie par le schema)
 *
 * La reponse ne renvoie ni score, ni bande, ni identifiant interne : ces
 * informations n'ont rien a faire dans un navigateur public.
 */
export async function POST(request: NextRequest) {
  return handle(
    async () => {
      const ip = ipDepuisRequete(request.headers);
      await consommerQuota('booking', ip);

      const brut: unknown = await request.json().catch(() => null);
      if (brut === null) {
        throw new Error('Corps de requête illisible.');
      }

      const entree = bookingSchema.parse(brut);
      const resultat = await traiterReservation(entree, { ip, source: 'site' });

      return {
        reference: resultat.reference,
        url_portail: resultat.urlPortail,
        estimation: resultat.estimation,
        courriel_envoye: resultat.courriels.client,
      };
    },
    { status: 201 },
  );
}
