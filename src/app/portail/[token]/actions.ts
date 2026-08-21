'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobDepuisJeton } from '@/lib/services/portal';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';
import { confirmationIntervention } from '@/lib/notify';
import { synchroniserSansEchec } from '@/lib/calendar';
import { surDevisAccepte } from '@/lib/services/pipeline';
import { publicEnv } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { AppError } from '@/lib/errors';

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

async function ip(): Promise<string> {
  return ipDepuisRequete(await headers());
}

/* -------------------------------------------------------------------------
 * Acceptation du devis
 * -------------------------------------------------------------------------
 * C'est l'action la plus engageante du portail : elle fait passer le
 * chantier en « gagne », rend l'intervention ferme et bloque le creneau au
 * calendrier.
 *
 * Elle est idempotente : un double clic, ou un rechargement de page apres
 * validation, ne cree pas deux interventions.
 * ----------------------------------------------------------------------- */
export async function accepterDevisAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const jeton = String(formData.get('jeton') ?? '');

  try {
    await consommerQuota('portail_action', await ip());
    const { jobId } = await jobDepuisJeton(jeton);
    const supabase = createAdminClient();

    const { data: devis } = await supabase
      .from('quotes')
      .select('id, numero, status, valide_jusqu_au')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!devis) return { error: "Aucun devis n'est disponible pour ce dossier." };
    if (devis.status === 'accepte') return { ok: true, message: 'Ce devis est déjà accepté.' };
    if (devis.status === 'refuse') return { error: 'Ce devis a été refusé.' };
    if (new Date(devis.valide_jusqu_au) < new Date()) {
      return {
        error:
          'Ce devis a dépassé sa date de validité. Appelez le 0489 21 01 24, nous le rééditons.',
      };
    }

    const maintenant = new Date().toISOString();

    await supabase
      .from('quotes')
      .update({ status: 'accepte', accepted_at: maintenant })
      .eq('id', devis.id);

    await supabase.from('jobs').update({ stage: 'gagne' }).eq('id', jobId);

    // L'intervention provisoire devient ferme. Si aucune n'existe, le bureau
    // planifiera : on ne cree pas de creneau au hasard.
    const { data: intervention } = await supabase
      .from('interventions')
      .select('id, starts_at, ends_at, google_event_id, status')
      .eq('job_id', jobId)
      .eq('status', 'provisoire')
      .maybeSingle();

    if (intervention) {
      await supabase
        .from('interventions')
        .update({ status: 'confirme' })
        .eq('id', intervention.id);

      const { data: job } = await supabase
        .from('jobs')
        .select(
          'reference, adresse, commune, code_postal, surface_m2, service, client:clients(nom, email)',
        )
        .eq('id', jobId)
        .maybeSingle();

      const client = job ? (Array.isArray(job.client) ? job.client[0] : job.client) : null;
      const adresse = job
        ? [job.adresse, `${job.code_postal ?? ''} ${job.commune}`.trim()]
            .filter(Boolean)
            .join(', ')
        : '';

      // Le calendrier est un miroir : sa panne ne remet pas en cause
      // l'acceptation, qui est deja enregistree.
      const sync = await synchroniserSansEchec(
        {
          titre: `${job?.reference ?? ''} · ${job?.surface_m2 ?? ''} m² · ${job?.commune ?? ''}`,
          description: `Client : ${client?.nom ?? ''}\nService : ${job?.service ?? ''}\nDossier : ${publicEnv.NEXT_PUBLIC_SITE_URL}/chantiers/${jobId}`,
          lieu: adresse,
          debut: new Date(intervention.starts_at),
          fin: new Date(intervention.ends_at),
          provisoire: false,
        },
        intervention.google_event_id,
      );

      if (sync.id && sync.id !== intervention.google_event_id) {
        await supabase
          .from('interventions')
          .update({ google_event_id: sync.id })
          .eq('id', intervention.id);
      }

      if (client?.email) {
        await confirmationIntervention({
          email: client.email,
          prenom: client.nom.split(' ')[0] ?? client.nom,
          reference: job?.reference ?? '',
          quand: formatDateTime(intervention.starts_at),
          adresse,
          urlPortail: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portail/${jeton}`,
        });
      }
    }

    await supabase.from('events').insert({
      job_id: jobId,
      type: 'quote.accepted',
      payload: { quote_id: devis.id, numero: devis.numero, canal: 'portail' },
    });

    // Chaine documentaire : bon d'intervention + fiche chantier.
    // Tolerante a l'echec — un devis accepte sans bon se rattrape, un devis
    // accepte qu'on aurait perdu, non.
    const suite = await surDevisAccepte(jobId);
    if (suite.erreurs.length > 0) {
      console.warn('[portail] documents annexes', suite.erreurs.join(' · '));
    }

    revalidatePath(`/portail/${jeton}`);
    return {
      ok: true,
      message: intervention
        ? 'Devis accepté. Votre intervention est confirmée.'
        : 'Devis accepté. Nous vous proposons des dates sous 24 h.',
    };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error('[portail] acceptation impossible', e);
    return { error: "L'enregistrement a échoué. Réessayez, ou appelez le 0489 21 01 24." };
  }
}

/* ------------------------------------------------------------------------- */

export async function refuserDevisAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const jeton = String(formData.get('jeton') ?? '');
  const motif = String(formData.get('motif') ?? '').slice(0, 500);

  try {
    await consommerQuota('portail_action', await ip());
    const { jobId } = await jobDepuisJeton(jeton);
    const supabase = createAdminClient();

    const { data: devis } = await supabase
      .from('quotes')
      .select('id, status')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!devis || devis.status === 'accepte') {
      return { error: 'Ce devis ne peut plus être refusé.' };
    }

    await supabase
      .from('quotes')
      .update({ status: 'refuse', refused_at: new Date().toISOString() })
      .eq('id', devis.id);

    // Le motif est obligatoire cote metier : sans lui, on ne sait pas si le
    // prix, le delai ou autre chose a bloque, et on refait la meme erreur.
    await supabase
      .from('jobs')
      .update({ stage: 'perdu', perdu_motif: motif || 'Refus sans motif précisé' })
      .eq('id', jobId);

    await supabase.from('events').insert({
      job_id: jobId,
      type: 'quote.refused',
      payload: { quote_id: devis.id, motif },
    });

    revalidatePath(`/portail/${jeton}`);
    return { ok: true, message: 'C’est noté. Merci de nous avoir répondu.' };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    return { error: "L'enregistrement a échoué." };
  }
}

/* ------------------------------------------------------------------------- */

export async function envoyerMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const jeton = String(formData.get('jeton') ?? '');
  const corps = z.string().trim().min(2).max(2000).safeParse(formData.get('corps'));

  if (!corps.success) return { error: 'Votre message est vide ou trop long.' };

  try {
    await consommerQuota('portail_action', await ip());
    const { jobId } = await jobDepuisJeton(jeton);
    const supabase = createAdminClient();

    await supabase.from('messages').insert({
      job_id: jobId,
      channel: 'portail',
      sortant: false,
      corps: corps.data,
      auteur_label: 'Client',
    });

    revalidatePath(`/portail/${jeton}`);
    return { ok: true, message: 'Message envoyé. Nous répondons sous 24 h ouvrées.' };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    return { error: "L'envoi a échoué." };
  }
}

/* -------------------------------------------------------------------------
 * Consentement photo
 * -------------------------------------------------------------------------
 * Le retrait doit etre aussi simple que l'octroi (RGPD art. 7 §3). Il
 * depublie immediatement les realisations liees : un retrait qui met trois
 * jours a prendre effet est une infraction, pas un delai technique.
 * ----------------------------------------------------------------------- */
export async function majConsentementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const jeton = String(formData.get('jeton') ?? '');
  const accorde = formData.get('accorde') === 'true';

  try {
    const { jobId } = await jobDepuisJeton(jeton);
    const supabase = createAdminClient();

    const { data: job } = await supabase
      .from('jobs')
      .select('client_id')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return { error: 'Dossier introuvable.' };

    await supabase
      .from('clients')
      .update({
        consent_photos: accorde,
        consent_photos_at: accorde ? new Date().toISOString() : null,
      })
      .eq('id', job.client_id);

    if (!accorde) {
      await supabase
        .from('jobs')
        .update({ published: false, published_at: null })
        .eq('client_id', job.client_id)
        .eq('published', true);

      await supabase.from('photos').update({ is_published: false }).eq('job_id', jobId);
    }

    await supabase.from('events').insert({
      job_id: jobId,
      type: accorde ? 'consent.granted' : 'consent.withdrawn',
      payload: { canal: 'portail' },
    });

    revalidatePath(`/portail/${jeton}`);
    return {
      ok: true,
      message: accorde
        ? 'Merci. Vos photos pourront illustrer nos réalisations.'
        : 'Consentement retiré. Vos photos ne seront pas publiées.',
    };
  } catch {
    return { error: "L'enregistrement a échoué." };
  }
}
