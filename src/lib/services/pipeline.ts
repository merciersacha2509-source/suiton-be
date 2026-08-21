import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  archiverChantier,
  dernierDocument,
  enregistrerDocument,
  marquerEnvoye,
  urlDocument,
} from '@/lib/services/documents';
import {
  composerAttestation,
  composerBonIntervention,
  composerFicheChantier,
  composerRapportQualite,
} from '@/lib/pdf/compose';
import {
  rendreAttestationPdf,
  rendreBonInterventionPdf,
  rendreFicheChantierPdf,
  rendreRapportQualitePdf,
} from '@/lib/pdf/render';
import { estimateDuration } from '@/lib/pricing';
import { scoreBand } from '@/lib/scoring';
import { NotFoundError } from '@/lib/errors';
import { rafraichirMetriques } from '@/lib/services/metrics';
import type { SettingsRow } from '@/types/database';

/**
 * Chaine documentaire.
 *
 * Reservation  → devis
 * Devis accepté → bon d'intervention + fiche chantier
 * Intervention terminée → rapport + attestation + rapport qualité
 * Facture payée → archive
 *
 * Chaque etape est IDEMPOTENTE : la rejouer ne produit rien de nouveau si le
 * document existe deja et que les donnees n'ont pas bouge. Le registre le
 * garantit par l'empreinte du PDF.
 *
 * Chaque etape est aussi TOLERANTE A L'ECHEC : la production d'un document
 * secondaire qui echoue ne remet jamais en cause l'operation metier. Un
 * chantier accepte sans bon d'intervention se rattrape ; un devis accepte
 * qu'on a perdu, non.
 */

export interface ResultatEtape {
  produits: { type: string; numero: string; version: number; url?: string }[];
  erreurs: string[];
}

async function reglages(): Promise<SettingsRow> {
  const { data } = await createAdminClient()
    .from('settings')
    .select('*')
    .maybeSingle<SettingsRow>();
  if (!data) throw new NotFoundError('Réglages absents.');
  return data;
}

/** Numéro d'un document annexe, dérivé de la référence du chantier. */
function numeroAnnexe(prefixe: string, reference: string): string {
  // SUITON-2026-0148 → SUITON-B-2026-0148
  return reference.replace(/^SUITON-/, `SUITON-${prefixe}-`);
}

/* ==========================================================================
 * Devis accepté → bon d'intervention + fiche chantier
 * ======================================================================== */

export async function surDevisAccepte(jobId: string): Promise<ResultatEtape> {
  const resultat: ResultatEtape = { produits: [], erreurs: [] };
  const supabase = createAdminClient();
  const settings = await reglages();

  const { data: job } = await supabase
    .from('jobs')
    .select(
      `id, reference, stage, service, property_type, soil, surface_m2, adresse, code_postal,
       commune, zone, urgent, notes, estimation_min, estimation_max,
       client:clients ( nom, email, telephone, adresse, code_postal, commune, tva, kind, score )`,
    )
    .eq('id', jobId)
    .maybeSingle();

  if (!job) throw new NotFoundError('Chantier introuvable.');
  const client = Array.isArray(job.client) ? job.client[0] : job.client;
  if (!client) throw new NotFoundError('Client introuvable.');

  const { data: intervention } = await supabase
    .from('interventions')
    .select('id, starts_at, ends_at, acces_notes, team:teams ( nom )')
    .eq('job_id', jobId)
    .neq('status', 'annule')
    .order('starts_at')
    .limit(1)
    .maybeSingle();

  // --- Bon d'intervention ---------------------------------------------------
  // Sans intervention planifiee, pas de bon : on ne fabrique pas un document
  // avec une date inventee.
  if (intervention) {
    try {
      const equipe = Array.isArray(intervention.team)
        ? intervention.team[0]
        : intervention.team;
      const donnees = composerBonIntervention({
        numero: numeroAnnexe('B', job.reference),
        reference: job.reference,
        debut: new Date(intervention.starts_at),
        fin: new Date(intervention.ends_at),
        equipe: equipe?.nom ?? 'Équipe 1',
        client: {
          nom: client.nom,
          telephone: client.telephone,
          adresse: client.adresse ?? undefined,
          codePostal: client.code_postal ?? undefined,
          commune: client.commune ?? undefined,
        },
        chantier: {
          service: job.service,
          property_type: job.property_type,
          soil: job.soil,
          surface_m2: job.surface_m2,
          adresse: job.adresse,
          code_postal: job.code_postal,
          commune: job.commune,
          zone: job.zone,
          urgent: job.urgent,
          notes: job.notes,
        },
        accesNotes: intervention.acces_notes,
        settings,
      });

      const doc = await enregistrerDocument({
        jobId,
        type: 'bon_intervention',
        numero: donnees.numero,
        pdf: await rendreBonInterventionPdf(donnees),
        entityId: intervention.id,
        snapshot: { intervention_id: intervention.id },
      });

      resultat.produits.push({
        type: 'bon_intervention',
        numero: doc.numero,
        version: doc.version,
      });
    } catch (e) {
      resultat.erreurs.push(
        `Bon d'intervention : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
      );
    }
  } else {
    resultat.erreurs.push(
      "Bon d'intervention non produit : aucune intervention n'est encore planifiée.",
    );
  }

  // --- Fiche chantier -------------------------------------------------------
  try {
    const fiche = await produireFicheChantier(jobId);
    resultat.produits.push(fiche);
  } catch (e) {
    resultat.erreurs.push(
      `Fiche chantier : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
    );
  }

  return resultat;
}

/* ==========================================================================
 * Fiche chantier — regenerable a tout moment
 * ======================================================================== */

export async function produireFicheChantier(jobId: string) {
  const supabase = createAdminClient();
  const settings = await reglages();

  const { data: job } = await supabase
    .from('jobs')
    .select(
      `id, reference, stage, service, property_type, soil, surface_m2, commune, zone, urgent,
       notes, estimation_min, estimation_max, duree_reelle_min,
       client:clients ( nom, email, telephone, commune, tva, kind, score )`,
    )
    .eq('id', jobId)
    .maybeSingle();

  if (!job) throw new NotFoundError('Chantier introuvable.');
  const client = Array.isArray(job.client) ? job.client[0] : job.client;
  if (!client) throw new NotFoundError('Client introuvable.');

  const [
    { data: etapes },
    { data: progression },
    { data: evenements },
    { data: devis },
    { data: facture },
  ] = await Promise.all([
    supabase.from('checklist_steps').select('ordre, libelle').eq('actif', true).order('ordre'),
    supabase
      .from('checklist_progress')
      .select('ordre, fait_at, intervention:interventions!inner ( job_id )')
      .eq('interventions.job_id', jobId),
    supabase
      .from('events')
      .select('type, payload, created_at')
      .eq('job_id', jobId)
      .order('created_at')
      .limit(20),
    supabase
      .from('quotes')
      .select('montant_ttc')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('montant_ttc')
      .eq('job_id', jobId)
      .eq('kind', 'facture')
      .limit(1)
      .maybeSingle(),
  ]);

  const faits = new Map(
    (progression ?? []).map((p) => [p.ordre as number, new Date(p.fait_at as string)]),
  );
  const duree = estimateDuration({ surface_m2: job.surface_m2, soil: job.soil });

  const donnees = composerFicheChantier({
    reference: job.reference,
    etape: job.stage,
    client: {
      nom: client.nom,
      telephone: client.telephone,
      commune: client.commune ?? undefined,
      tva: client.tva ?? undefined,
      score: client.score,
      bande: scoreBand(client.score),
      kind: client.kind,
    },
    chantier: {
      service: job.service,
      property_type: job.property_type,
      soil: job.soil,
      surface_m2: job.surface_m2,
      commune: job.commune,
      zone: job.zone,
      urgent: job.urgent,
      notes: job.notes,
    },
    economie: {
      estimationMin: job.estimation_min !== null ? Number(job.estimation_min) : null,
      estimationMax: job.estimation_max !== null ? Number(job.estimation_max) : null,
      devisTtc: devis ? Number(devis.montant_ttc) : null,
      factureTtc: facture ? Number(facture.montant_ttc) : null,
      dureeEstimeeMin: duree.min,
      dureeEstimeeMax: duree.max,
      dureeReelleMin: job.duree_reelle_min,
    },
    checklist: (etapes ?? []).map((e) => ({
      ordre: e.ordre,
      libelle: e.libelle,
      faitA: faits.get(e.ordre) ?? null,
    })),
    historique: (evenements ?? []).map((e) => ({
      date: new Date(e.created_at),
      type: e.type,
      detail: resumerEvenement(e.type, e.payload as Record<string, unknown>),
    })),
    settings,
  });

  const doc = await enregistrerDocument({
    jobId,
    type: 'fiche_chantier',
    numero: numeroAnnexe('FC', job.reference),
    pdf: await rendreFicheChantierPdf({
      ...donnees,
      numero: numeroAnnexe('FC', job.reference),
    }),
  });

  return { type: 'fiche_chantier', numero: doc.numero, version: doc.version };
}

/** Traduit un evenement technique en phrase lisible sur la fiche. */
function resumerEvenement(type: string, payload: Record<string, unknown>): string {
  const n = (cle: string) => (payload?.[cle] ? String(payload[cle]) : '');

  switch (type) {
    case 'booking.created':
      return `Réservation reçue — score ${n('score')}`;
    case 'quote.created':
      return `Devis ${n('numero')} produit`;
    case 'quote.sent':
      return `Devis envoyé à ${n('destinataire')}`;
    case 'quote.accepted':
      return `Devis ${n('numero')} accepté`;
    case 'quote.refused':
      return `Devis refusé — ${n('motif') || 'sans motif'}`;
    case 'intervention.scheduled':
      return 'Intervention planifiée';
    case 'report.created':
      return `Rapport ${n('numero')} — ${n('paires')} comparaison(s)`;
    case 'invoice.created':
      return `Facture ${n('numero')}`;
    case 'document.created':
      return `${n('document')} ${n('numero')} v${n('version')}`;
    case 'job.archived':
      return 'Chantier archivé';
    default:
      return type;
  }
}

/* ==========================================================================
 * Rapport validé → attestation + rapport qualité
 * ======================================================================== */

export async function surRapportValide(
  jobId: string,
  interventionId: string,
): Promise<ResultatEtape> {
  const resultat: ResultatEtape = { produits: [], erreurs: [] };
  const supabase = createAdminClient();
  const settings = await reglages();

  const { data: job } = await supabase
    .from('jobs')
    .select(
      `id, reference, service, property_type, soil, surface_m2, adresse, code_postal, commune,
       client:clients ( nom, adresse, code_postal, commune, tva )`,
    )
    .eq('id', jobId)
    .maybeSingle();

  if (!job) throw new NotFoundError('Chantier introuvable.');
  const client = Array.isArray(job.client) ? job.client[0] : job.client;

  const { data: inter } = await supabase
    .from('interventions')
    .select('id, sur_place_at, termine_at, starts_at, team:teams ( nom )')
    .eq('id', interventionId)
    .maybeSingle();

  const { data: rapport } = await supabase
    .from('reports')
    .select(
      'numero, observations, duree_reelle_min, garantie_jusqu_au, validated_at, signataire',
    )
    .eq('intervention_id', interventionId)
    .maybeSingle();

  if (!inter || !rapport) {
    resultat.erreurs.push('Rapport ou intervention introuvable.');
    return resultat;
  }

  const equipe = Array.isArray(inter.team) ? inter.team[0] : inter.team;
  const debut = new Date(inter.sur_place_at ?? inter.starts_at);
  const fin = new Date(inter.termine_at ?? new Date());
  const duree = estimateDuration({ surface_m2: job.surface_m2, soil: job.soil });

  // --- Attestation de fin de chantier ---------------------------------------
  try {
    const donnees = composerAttestation({
      numero: numeroAnnexe('A', job.reference),
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
        surface_m2: job.surface_m2,
        adresse: job.adresse,
        code_postal: job.code_postal,
        commune: job.commune,
      },
      intervention: {
        debut,
        fin,
        dureeMin: rapport.duree_reelle_min ?? 0,
        equipe: equipe?.nom ?? 'SUITON',
      },
      garantieHeures: settings.garantie_heures,
      garantieExpireLe: new Date(rapport.garantie_jusqu_au),
      rapportNumero: rapport.numero,
      signataire: rapport.signataire ?? 'SUITON',
      settings,
    });

    const doc = await enregistrerDocument({
      jobId,
      type: 'attestation',
      numero: donnees.numero,
      pdf: await rendreAttestationPdf(donnees),
      entityId: interventionId,
    });
    resultat.produits.push({ type: 'attestation', numero: doc.numero, version: doc.version });
  } catch (e) {
    resultat.erreurs.push(
      `Attestation : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
    );
  }

  // --- Rapport qualité (interne) --------------------------------------------
  try {
    const [{ data: etapesRef }, { data: progression }, { data: photos }] = await Promise.all([
      supabase
        .from('checklist_steps')
        .select('ordre, libelle, detail')
        .eq('actif', true)
        .order('ordre'),
      supabase
        .from('checklist_progress')
        .select('ordre, fait_at')
        .eq('intervention_id', interventionId)
        .order('ordre'),
      supabase
        .from('photos')
        .select('phase, piece, paire')
        .eq('job_id', jobId)
        .not('paire', 'is', null),
    ]);

    const refs = new Map((etapesRef ?? []).map((e) => [e.ordre, e]));
    const etapes = (progression ?? []).map((p) => ({
      ordre: p.ordre,
      libelle: refs.get(p.ordre)?.libelle ?? `Étape ${p.ordre}`,
      detail: refs.get(p.ordre)?.detail ?? '',
      faitA: new Date(p.fait_at),
    }));

    const parPaire = new Map<number, { piece: string; avant: boolean; apres: boolean }>();
    for (const ph of photos ?? []) {
      if (ph.paire === null) continue;
      const e = parPaire.get(ph.paire) ?? {
        piece: ph.piece as string,
        avant: false,
        apres: false,
      };
      if (ph.phase === 'avant') e.avant = true;
      if (ph.phase === 'apres') e.apres = true;
      parPaire.set(ph.paire, e);
    }

    const donnees = composerRapportQualite({
      numero: numeroAnnexe('Q', job.reference),
      reference: job.reference,
      chantier: {
        service: job.service,
        soil: job.soil,
        surface_m2: job.surface_m2,
        commune: job.commune,
      },
      execution: {
        debut,
        fin,
        dureeReelleMin: rapport.duree_reelle_min ?? 0,
        dureeEstimeeMin: duree.min,
        dureeEstimeeMax: duree.max,
        equipe: equipe?.nom ?? 'SUITON',
      },
      etapes,
      paires: Array.from(parPaire.entries()).map(([numero, v]) => ({ numero, ...v })),
      observations: rapport.observations,
      settings,
    });

    const doc = await enregistrerDocument({
      jobId,
      type: 'rapport_qualite',
      numero: donnees.numero,
      pdf: await rendreRapportQualitePdf(donnees),
      entityId: interventionId,
    });
    resultat.produits.push({
      type: 'rapport_qualite',
      numero: doc.numero,
      version: doc.version,
    });
  } catch (e) {
    resultat.erreurs.push(
      `Rapport qualité : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
    );
  }

  return resultat;
}

/* ==========================================================================
 * Facture payée → archive
 * ======================================================================== */

export async function surFacturePayee(
  jobId: string,
  parProfileId: string | null,
): Promise<ResultatEtape> {
  const resultat: ResultatEtape = { produits: [], erreurs: [] };

  // Les metriques d'abord : le chantier n'est « complet » qu'une fois paye,
  // et c'est cet etat qui le fait entrer dans les references.
  await rafraichirMetriques(jobId);

  try {
    // La fiche chantier est regeneree une derniere fois : elle porte alors
    // les chiffres definitifs, y compris le montant facture.
    const fiche = await produireFicheChantier(jobId);
    resultat.produits.push(fiche);
  } catch (e) {
    resultat.erreurs.push(`Fiche finale : ${e instanceof Error ? e.message : 'erreur'}`);
  }

  try {
    const archive = await archiverChantier(jobId, parProfileId);
    resultat.produits.push({
      type: 'archive',
      numero: `${archive.documents} documents`,
      version: 1,
    });
  } catch (e) {
    resultat.erreurs.push(`Archive : ${e instanceof Error ? e.message : 'erreur'}`);
  }

  return resultat;
}

/* ========================================================================== */

export { dernierDocument, marquerEnvoye, urlDocument };
