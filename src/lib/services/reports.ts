import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { composerRapport } from '@/lib/pdf/compose';
import { rendreRapportPdf } from '@/lib/pdf/render';
import { televerser, urlSignee } from '@/lib/storage';
import { estimateDuration } from '@/lib/pricing';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { rafraichirMetriques } from '@/lib/services/metrics';
import type { SettingsRow } from '@/types/database';

/**
 * Production du rapport d'intervention.
 *
 * C'est le document qui tient la promesse commerciale. Il part AVANT la
 * facture : un client qui a vu le resultat paie sans discuter, un client qui
 * recoit d'abord une facture cherche ce qui cloche.
 *
 * Les photos sont incorporees en base64 : @react-pdf ne sait pas suivre une
 * URL signee de facon fiable depuis une fonction serverless, et une image
 * manquante sur le rapport ruine le document.
 */

export interface RapportProduit {
  reportId: string;
  numero: string;
  pdfPath: string;
  paires: number;
}

async function imageBase64(chemin: string): Promise<string | null> {
  const url = await urlSignee('chantiers', chemin, 300);
  if (!url) return null;

  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    const octets = Buffer.from(await reponse.arrayBuffer());
    return `data:image/webp;base64,${octets.toString('base64')}`;
  } catch {
    // Une photo illisible ne doit pas empecher le rapport : le gabarit
    // affiche « Photo non disponible » a sa place.
    return null;
  }
}

export async function produireRapport(params: {
  interventionId: string;
  observations: string;
  signataire: string;
  profileId: string | null;
}): Promise<RapportProduit> {
  const supabase = createAdminClient();

  const { data: inter } = await supabase
    .from('interventions')
    .select(
      `id, job_id, status, starts_at, ends_at, sur_place_at, termine_at,
       team:teams ( nom ),
       job:jobs ( id, reference, service, property_type, soil, surface_m2,
                  adresse, code_postal, commune,
                  client:clients ( nom, email, adresse, code_postal, commune, tva ) )`,
    )
    .eq('id', params.interventionId)
    .maybeSingle();

  if (!inter) throw new NotFoundError('Intervention introuvable.');

  const { data: dejaLa } = await supabase
    .from('reports')
    .select('id')
    .eq('intervention_id', params.interventionId)
    .maybeSingle();

  if (dejaLa) {
    throw new ConflictError('Un rapport existe déjà pour cette intervention.', 'report_exists');
  }

  const job = Array.isArray(inter.job) ? inter.job[0] : inter.job;
  if (!job) throw new NotFoundError('Chantier introuvable.');
  const client = Array.isArray(job.client) ? job.client[0] : job.client;
  const equipe = Array.isArray(inter.team) ? inter.team[0] : inter.team;

  const [{ data: settings }, { data: etapes }, { data: progression }, { data: photos }] =
    await Promise.all([
      supabase.from('settings').select('*').maybeSingle<SettingsRow>(),
      supabase.from('checklist_steps').select('*').eq('actif', true).order('ordre'),
      supabase
        .from('checklist_progress')
        .select('ordre, fait_at')
        .eq('intervention_id', params.interventionId)
        .order('ordre'),
      supabase
        .from('photos')
        .select('id, phase, piece, paire, storage_path, thumb_path, legende')
        .eq('job_id', job.id)
        .in('phase', ['avant', 'apres'])
        .not('paire', 'is', null)
        .order('paire'),
    ]);

  if (!settings) throw new NotFoundError('Réglages absents.');

  // --- Checklist ------------------------------------------------------------
  const faitPar = new Map((progression ?? []).map((p) => [p.ordre, p.fait_at]));
  const etapesRapport = (etapes ?? [])
    .filter((e) => faitPar.has(e.ordre))
    .map((e) => ({
      ordre: e.ordre,
      libelle: e.libelle,
      detail: e.detail,
      faitA: new Date(faitPar.get(e.ordre) as string),
    }));

  if (etapesRapport.length < 6) {
    throw new ConflictError(
      `Checklist incomplète : ${etapesRapport.length} étape(s) sur 6.`,
      'checklist_incomplete',
    );
  }

  // --- Paires avant/apres ---------------------------------------------------
  interface Paire {
    piece: string;
    avant?: string;
    apres?: string;
    legende?: string;
  }

  const parPaire = new Map<number, Paire>();
  for (const p of photos ?? []) {
    if (p.paire === null) continue;
    const entree: Paire = parPaire.get(p.paire) ?? { piece: p.piece };
    if (p.phase === 'avant') entree.avant = p.storage_path;
    if (p.phase === 'apres') entree.apres = p.storage_path;
    if (p.legende) entree.legende = p.legende;
    entree.piece = p.piece;
    parPaire.set(p.paire, entree);
  }

  const paires = await Promise.all(
    Array.from(parPaire.entries())
      .sort(([a], [b]) => a - b)
      .map(async ([numero, v]) => ({
        numero,
        piece: v.piece,
        avant: v.avant ? await imageBase64(v.avant) : null,
        apres: v.apres ? await imageBase64(v.apres) : null,
        legende: v.legende,
      })),
  );

  // --- Durees ---------------------------------------------------------------
  const debut = new Date(inter.sur_place_at ?? inter.starts_at);
  const fin = new Date(inter.termine_at ?? new Date());
  const dureeReelle = Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 60_000));
  const estimee = estimateDuration({ surface_m2: job.surface_m2, soil: job.soil });

  const garantieExpire = new Date(fin.getTime() + settings.garantie_heures * 3_600_000);

  // --- Ligne en base --------------------------------------------------------
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      job_id: job.id,
      intervention_id: params.interventionId,
      checklist: etapesRapport.map((e) => ({
        ordre: e.ordre,
        libelle: e.libelle,
        fait_a: e.faitA.toISOString(),
      })),
      observations: params.observations,
      duree_reelle_min: dureeReelle,
      garantie_jusqu_au: garantieExpire.toISOString(),
      validated_by: params.profileId,
      signataire: params.signataire,
      photos_avant: paires.filter((p) => p.avant).length,
      photos_apres: paires.filter((p) => p.apres).length,
    })
    .select('id, numero')
    .single();

  if (error || !report) {
    throw new Error(`Création du rapport impossible : ${error?.message ?? 'inconnu'}`);
  }

  // --- PDF ------------------------------------------------------------------
  const donnees = composerRapport({
    numero: report.numero,
    reference: job.reference,
    client: {
      nom: client?.nom ?? '',
      adresse: client?.adresse ?? undefined,
      codePostal: client?.code_postal ?? undefined,
      commune: client?.commune ?? undefined,
      tva: client?.tva ?? undefined,
    },
    chantier: {
      service: job.service,
      property_type: job.property_type,
      soil: job.soil,
      surface_m2: job.surface_m2,
      adresse: job.adresse,
      code_postal: job.code_postal,
      commune: job.commune,
    },
    execution: {
      debut,
      fin,
      dureeReelleMin: dureeReelle,
      dureeEstimeeMin: estimee.min,
      dureeEstimeeMaxMin: estimee.max,
      equipe: equipe?.nom ?? 'SUITON',
    },
    etapes: etapesRapport,
    paires,
    observations: params.observations,
    garantieHeures: settings.garantie_heures,
    garantieExpireLe: garantieExpire,
    signataire: params.signataire,
    signeLe: new Date(),
    settings,
  });

  const pdf = await rendreRapportPdf(donnees);
  const pdfPath = `rapports/${new Date().getUTCFullYear()}/${report.numero}.pdf`;

  const archivage = await televerser('documents', pdfPath, pdf, 'application/pdf');
  if (!archivage.ok) {
    throw new Error(`Archivage du rapport impossible : ${archivage.erreur}`);
  }

  await supabase.from('reports').update({ pdf_path: pdfPath }).eq('id', report.id);

  await supabase.from('events').insert({
    job_id: job.id,
    type: 'report.created',
    payload: { numero: report.numero, paires: paires.length, duree_min: dureeReelle },
  });

  await rafraichirMetriques(job.id);

  return { reportId: report.id, numero: report.numero, pdfPath, paires: paires.length };
}
