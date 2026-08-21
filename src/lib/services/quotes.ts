import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { estimate, estimateDuration } from '@/lib/pricing';
import { computeAmounts, resolveVat } from '@/lib/vat';
import { composerDevis } from '@/lib/pdf/compose';
import { rendreDevisPdf } from '@/lib/pdf/render';
import { publicEnv } from '@/lib/env';
import { NotFoundError, ConflictError } from '@/lib/errors';
import { rafraichirMetriques } from '@/lib/services/metrics';
import { televerser, urlSignee } from '@/lib/storage';
import type { SettingsRow } from '@/types/database';

/**
 * Production d'un devis a partir d'un chantier.
 *
 * Le montant est TOUJOURS recalcule ici, a partir de la grille en base et des
 * caracteristiques du chantier. Aucun montant venu du client, d'un formulaire
 * ou d'une API n'entre dans ce calcul.
 *
 * Le devis retenu est le HAUT de la fourchette d'estimation : un devis est un
 * engagement ferme, pas une estimation. Annoncer le bas et facturer le haut
 * est la meilleure facon de perdre un client fidele.
 */

export interface DevisProduit {
  quoteId: string;
  numero: string;
  pdfPath: string;
  montantHtva: number;
  montantTtc: number;
  autoliquidation: boolean;
}

/** Travaux immobiliers au sens TVA : ouvre l'autoliquidation entre assujettis. */
function estTravauxImmobiliers(service: string): boolean {
  return service === 'fin_de_chantier' || service === 'apres_renovation';
}

export async function produireDevis(jobId: string): Promise<DevisProduit> {
  const supabase = createAdminClient();

  const { data: job, error: jobErreur } = await supabase
    .from('jobs')
    .select(
      `id, reference, service, property_type, soil, surface_m2, adresse, code_postal,
       commune, zone, urgent, date_souhaitee,
       client:clients ( id, nom, email, adresse, code_postal, commune, tva, kind )`,
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobErreur || !job) throw new NotFoundError('Chantier introuvable.');

  const client = Array.isArray(job.client) ? job.client[0] : job.client;
  if (!client) throw new NotFoundError('Client introuvable.');

  // Un devis deja accepte ne se regenere pas : il fait foi.
  const { data: existant } = await supabase
    .from('quotes')
    .select('id, status')
    .eq('job_id', jobId)
    .in('status', ['accepte'])
    .maybeSingle();

  if (existant) {
    throw new ConflictError('Un devis accepté existe déjà pour ce chantier.', 'quote_accepted');
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle<SettingsRow>();
  if (!settings) throw new NotFoundError('Réglages absents. Appliquez les migrations.');

  // --- Calcul ---------------------------------------------------------------
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

  const duree = estimateDuration({ surface_m2: job.surface_m2, soil: job.soil });

  const tva = resolveVat({
    clientKind: client.kind,
    clientVat: client.tva,
    travauxImmobiliers: estTravauxImmobiliers(job.service),
  });

  const montants = computeAmounts(estimation.max, tva.taux);

  // --- Ligne en base --------------------------------------------------------
  const valideJusquAu = new Date();
  valideJusquAu.setDate(valideJusquAu.getDate() + (settings.validite_devis_jours ?? 30));

  const lignes = [
    {
      designation: job.service,
      surface_m2: job.surface_m2,
      prix_m2: estimation.detail.prixM2Max,
      frais_zone: estimation.detail.fraisZone,
      majoration_urgence: estimation.detail.majorationUrgence,
    },
  ];

  const { data: quote, error: quoteErreur } = await supabase
    .from('quotes')
    .insert({
      job_id: jobId,
      status: 'brouillon',
      vat_regime: tva.regime,
      montant_htva: montants.htva,
      tva_montant: montants.tva,
      montant_ttc: montants.ttc,
      lignes,
      valide_jusqu_au: valideJusquAu.toISOString().slice(0, 10),
      acompte_montant:
        Math.round(((montants.ttc * (settings.acompte_pct ?? 30)) / 100) * 100) / 100,
    })
    .select('id, numero')
    .single();

  if (quoteErreur || !quote) {
    throw new Error(`Création du devis impossible : ${quoteErreur?.message ?? 'inconnu'}`);
  }

  // --- PDF ------------------------------------------------------------------
  const donnees = composerDevis({
    numero: quote.numero,
    emisLe: new Date(),
    valideJusquAu,
    referenceChantier: job.reference,
    client: {
      nom: client.nom,
      adresse: client.adresse ?? undefined,
      codePostal: client.code_postal ?? undefined,
      commune: client.commune ?? undefined,
      tva: client.tva ?? undefined,
    },
    chantier: {
      service: job.service,
      property_type: job.property_type,
      soil: job.soil,
      surface_m2: job.surface_m2,
      adresse: job.adresse ?? null,
      code_postal: job.code_postal ?? null,
      commune: job.commune,
      zone: job.zone,
      dateSouhaitee: job.date_souhaitee ? new Date(job.date_souhaitee) : null,
      dureeMin: duree.min,
      dureeMax: duree.max,
    },
    fraisZone: estimation.detail.fraisZone,
    majorationUrgence: estimation.detail.majorationUrgence,
    montantHtva: montants.htva,
    tvaTaux: tva.taux,
    tvaMontant: montants.tva,
    montantTtc: montants.ttc,
    mentionTva: tva.mention,
    settings,
  });

  const pdf = await rendreDevisPdf(donnees);
  const pdfPath = `devis/${new Date().getUTCFullYear()}/${quote.numero}.pdf`;

  const archivage = await televerser('documents', pdfPath, pdf, 'application/pdf');

  if (!archivage.ok) {
    // Le devis existe en base mais son PDF n'a pas pu etre archive. On le
    // signale plutot que de laisser une ligne sans document : la
    // numerotation, elle, est deja consommee et ne se recycle pas.
    throw new Error(`Archivage du devis impossible : ${archivage.erreur}`);
  }

  await supabase.from('quotes').update({ pdf_path: pdfPath }).eq('id', quote.id);

  await supabase.from('events').insert({
    job_id: jobId,
    type: 'quote.created',
    payload: { quote_id: quote.id, numero: quote.numero, montant_ttc: montants.ttc },
  });

  // Le chantier avance : le devis est pret a partir.
  await supabase.from('jobs').update({ stage: 'devis_a_produire' }).eq('id', jobId);

  await rafraichirMetriques(jobId);

  return {
    quoteId: quote.id,
    numero: quote.numero,
    pdfPath,
    montantHtva: montants.htva,
    montantTtc: montants.ttc,
    autoliquidation: tva.regime === 'autoliquidation',
  };
}

/** URL signee de courte duree. Les documents ne sont jamais publics. */
export async function urlSigneeDocument(
  chemin: string,
  secondes = 900,
): Promise<string | null> {
  return urlSignee('documents', chemin, secondes);
}

export function urlAcceptation(jeton: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/portail/${jeton}`;
}
