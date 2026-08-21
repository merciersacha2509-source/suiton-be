'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { produireDevis, urlSigneeDocument } from '@/lib/services/quotes';
import { estimateDuration } from '@/lib/pricing';
import { synchroniserSansEchec } from '@/lib/calendar';
import { emailDevis } from '@/lib/emails';
import { LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { telecharger } from '@/lib/storage';
import { formatDate, formatEUR, slugify } from '@/lib/format';
import { genererJetonPortail, hacherJeton, urlPortail } from '@/lib/tokens';
import { publicEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import type { SettingsRow } from '@/types/database';

export interface JobActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const STAGES = [
  'nouveau',
  'contacte',
  'qualifie',
  'devis_a_produire',
  'devis_envoye',
  'relance',
  'negociation',
  'gagne',
  'planifie',
  'termine',
  'perdu',
] as const;

/* -------------------------------------------------------------------------- */

export async function changerEtapeAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const session = await requireCapability('jobs.write');

  const parsed = z
    .object({
      jobId: z.string().uuid(),
      stage: z.enum(STAGES),
      motif: z.string().trim().max(500).optional(),
    })
    .safeParse({
      jobId: formData.get('jobId'),
      stage: formData.get('stage'),
      motif: formData.get('motif') || undefined,
    });

  if (!parsed.success) return { error: 'Étape invalide.' };

  // « Perdu » exige un motif : sans lui, on ne saura jamais pourquoi on perd.
  if (parsed.data.stage === 'perdu' && !parsed.data.motif) {
    return { error: 'Indiquez pourquoi ce chantier est perdu.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('jobs')
    .update({
      stage: parsed.data.stage,
      ...(parsed.data.stage === 'perdu' ? { perdu_motif: parsed.data.motif } : {}),
    })
    .eq('id', parsed.data.jobId);

  if (error) return { error: 'La mise à jour a échoué.' };

  await supabase.from('events').insert({
    job_id: parsed.data.jobId,
    type: 'job.stage_changed',
    payload: { stage: parsed.data.stage, motif: parsed.data.motif ?? null },
    actor_id: session.userId,
  });

  revalidatePath(`/chantiers/${parsed.data.jobId}`);
  revalidatePath('/chantiers');
  return { ok: true, message: 'Étape mise à jour.' };
}

/* -------------------------------------------------------------------------- */

export async function genererDevisAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const session = await requireCapability('quotes.write');
  const jobId = String(formData.get('jobId') ?? '');

  if (!z.string().uuid().safeParse(jobId).success) return { error: 'Chantier invalide.' };

  try {
    const devis = await produireDevis(jobId);

    const supabase = createAdminClient();
    await supabase.from('events').insert({
      job_id: jobId,
      type: 'quote.generated',
      payload: { numero: devis.numero },
      actor_id: session.userId,
    });

    revalidatePath(`/chantiers/${jobId}`);
    return {
      ok: true,
      message: `Devis ${devis.numero} généré. Relisez-le avant de l'envoyer.`,
    };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error('[devis] generation impossible', e);
    return { error: 'La génération a échoué. Consultez les journaux.' };
  }
}

/* -------------------------------------------------------------------------
 * Envoi du devis
 * -------------------------------------------------------------------------
 * Seul geste manuel de toute la chaine, et c'est deliberé : un devis part
 * sous la signature de SUITON, il merite une relecture.
 * ----------------------------------------------------------------------- */
export async function envoyerDevisAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const session = await requireCapability('quotes.write');
  const jobId = String(formData.get('jobId') ?? '');
  const quoteId = String(formData.get('quoteId') ?? '');

  if (!z.string().uuid().safeParse(quoteId).success) return { error: 'Devis invalide.' };

  const supabase = createAdminClient();

  const { data: devis } = await supabase
    .from('quotes')
    .select(
      `id, numero, status, montant_htva, montant_ttc, valide_jusqu_au, acompte_montant,
       pdf_path, job:jobs(client:clients(nom, email))`,
    )
    .eq('id', quoteId)
    .maybeSingle();

  if (!devis) return { error: 'Devis introuvable.' };
  if (devis.status === 'accepte') return { error: 'Ce devis est déjà accepté.' };

  const job = Array.isArray(devis.job) ? devis.job[0] : devis.job;
  const client = job ? (Array.isArray(job.client) ? job.client[0] : job.client) : null;
  if (!client?.email) return { error: 'Ce client n’a pas d’adresse e-mail.' };

  // Jeton de portail : on en cree un si le chantier n'en a pas encore
  // d'actif. Un seul jeton valide a la fois — voir la contrainte unique.
  const { data: existant } = await supabase
    .from('portal_tokens')
    .select('id')
    .eq('job_id', jobId)
    .is('revoked_at', null)
    .maybeSingle();

  let lien: string;
  if (existant) {
    // Le jeton en clair n'est pas recuperable : on renvoie vers le portail
    // deja communique. C'est le prix du stockage hache, et c'est le bon prix.
    lien = `${publicEnv.NEXT_PUBLIC_SITE_URL}/portail`;
  } else {
    const jeton = genererJetonPortail();
    await supabase
      .from('portal_tokens')
      .insert({ job_id: jobId, token_hash: hacherJeton(jeton) });
    lien = urlPortail(jeton, publicEnv.NEXT_PUBLIC_SITE_URL);
  }

  // Le PDF est JOINT, pas seulement lie : un lien signe expire, une piece
  // jointe reste dans la boite du client.
  const pdf = devis.pdf_path ? await telecharger('documents', devis.pdf_path) : null;

  const envoi = await emailDevis({
    email: client.email,
    nom: client.nom,
    numero: devis.numero,
    montant: formatEUR(Number(devis.montant_ttc)),
    validiteJours: 30,
    valideJusquAu: formatDate(devis.valide_jusqu_au),
    acompte: devis.acompte_montant ? formatEUR(Number(devis.acompte_montant)) : null,
    urlPortail: lien,
    pdf: pdf ?? undefined,
  });

  if (!envoi.envoye) {
    return { error: `L'e-mail n'est pas parti : ${envoi.erreur ?? 'raison inconnue'}` };
  }

  const maintenant = new Date().toISOString();
  await supabase
    .from('quotes')
    .update({ status: 'envoye', sent_at: maintenant, portal_sent_at: maintenant })
    .eq('id', quoteId);

  await supabase.from('jobs').update({ stage: 'devis_envoye' }).eq('id', jobId);

  await supabase.from('events').insert({
    job_id: jobId,
    type: 'quote.sent',
    payload: { numero: devis.numero, destinataire: client.email },
    actor_id: session.userId,
  });

  revalidatePath(`/chantiers/${jobId}`);
  return { ok: true, message: `Devis ${devis.numero} envoyé à ${client.email}.` };
}

/* -------------------------------------------------------------------------- */

export async function planifierAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const session = await requireCapability('planning.write');

  const parsed = z
    .object({
      jobId: z.string().uuid(),
      debut: z.string().min(10),
      teamId: z.string().uuid().optional(),
    })
    .safeParse({
      jobId: formData.get('jobId'),
      debut: formData.get('debut'),
      teamId: formData.get('teamId') || undefined,
    });

  if (!parsed.success) return { error: 'Date invalide.' };

  const supabase = createAdminClient();

  const [{ data: job }, { data: settings }, { data: equipe }] = await Promise.all([
    supabase
      .from('jobs')
      .select(
        'id, reference, surface_m2, soil, commune, code_postal, adresse, service, stage, client:clients(nom)',
      )
      .eq('id', parsed.data.jobId)
      .maybeSingle(),
    supabase
      .from('settings')
      .select('tampon_trajet_min')
      .maybeSingle<Pick<SettingsRow, 'tampon_trajet_min'>>(),
    parsed.data.teamId
      ? supabase.from('teams').select('id').eq('id', parsed.data.teamId).maybeSingle()
      : supabase
          .from('teams')
          .select('id')
          .eq('actif', true)
          .order('nom')
          .limit(1)
          .maybeSingle(),
  ]);

  if (!job) return { error: 'Chantier introuvable.' };
  if (!equipe) return { error: 'Aucune équipe active. Créez-en une dans les paramètres.' };

  const duree = estimateDuration({ surface_m2: job.surface_m2, soil: job.soil });
  const debut = new Date(parsed.data.debut);
  const fin = new Date(debut.getTime() + duree.max * 60_000);
  const tampon = settings?.tampon_trajet_min ?? 30;

  // Le devis est-il deja accepte ? Si oui, l'intervention est ferme.
  const { data: devisAccepte } = await supabase
    .from('quotes')
    .select('id')
    .eq('job_id', job.id)
    .eq('status', 'accepte')
    .maybeSingle();

  const statut = devisAccepte ? 'confirme' : 'provisoire';

  const { data: intervention, error } = await supabase
    .from('interventions')
    .insert({
      job_id: job.id,
      team_id: equipe.id,
      status: statut,
      starts_at: debut.toISOString(),
      ends_at: fin.toISOString(),
      ends_at_buffered: new Date(fin.getTime() + tampon * 60_000).toISOString(),
      travel_buffer_min: tampon,
    })
    .select('id')
    .single();

  if (error) {
    // 23P01 = violation de contrainte d'exclusion : le creneau est pris.
    if (error.code === '23P01') {
      return {
        error:
          'Ce créneau chevauche une intervention existante, trajet compris. Choisissez une autre heure.',
      };
    }
    return { error: `Planification impossible : ${error.message}` };
  }

  const client = job ? (Array.isArray(job.client) ? job.client[0] : job.client) : null;
  const adresse = [job.adresse, `${job.code_postal ?? ''} ${job.commune}`.trim()]
    .filter(Boolean)
    .join(', ');

  const sync = await synchroniserSansEchec(
    {
      titre: `${job.reference} · ${job.surface_m2} m² · ${job.commune}`,
      description: `Client : ${client?.nom ?? ''}\nService : ${job.service}\nDossier : ${publicEnv.NEXT_PUBLIC_SITE_URL}/chantiers/${job.id}`,
      lieu: adresse,
      debut,
      fin,
      provisoire: statut === 'provisoire',
    },
    null,
  );

  if (sync.id) {
    await supabase
      .from('interventions')
      .update({ google_event_id: sync.id })
      .eq('id', intervention.id);
  }

  if (job.stage === 'gagne') {
    await supabase.from('jobs').update({ stage: 'planifie' }).eq('id', job.id);
  }

  await supabase.from('events').insert({
    job_id: job.id,
    type: 'intervention.scheduled',
    payload: {
      debut: debut.toISOString(),
      statut,
      google: Boolean(sync.id),
      erreur_google: sync.erreur,
    },
    actor_id: session.userId,
  });

  revalidatePath(`/chantiers/${job.id}`);
  revalidatePath('/planning');

  return {
    ok: true,
    message: sync.erreur
      ? 'Intervention planifiée. Google Calendar n’a pas répondu — à reporter manuellement.'
      : `Intervention ${statut === 'confirme' ? 'confirmée' : 'provisoire'} enregistrée.`,
  };
}

/* -------------------------------------------------------------------------- */

export async function lienDevisAction(chemin: string): Promise<string | null> {
  await requireCapability('quotes.write');
  return urlSigneeDocument(chemin, 900);
}

/**
 * Regenere un lien de portail. Le precedent est revoque : on ne laisse jamais
 * deux liens valides en circulation, sinon la revocation ne veut rien dire.
 */
export async function regenererPortailAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const session = await requireCapability('jobs.write');
  const jobId = String(formData.get('jobId') ?? '');

  if (!z.string().uuid().safeParse(jobId).success) return { error: 'Chantier invalide.' };

  const supabase = createAdminClient();

  await supabase
    .from('portal_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .is('revoked_at', null);

  const jeton = genererJetonPortail();
  const { error } = await supabase
    .from('portal_tokens')
    .insert({ job_id: jobId, token_hash: hacherJeton(jeton) });

  if (error) return { error: 'Génération impossible.' };

  await supabase.from('events').insert({
    job_id: jobId,
    type: 'portal.regenerated',
    payload: {},
    actor_id: session.userId,
  });

  revalidatePath(`/chantiers/${jobId}`);

  // Le lien n'est affiche qu'ici, une seule fois : il n'est plus recuperable
  // ensuite, puisque seule son empreinte est stockee.
  return { ok: true, message: urlPortail(jeton, publicEnv.NEXT_PUBLIC_SITE_URL) };
}

/* -------------------------------------------------------------------------- */

const publierSchema = z.object({
  jobId: z.string().uuid(),
  resume: z
    .string()
    .trim()
    .min(80, 'Le résumé doit faire au moins 80 caractères — la base l’impose.')
    .max(1200, 'Résumé trop long : 1200 caractères maximum.'),
});

/**
 * Publie un chantier comme realisation publique.
 *
 * Trois garde-fous, dans cet ordre :
 *
 *   1. Seul un chantier TERMINE peut etre publie. Publier un chantier en
 *      cours reviendrait a montrer un resultat qu'on n'a pas encore obtenu.
 *   2. Le client doit avoir donne son consentement photo. Ce consentement est
 *      distinct du contrat et date : sans lui, aucune photo ne sort. Si le
 *      client n'a rien accorde, la fiche se publie sans image — le texte
 *      reste utile au referencement, la vie privee reste intacte.
 *   3. Le resume doit faire 80 caracteres minimum. La contrainte existe en
 *      base ; on la verifie ici pour donner un message lisible plutot qu'une
 *      erreur SQL.
 *
 * L'identifiant d'URL est derive de la commune, de la surface et du service.
 * En cas de collision — deux maisons de 140 m² a Enghien — un suffixe
 * numerique est ajoute : deux chantiers ne partagent jamais une URL.
 *
 * `revalidatePath` est appele sur la galerie et le sitemap : sans cela, la
 * fiche existerait mais resterait invisible pendant une heure, le temps de la
 * prochaine regeneration.
 */
export async function publierRealisationAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  await requireCapability('jobs.write');

  const parsed = publierSchema.safeParse({
    jobId: formData.get('jobId'),
    resume: formData.get('resume'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides.' };
  }

  const supabase = await createClient();

  const { data: job } = await supabase
    .from('jobs')
    .select('id, stage, commune, surface_m2, service, published, published_slug')
    .eq('id', parsed.data.jobId)
    .maybeSingle();

  if (!job) return { error: 'Chantier introuvable.' };
  if (job.stage !== 'termine') {
    return { error: 'Seul un chantier terminé peut être publié.' };
  }

  const admin = createAdminClient();

  // Consentement photo : verifie au moment de publier, pas au moment de la
  // demande. Un client peut l'avoir retire entre-temps.
  const { data: client } = await admin
    .from('jobs')
    .select('clients ( consent_photos )')
    .eq('id', job.id)
    .maybeSingle<{ clients: { consent_photos: boolean } | null }>();

  const consentement = client?.clients?.consent_photos === true;

  const racine = slugify(
    `${LIBELLES_SERVICE[job.service as keyof typeof LIBELLES_SERVICE] ?? 'chantier'}-${job.surface_m2}m2-${job.commune}`,
  );

  let slug = job.published_slug ?? racine;
  if (!job.published_slug) {
    for (let n = 0; n < 20; n += 1) {
      const essai = n === 0 ? racine : `${racine}-${n + 1}`;
      const { data: pris } = await admin
        .from('jobs')
        .select('id')
        .eq('published_slug', essai)
        .maybeSingle();
      if (!pris) {
        slug = essai;
        break;
      }
    }
  }

  const { error } = await admin
    .from('jobs')
    .update({
      published: true,
      published_slug: slug,
      published_at: new Date().toISOString(),
      resume_public: parsed.data.resume,
    })
    .eq('id', job.id);

  if (error) return { error: `Publication impossible : ${error.message}` };

  // Sans consentement, aucune photo n'est exposee : on les depublie toutes.
  await admin
    .from('photos')
    .update({ is_published: consentement })
    .eq('job_id', job.id)
    .in('phase', ['avant', 'apres']);

  revalidatePath('/realisations');
  revalidatePath(`/realisations/${slug}`);
  revalidatePath('/sitemap.xml');
  revalidatePath(`/chantiers/${job.id}`);

  return {
    ok: true,
    message: consentement
      ? `Publié : /realisations/${slug}`
      : `Publié sans photo (consentement non accordé) : /realisations/${slug}`,
  };
}

/** Retire une realisation du site. Le chantier, lui, n'est pas touche. */
export async function depublierRealisationAction(
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  await requireCapability('jobs.write');
  const jobId = String(formData.get('jobId') ?? '');
  if (!z.string().uuid().safeParse(jobId).success) return { error: 'Chantier introuvable.' };

  const admin = createAdminClient();
  const { data: avant } = await admin
    .from('jobs')
    .select('published_slug')
    .eq('id', jobId)
    .maybeSingle();

  const { error } = await admin.from('jobs').update({ published: false }).eq('id', jobId);
  if (error) return { error: `Retrait impossible : ${error.message}` };

  await admin.from('photos').update({ is_published: false }).eq('job_id', jobId);

  revalidatePath('/realisations');
  if (avant?.published_slug) revalidatePath(`/realisations/${avant.published_slug}`);
  revalidatePath('/sitemap.xml');
  revalidatePath(`/chantiers/${jobId}`);

  return { ok: true, message: 'Réalisation retirée du site.' };
}
