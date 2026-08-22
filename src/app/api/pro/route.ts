import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { demandeProSchema } from '@/lib/validation/pro';
import { notifierDemandePro } from '@/lib/notify';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/pro — demande professionnelle depuis /professionnels.
 *
 * Memes trois filtres que le rappel grand public : limitation de debit par
 * IP, validation stricte, champ piege. Voir /api/rappel/route.ts.
 */
export async function POST(request: NextRequest) {
  return handle(
    async () => {
      const ip = ipDepuisRequete(request.headers);
      await consommerQuota('pro', ip);

      const brut: unknown = await request.json().catch(() => null);
      if (brut === null) throw new Error('Corps de requête illisible.');

      const entree = demandeProSchema.parse(brut);

      const envoi = await notifierDemandePro({
        societe: entree.societe,
        contact: entree.contact,
        email: entree.email,
        telephone: entree.telephone,
        besoin: entree.besoin,
        chantiersParMois: entree.chantiersParMois,
        surfaceMoyenne: entree.surfaceMoyenne,
        frequence: entree.frequence,
        zone: entree.zone,
        message: entree.message,
        ip,
      });

      if (!envoi.envoye) {
        console.error(
          `[pro] courriel non parti (${envoi.erreur}) — ${entree.societe} ${entree.telephone}`,
        );
      }

      return { recu: true };
    },
    { status: 201 },
  );
}
