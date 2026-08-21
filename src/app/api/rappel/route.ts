import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { rappelSchema } from '@/lib/validation/rappel';
import { notifierRappel } from '@/lib/notify';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rappel — demande de rappel depuis la page contact.
 *
 * Memes trois filtres que la reservation : limitation de debit par IP,
 * validation stricte, champ piege. Un formulaire public sans ces trois-la
 * devient une boite a spam en une semaine.
 *
 * La reponse est volontairement identique que le courriel parte ou non. Si
 * Resend est en panne, le visiteur voit une confirmation — le message est
 * journalise cote serveur, et nous rappelons quand meme. Lui afficher une
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

      const envoi = await notifierRappel({
        nom: entree.nom,
        telephone: entree.telephone,
        message: entree.message,
        ip,
      });

      if (!envoi.envoye) {
        console.error(
          `[rappel] courriel non parti (${envoi.erreur}) — ${entree.nom} ${entree.telephone}`,
        );
      }

      return { recu: true };
    },
    { status: 201 },
  );
}
