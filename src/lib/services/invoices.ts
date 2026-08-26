import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { composerFacture } from '@/lib/pdf/compose';
import { rendreFacturePdf } from '@/lib/pdf/render';
import { televerser, urlSignee } from '@/lib/storage';
import { estimate } from '@/lib/pricing';
import { computeAmounts, resolveVat } from '@/lib/vat';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { rafraichirMetriques } from '@/lib/services/metrics';
import type { SettingsRow } from '@/types/database';

/**
 * Facturation.
 *
 * REGLE ABSOLUE — depuis le 1er janvier 2026, une facture B2B belge doit
 * etre transmise en format STRUCTURE via Peppol. Un PDF n'y satisfait pas et
 * empeche le client de deduire sa TVA : il s'en apercoit a sa declaration,
 * plusieurs semaines plus tard, et le litige porte sur un montant qu'il vous
 * reclame.
 *
 * La contrainte `b2b_peppol` interdit en base de passer une facture B2B au
 * statut « emise » sans identifiant Peppol. Tant que la connexion Billit
 * n'est pas livree, ce service REFUSE d'emettre une facture professionnelle
 * plutot que de produire un document non conforme.
 *
 * Pour un particulier, en revanche, le PDF est la facture, et tout
 * fonctionne de bout en bout.
 */

export interface FactureProduite {
  invoiceId: string;
  numero: string;
  pdfPath: string;
  communication: string;
  montantTtc: number;
  autoliquidation: boolean;
}

export class PeppolRequisError extends ConflictError {
  constructor() {
    super(
      'Ce client est un professionnel : la facture doit partir par Peppol au format structuré, ' +
        'ce que SUITON OS ne fait pas encore. Établissez-la depuis votre outil comptable — ' +
        'le PDF ci-dessous vous sert de base.',
      'peppol_requis',
    );
  }
}

function estTravauxImmobiliers(service: string): boolean {
  return service === 'fin_de_chantier';
}

export async function produireFacture(params: {
  jobId: string;
  /** true : produit le PDF sans emettre. Seule voie possible en B2B pour l'instant. */
  brouillonSeulement?: boolean;
}): Promise<FactureProduite> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('jobs')
    .select(
      `id, reference, stage, service, property_type, soil, surface_m2, adresse, code_postal,
       commune, zone, urgent, partner_id,
       client:clients ( id, nom, email, adresse, code_postal, commune, tva, kind )`,
    )
    .eq('id', params.jobId)
    .maybeSingle();

  if (!job) throw new NotFoundError('Chantier introuvable.');
  const client = Array.isArray(job.client) ? job.client[0] : job.client;
  if (!client) throw new NotFoundError('Client introuvable.');

  if (job.stage !== 'termine') {
    throw new ConflictError(
      'On ne facture pas un chantier qui n’est pas terminé.',
      'chantier_non_termine',
    );
  }

  const { data: dejaLa } = await supabase
    .from('invoices')
    .select('id, numero')
    .eq('job_id', params.jobId)
    .eq('kind', 'facture')
    .maybeSingle();

  if (dejaLa) {
    throw new ConflictError(`La facture ${dejaLa.numero} existe déjà.`, 'facture_existe');
  }

  const [{ data: settings }, { data: devis }, { data: intervention }] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle<SettingsRow>(),
    supabase
      .from('quotes')
      .select('id, numero, montant_htva, tva_montant, montant_ttc, vat_regime, status')
      .eq('job_id', params.jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('interventions')
      .select('starts_at')
      .eq('job_id', params.jobId)
      .eq('status', 'termine')
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);

  if (!settings) throw new NotFoundError('Réglages absents.');

  // --- Montants -------------------------------------------------------------
  // Le devis accepte fait foi : c'est ce sur quoi le client s'est engage.
  // A defaut, on recalcule depuis la grille — jamais depuis une saisie.
  const tva = resolveVat({
    clientKind: client.kind,
    clientVat: client.tva,
    travauxImmobiliers: estTravauxImmobiliers(job.service),
  });

  let htva: number;
  if (devis && devis.status === 'accepte') {
    htva = Number(devis.montant_htva);
  } else {
    const estimation = estimate(
      {
        service: job.service,
        soil: job.soil,
        surface_m2: job.surface_m2,
        zone: job.zone,
        urgent: job.urgent,
      },
      settings,
    );
    htva = estimation.max;
  }

  const montants = computeAmounts(htva, tva.taux);

  const estPro = client.kind === 'professionnel' || Boolean(job.partner_id);
  if (estPro && !params.brouillonSeulement) {
    throw new PeppolRequisError();
  }

  const echeance = new Date();
  echeance.setDate(echeance.getDate() + (settings.delai_paiement_jours ?? 15));

  const dateIntervention = intervention?.starts_at ? new Date(intervention.starts_at) : null;

  const { data: facture, error } = await supabase
    .from('invoices')
    .insert({
      job_id: job.id,
      client_id: client.id,
      partner_id: job.partner_id,
      quote_id: devis?.id ?? null,
      // Un professionnel reste en brouillon : la contrainte b2b_peppol
      // refuserait l'emission sans identifiant Peppol, et c'est exactement
      // ce qu'on veut.
      status: estPro ? 'brouillon' : 'emise',
      vat_regime: tva.regime,
      montant_htva: montants.htva,
      tva_montant: montants.tva,
      montant_ttc: montants.ttc,
      date_emission: estPro ? null : new Date().toISOString().slice(0, 10),
      date_echeance: echeance.toISOString().slice(0, 10),
      intervention_date: dateIntervention?.toISOString().slice(0, 10) ?? null,
    })
    .select('id, numero, communication')
    .single();

  if (error || !facture) {
    throw new Error(`Création de la facture impossible : ${error?.message ?? 'inconnu'}`);
  }

  // --- Estimation des composantes pour les lignes ---------------------------
  const estimation = estimate(
    {
      service: job.service,
      soil: job.soil,
      surface_m2: job.surface_m2,
      zone: job.zone,
      urgent: job.urgent,
    },
    settings,
  );

  const donnees = composerFacture({
    numero: facture.numero,
    emisLe: new Date(),
    echeanceLe: echeance,
    communication: facture.communication ?? '',
    client: {
      nom: client.nom,
      adresse: client.adresse ?? undefined,
      codePostal: client.code_postal ?? undefined,
      commune: client.commune ?? undefined,
      tva: client.tva ?? undefined,
    },
    chantier: {
      service: job.service,
      surface_m2: job.surface_m2,
      adresse: job.adresse,
      code_postal: job.code_postal,
      commune: job.commune,
      zone: job.zone,
      dateIntervention,
    },
    devisReference: devis?.numero ?? '—',
    fraisZone: estimation.detail.fraisZone,
    majorationUrgence: estimation.detail.majorationUrgence,
    montantHtva: montants.htva,
    tvaTaux: tva.taux,
    tvaMontant: montants.tva,
    montantTtc: montants.ttc,
    settings,
  });

  const pdf = await rendreFacturePdf(donnees);
  const pdfPath = `factures/${new Date().getUTCFullYear()}/${facture.numero}.pdf`;

  const archivage = await televerser('documents', pdfPath, pdf, 'application/pdf');
  if (!archivage.ok) {
    throw new Error(`Archivage impossible : ${archivage.erreur}`);
  }

  await supabase.from('invoices').update({ pdf_path: pdfPath }).eq('id', facture.id);

  await supabase.from('events').insert({
    job_id: job.id,
    type: 'invoice.created',
    payload: {
      numero: facture.numero,
      montant_ttc: montants.ttc,
      regime: tva.regime,
      brouillon: estPro,
    },
  });

  await rafraichirMetriques(job.id);

  return {
    invoiceId: facture.id,
    numero: facture.numero,
    pdfPath,
    communication: facture.communication ?? '',
    montantTtc: montants.ttc,
    autoliquidation: tva.regime === 'autoliquidation',
  };
}

export async function urlSigneeFacture(chemin: string, secondes = 900): Promise<string | null> {
  return urlSignee('documents', chemin, secondes);
}
