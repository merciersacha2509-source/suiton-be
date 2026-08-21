import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { estimate, estimateDuration } from '@/lib/pricing';
import { computeScore, scoreBand } from '@/lib/scoring';
import { genererJetonPortail, hacherJeton, urlPortail } from '@/lib/tokens';
import { accuseReception, notifierInterne } from '@/lib/notify';
import { publicEnv } from '@/lib/env';
import { formatRange } from '@/lib/format';
import { LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { zonePourCodePostal } from '@/lib/zones';
import type { BookingInput } from '@/lib/validation/booking';
import type { SettingsRow, ZoneTier } from '@/types/database';

/**
 * Traitement d'une reservation.
 *
 * Ordre volontaire :
 *   1. lire la grille tarifaire      (sans elle, rien n'est calculable)
 *   2. calculer estimation et score  (cote serveur, jamais recu du client)
 *   3. ecrire en base ATOMIQUEMENT   (fonction create_booking)
 *   4. notifier                      (best effort, jamais bloquant)
 *
 * Si l'etape 3 echoue, rien n'a ete cree. Si l'etape 4 echoue, la
 * reservation existe quand meme — c'est ce qui compte.
 */

export interface ResultatReservation {
  reference: string;
  jobId: string;
  clientId: string;
  urlPortail: string;
  estimation: { min: number; max: number; surDevis: boolean };
  score: number;
  bande: string;
  courriels: { client: boolean; interne: boolean };
}

export async function traiterReservation(
  entree: BookingInput,
  contexte: { ip: string; source?: string },
): Promise<ResultatReservation> {
  const supabase = createAdminClient();

  // --- 1. Grille tarifaire --------------------------------------------------
  const { data: settings, error: settingsErreur } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle<SettingsRow>();

  if (settingsErreur || !settings) {
    throw new Error('Grille tarifaire introuvable. Les migrations sont-elles appliquées ?');
  }

  // --- 2. Calculs serveur ---------------------------------------------------
  const zone: ZoneTier = zonePourCodePostal(entree.code_postal);

  const estimation = estimate(
    {
      service: entree.service,
      soil: entree.soil,
      surface_m2: entree.surface_m2,
      zone,
      urgent: entree.urgent,
      property_type: entree.property_type,
    },
    settings,
  );

  const duree = estimateDuration({ surface_m2: entree.surface_m2, soil: entree.soil });

  const delaiJours = entree.date_souhaitee
    ? Math.max(
        0,
        Math.round((new Date(entree.date_souhaitee).getTime() - Date.now()) / 86_400_000),
      )
    : null;

  const score = computeScore(
    {
      montantEstime: estimation.max,
      clientKind: entree.est_pro ? 'professionnel' : 'particulier',
      segment: entree.est_pro ? 'independant' : null,
      recurrenceAnnuelle: 1,
      zone,
      delaiJours,
      aDesPhotos: entree.photos.length > 0,
    },
    [],
  );
  const bande = scoreBand(score);

  // --- 3. Ecriture atomique -------------------------------------------------
  const jeton = genererJetonPortail();

  const { data, error } = await supabase.rpc('create_booking', {
    p_client: {
      nom: entree.nom,
      email: entree.email,
      telephone: entree.telephone,
      kind: entree.est_pro ? 'professionnel' : 'particulier',
      tva: entree.tva ?? null,
      adresse: entree.adresse ?? null,
      commune: entree.commune,
      code_postal: entree.code_postal,
    },
    p_job: {
      service: entree.service,
      property_type: entree.property_type,
      soil: entree.soil,
      surface_m2: entree.surface_m2,
      commune: entree.commune,
      code_postal: entree.code_postal,
      adresse: entree.adresse ?? null,
      zone,
      urgent: entree.urgent,
      date_souhaitee: entree.date_souhaitee ?? null,
      source: contexte.source ?? 'site',
      notes: entree.notes ?? null,
    },
    p_estimation: {
      min: estimation.min,
      max: estimation.max,
      duree_min: duree.min,
      duree_max: duree.max,
    },
    p_score: score,
    p_score_detail: { zone, sur_devis: estimation.surDevis, ip: contexte.ip },
    p_token_hash: hacherJeton(jeton),
    p_photo_ids: entree.photos,
  });

  if (error) {
    console.error('[booking] create_booking a echoue', error.message);
    throw new Error(`Enregistrement impossible : ${error.message}`);
  }

  const ligne = Array.isArray(data) ? data[0] : data;
  if (!ligne) throw new Error('Enregistrement impossible : aucune ligne renvoyée.');

  // Consentement photo : distinct des conditions generales, date pour etre
  // prouvable. Un consentement sans date n'en est pas un.
  if (entree.consent_photos) {
    await supabase
      .from('clients')
      .update({ consent_photos: true, consent_photos_at: new Date().toISOString() })
      .eq('id', ligne.client_id);
  }

  const lien = urlPortail(jeton, publicEnv.NEXT_PUBLIC_SITE_URL);

  // --- 4. Notifications — best effort --------------------------------------
  const [clientMail, interneMail] = await Promise.all([
    accuseReception({
      email: entree.email,
      prenom: entree.nom.split(' ')[0] ?? entree.nom,
      reference: ligne.job_reference,
      urlPortail: lien,
      delaiHeures: settings.delai_devis_heures,
    }),
    notifierInterne({
      reference: ligne.job_reference,
      bande,
      score,
      service: LIBELLES_SERVICE[entree.service],
      commune: entree.commune,
      surface: entree.surface_m2,
      estimation: estimation.surDevis
        ? 'sur devis'
        : formatRange(estimation.min, estimation.max),
      urgent: entree.urgent,
      nom: entree.nom,
      telephone: entree.telephone,
      email: entree.email,
      jobId: ligne.job_id,
    }),
  ]);

  await supabase.from('events').insert({
    job_id: ligne.job_id,
    type: 'booking.notified',
    payload: {
      client: clientMail.envoye,
      interne: interneMail.envoye,
      erreur_client: clientMail.erreur ?? null,
      erreur_interne: interneMail.erreur ?? null,
    },
  });

  return {
    reference: ligne.job_reference,
    jobId: ligne.job_id,
    clientId: ligne.client_id,
    urlPortail: lien,
    estimation: { min: estimation.min, max: estimation.max, surDevis: estimation.surDevis },
    score,
    bande,
    courriels: { client: clientMail.envoye, interne: interneMail.envoye },
  };
}
