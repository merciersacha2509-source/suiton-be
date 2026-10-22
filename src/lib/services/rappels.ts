import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RappelSource } from '@/types/database';

/**
 * Retrouve ou cree la fiche client correspondante, par e-mail.
 *
 * Meme cle que `create_booking` (voir supabase/migrations/20261101000600_
 * fix_create_booking_job_id_ambigu.sql) : l'e-mail en minuscules est
 * l'identifiant naturel du client partout dans le projet. Sans e-mail — ce
 * formulaire ne le demande pas toujours — on ne peut ni retrouver, ni creer
 * de fiche fiable : `clients.email` est obligatoire, et deviner une adresse
 * serait pire que ne rien avoir.
 *
 * `commune` est aussi obligatoire dans `clients`, mais ce formulaire ne
 * fournit qu'une adresse en un seul champ libre. La decouper fiablement
 * (rue / code postal / commune) demanderait un vrai geocodage ; tenter de le
 * faire par regex produirait parfois une commune fausse, ce qui est pire
 * qu'une commune vide a completer a la main.
 */
async function retrouverOuCreerClient(params: {
  nom: string;
  email: string;
  telephone: string;
  adresse: string | null;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const email = params.email.trim().toLowerCase();

  const { data: existant, error: erreurLecture } = await supabase
    .from('clients')
    .select('id, telephone, adresse')
    .eq('email', email)
    .maybeSingle();

  if (erreurLecture) {
    console.error('[rappels] lecture client impossible', erreurLecture.message);
    return null;
  }

  if (existant) {
    // On ne remplace jamais une donnee deja renseignee : seulement les trous.
    await supabase
      .from('clients')
      .update({
        telephone: existant.telephone?.trim() || params.telephone,
        adresse: existant.adresse ?? params.adresse,
      })
      .eq('id', existant.id);
    return existant.id;
  }

  const { data: cree, error: erreurCreation } = await supabase
    .from('clients')
    .insert({
      nom: params.nom,
      email,
      telephone: params.telephone,
      adresse: params.adresse,
      commune: '',
    })
    .select('id')
    .single();

  if (erreurCreation) {
    console.error('[rappels] creation client impossible', erreurCreation.message);
    return null;
  }

  return cree.id;
}

/**
 * Enregistre une demande de rappel (Contact, Auto, Textile, Vitres sur
 * devis).
 *
 * Ecriture best-effort et non bloquante, au meme titre que le courriel de
 * notification : un echec ici est journalise cote appelant, jamais renvoye
 * au visiteur. Voir `src/app/api/rappel/route.ts`.
 */
export async function enregistrerRappel(params: {
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  message: string | null;
  source: RappelSource;
  photos: string[];
  ip: string;
}): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const clientId = params.email
    ? await retrouverOuCreerClient({
        nom: params.nom,
        email: params.email,
        telephone: params.telephone,
        adresse: params.adresse,
      })
    : null;

  const { error } = await createAdminClient().from('rappels').insert({
    nom: params.nom,
    telephone: params.telephone,
    email: params.email,
    adresse: params.adresse,
    message: params.message,
    source: params.source,
    photos: params.photos,
    ip: params.ip,
    client_id: clientId,
  });

  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}
