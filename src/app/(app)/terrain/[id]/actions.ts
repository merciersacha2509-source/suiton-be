'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { produireRapport } from '@/lib/services/reports';
import { surRapportValide } from '@/lib/services/pipeline';
import { emailRapport } from '@/lib/emails';
import { telecharger } from '@/lib/storage';
import { dernierDocument, urlDocument } from '@/lib/services/documents';
import { formatDateTime } from '@/lib/format';
import { traiterPhoto, cheminPhoto, PhotoInvalideError } from '@/lib/photos';
import { televerser } from '@/lib/storage';
import { publicEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';

export interface TerrainState {
  ok?: boolean;
  message?: string;
  error?: string;
  /** Renseigné après validation : le lien du rapport produit. */
  rapportUrl?: string;
}

const uuid = z.string().uuid();

/* -------------------------------------------------------------------------
 * Avancement de statut
 * -------------------------------------------------------------------------
 * L'horodatage vient du SERVEUR, jamais du telephone. Un appareil dont
 * l'horloge derive de vingt minutes produirait une duree reelle fausse, et
 * cette duree figure sur le rapport remis au client.
 * ----------------------------------------------------------------------- */
export async function changerStatutAction(
  _prev: TerrainState,
  formData: FormData,
): Promise<TerrainState> {
  await requireCapability('terrain.execute');

  const parsed = z
    .object({
      interventionId: uuid,
      statut: z.enum(['en_route', 'sur_place', 'termine']),
    })
    .safeParse({
      interventionId: formData.get('interventionId'),
      statut: formData.get('statut'),
    });

  if (!parsed.success) return { error: 'Action invalide.' };

  const supabase = await createClient();
  const maintenant = new Date().toISOString();

  const horodatage: Record<string, string> = {
    en_route: 'en_route_at',
    sur_place: 'sur_place_at',
    termine: 'termine_at',
  };

  const { error } = await supabase
    .from('interventions')
    .update({
      status: parsed.data.statut,
      [horodatage[parsed.data.statut] as string]: maintenant,
    })
    .eq('id', parsed.data.interventionId);

  if (error) return { error: "L'enregistrement a échoué. Réessayez." };

  revalidatePath(`/terrain/${parsed.data.interventionId}`);
  revalidatePath('/terrain');

  const messages = {
    en_route: 'En route. Le client est prévenu.',
    sur_place: 'Arrivée enregistrée. Le chronomètre tourne.',
    termine: 'Intervention terminée.',
  };

  return { ok: true, message: messages[parsed.data.statut] };
}

/* -------------------------------------------------------------------------- */

export async function cocherEtapeAction(
  _prev: TerrainState,
  formData: FormData,
): Promise<TerrainState> {
  const session = await requireCapability('terrain.execute');

  const parsed = z
    .object({
      interventionId: uuid,
      ordre: z.coerce.number().int().min(1).max(20),
      decocher: z.coerce.boolean().default(false),
    })
    .safeParse({
      interventionId: formData.get('interventionId'),
      ordre: formData.get('ordre'),
      decocher: formData.get('decocher') === 'true',
    });

  if (!parsed.success) return { error: 'Étape invalide.' };

  const supabase = await createClient();

  if (parsed.data.decocher) {
    await supabase
      .from('checklist_progress')
      .delete()
      .eq('intervention_id', parsed.data.interventionId)
      .eq('ordre', parsed.data.ordre);
  } else {
    // upsert : un double appui ne cree pas deux lignes et ne reecrit pas
    // l'horodatage d'origine.
    await supabase.from('checklist_progress').upsert(
      {
        intervention_id: parsed.data.interventionId,
        ordre: parsed.data.ordre,
        fait_par: session.userId,
      },
      { onConflict: 'intervention_id,ordre', ignoreDuplicates: true },
    );
  }

  revalidatePath(`/terrain/${parsed.data.interventionId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------
 * Depot d'une photo de chantier
 * -------------------------------------------------------------------------
 * Le fichier passe par le serveur pour que la purge EXIF soit garantie.
 * La paire relie un « avant » a un « apres » de la MEME piece : c'est ce qui
 * permet au rapport de les afficher cote a cote.
 * ----------------------------------------------------------------------- */
export async function deposerPhotoAction(
  _prev: TerrainState,
  formData: FormData,
): Promise<TerrainState> {
  const session = await requireCapability('terrain.execute');

  const parsed = z
    .object({
      interventionId: uuid,
      jobId: uuid,
      phase: z.enum(['avant', 'apres', 'contexte', 'incident']),
      piece: z.string().trim().min(1).max(60),
      paire: z.coerce.number().int().min(1).max(40).optional(),
    })
    .safeParse({
      interventionId: formData.get('interventionId'),
      jobId: formData.get('jobId'),
      phase: formData.get('phase'),
      piece: formData.get('piece') || 'general',
      paire: formData.get('paire') || undefined,
    });

  if (!parsed.success) return { error: 'Paramètres invalides.' };

  const fichier = formData.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { error: 'Aucune photo reçue.' };
  }

  try {
    const traitee = await traiterPhoto(Buffer.from(await fichier.arrayBuffer()));
    const id = randomUUID();
    const chemins = cheminPhoto(parsed.data.jobId.slice(0, 8), id);

    const [p1, p2] = await Promise.all([
      televerser('chantiers', chemins.principale, traitee.principale, 'image/webp'),
      televerser('chantiers', chemins.miniature, traitee.miniature, 'image/webp'),
    ]);

    if (!p1.ok || !p2.ok) return { error: `Stockage impossible : ${p1.erreur ?? p2.erreur}` };

    const supabase = await createClient();
    const { error } = await supabase.from('photos').insert({
      id,
      job_id: parsed.data.jobId,
      intervention_id: parsed.data.interventionId,
      phase: parsed.data.phase,
      piece: parsed.data.piece,
      paire: parsed.data.paire ?? null,
      storage_path: chemins.principale,
      thumb_path: chemins.miniature,
      largeur: traitee.largeur,
      hauteur: traitee.hauteur,
      poids_octets: traitee.octets,
      exif_stripped: true,
      uploaded_by: session.userId,
    });

    if (error) {
      // 23505 : la contrainte photos_paire_unique. Une seule photo « avant »
      // et une seule « apres » par paire — sinon le rapport affiche deux fois
      // la meme chose cote a cote.
      if (error.code === '23505') {
        return {
          error: `Une photo « ${parsed.data.phase} » existe déjà pour la paire ${parsed.data.paire}. Choisissez un autre numéro.`,
        };
      }
      return { error: `Enregistrement impossible : ${error.message}` };
    }

    revalidatePath(`/terrain/${parsed.data.interventionId}`);
    return { ok: true, message: 'Photo ajoutée.' };
  } catch (e) {
    if (e instanceof PhotoInvalideError) return { error: e.message };
    console.error('[terrain] photo', e);
    return { error: "La photo n'a pas pu être traitée." };
  }
}

/* -------------------------------------------------------------------------- */

export async function supprimerPhotoAction(
  _prev: TerrainState,
  formData: FormData,
): Promise<TerrainState> {
  await requireCapability('terrain.execute');

  const photoId = String(formData.get('photoId') ?? '');
  const interventionId = String(formData.get('interventionId') ?? '');
  if (!uuid.safeParse(photoId).success) return { error: 'Photo invalide.' };

  const supabase = await createClient();
  await supabase.from('photos').delete().eq('id', photoId);

  revalidatePath(`/terrain/${interventionId}`);
  return { ok: true, message: 'Photo retirée.' };
}

/* -------------------------------------------------------------------------
 * Validation : produit le rapport et l'envoie au client
 * ----------------------------------------------------------------------- */
export async function validerRapportAction(
  _prev: TerrainState,
  formData: FormData,
): Promise<TerrainState> {
  const session = await requireCapability('terrain.execute');

  const parsed = z
    .object({
      interventionId: uuid,
      observations: z
        .string()
        .trim()
        .min(3, 'Décrivez ce que vous avez constaté, même si tout était normal.')
        .max(3000),
    })
    .safeParse({
      interventionId: formData.get('interventionId'),
      observations: formData.get('observations'),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Observations requises.' };
  }

  try {
    const supabase = await createClient();

    // L'intervention doit d'abord etre close : la duree reelle du rapport en
    // depend, et le trigger de cloture fait avancer le chantier.
    await supabase
      .from('interventions')
      .update({ status: 'termine', termine_at: new Date().toISOString() })
      .eq('id', parsed.data.interventionId)
      .neq('status', 'termine');

    const rapport = await produireRapport({
      interventionId: parsed.data.interventionId,
      observations: parsed.data.observations,
      signataire: session.profile.nom,
      profileId: session.userId,
    });

    // Envoi au client — best effort. Le rapport existe de toute facon.
    const { data: contexte } = await supabase
      .from('reports')
      .select('job:jobs ( id, reference, client:clients ( nom, email ) )')
      .eq('id', rapport.reportId)
      .maybeSingle();

    const job = contexte
      ? Array.isArray(contexte.job)
        ? contexte.job[0]
        : contexte.job
      : null;
    const jobId = job?.id ?? null;
    const client = job ? (Array.isArray(job.client) ? job.client[0] : job.client) : null;

    // Attestation et rapport qualite AVANT l'envoi : l'attestation part en
    // piece jointe avec le rapport, elle doit donc exister d'abord.
    if (jobId) {
      const suite = await surRapportValide(jobId, parsed.data.interventionId);
      if (suite.erreurs.length > 0) {
        console.warn('[terrain] documents annexes', suite.erreurs.join(' · '));
      }
    }

    let envoye = false;
    if (client?.email && jobId) {
      // Le rapport ET l'attestation partent en pieces jointes. Le lien de
      // portail les accompagne, il ne les remplace pas.
      const [pdfRapport, attestation] = await Promise.all([
        telecharger('documents', rapport.pdfPath),
        dernierDocument(jobId, 'attestation'),
      ]);

      const pdfAttestation = attestation
        ? await telecharger('documents', attestation.storagePath)
        : null;

      const { data: garantie } = await supabase
        .from('reports')
        .select('garantie_jusqu_au')
        .eq('id', rapport.reportId)
        .maybeSingle();

      const envoi = await emailRapport({
        email: client.email,
        nom: client.nom,
        numero: rapport.numero,
        reference: job?.reference ?? '',
        comparaisons: rapport.paires,
        garantieJusquAu: garantie?.garantie_jusqu_au
          ? formatDateTime(garantie.garantie_jusqu_au)
          : '',
        urlPortail: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portail`,
        pdf: pdfRapport ?? undefined,
        attestationPdf: pdfAttestation ?? undefined,
        attestationNumero: attestation?.numero,
      });
      envoye = envoi.envoye;

      if (envoye) {
        await supabase
          .from('reports')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', rapport.reportId);
      }
    }

    // Chaine documentaire : attestation de fin de chantier + rapport qualite
    // interne. Best effort : le rapport, lui, est deja produit et envoye.
    revalidatePath(`/terrain/${parsed.data.interventionId}`);
    revalidatePath('/terrain');

    return {
      ok: true,
      message: envoye
        ? `Rapport ${rapport.numero} produit et envoyé au client.`
        : `Rapport ${rapport.numero} produit. L'e-mail n'a pas pu partir — transmettez le lien à la main.`,
      rapportUrl: (await urlDocument(rapport.pdfPath, 3600)) ?? undefined,
    };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error('[terrain] rapport', e);
    return { error: 'La génération du rapport a échoué. Prévenez la direction.' };
  }
}
