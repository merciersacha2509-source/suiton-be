import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { hacherJeton, jetonPlausible } from '@/lib/tokens';
import { NotFoundError } from '@/lib/errors';
import { urlSignee } from '@/lib/storage';
import type {
  JobStage,
  QuoteRow,
  InterventionStatus,
  ServiceType,
  SoilLevel,
  PropertyType,
} from '@/types/database';

/**
 * Acces au portail client.
 *
 * Toute anomalie — jeton illisible, inconnu, expire, revoque — produit la
 * MEME erreur 404. Distinguer « jeton inconnu » de « jeton expire »
 * confirmerait a un attaquant qu'un dossier existe.
 */

export interface DossierClient {
  jobId: string;
  reference: string;
  stage: JobStage;
  service: ServiceType;
  propertyType: PropertyType;
  soil: SoilLevel;
  surface: number;
  commune: string;
  codePostal: string | null;
  urgent: boolean;
  creeLe: string;

  client: {
    prenom: string;
    nom: string;
    email: string;
    consentPhotos: boolean;
  };

  estimation: { min: number | null; max: number | null };

  devis: {
    id: string;
    numero: string;
    status: QuoteRow['status'];
    montantHtva: number;
    montantTtc: number;
    autoliquidation: boolean;
    valideJusquAu: string;
    urlPdf: string | null;
  } | null;

  intervention: {
    id: string;
    status: InterventionStatus;
    debut: string;
    fin: string;
  } | null;

  photos: { id: string; url: string | null; phase: string; legende: string | null }[];

  /** Documents remis au client. Toujours par URL signee, jamais publics. */
  documents: {
    type: 'devis' | 'rapport' | 'facture';
    numero: string;
    url: string;
    date: string;
  }[];

  rapport: { numero: string; garantieJusquAu: string; observations: string } | null;

  messages: { id: string; corps: string; sortant: boolean; auteur: string; date: string }[];
}

/** Resout un jeton et charge le dossier. Enregistre le passage. */
export async function chargerDossier(jeton: string): Promise<DossierClient> {
  if (!jetonPlausible(jeton)) throw new NotFoundError();

  const supabase = createAdminClient();
  const hash = hacherJeton(jeton);

  const { data: acces } = await supabase
    .from('portal_tokens')
    .select('id, job_id, expires_at, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle();

  if (!acces || acces.revoked_at || new Date(acces.expires_at) < new Date()) {
    throw new NotFoundError();
  }

  const { data: job } = await supabase
    .from('jobs')
    .select(
      `id, reference, stage, service, property_type, soil, surface_m2, commune, code_postal, urgent,
       estimation_min, estimation_max, created_at,
       client:clients ( nom, email, consent_photos )`,
    )
    .eq('id', acces.job_id)
    .maybeSingle();

  if (!job) throw new NotFoundError();

  const client = Array.isArray(job.client) ? job.client[0] : job.client;
  if (!client) throw new NotFoundError();

  const [devisRes, interRes, photosRes, messagesRes, rapportRes, factureRes] =
    await Promise.all([
      supabase
        .from('quotes')
        .select(
          'id, numero, status, montant_htva, montant_ttc, vat_regime, valide_jusqu_au, pdf_path',
        )
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('interventions')
        .select('id, status, starts_at, ends_at')
        .eq('job_id', job.id)
        .neq('status', 'annule')
        .order('starts_at')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('photos')
        .select('id, thumb_path, storage_path, phase, legende')
        .eq('job_id', job.id)
        .order('created_at')
        .limit(24),
      supabase
        .from('messages')
        .select('id, corps, sortant, auteur_label, created_at')
        .eq('job_id', job.id)
        .in('channel', ['portail'])
        .order('created_at')
        .limit(50),
      supabase
        .from('reports')
        .select('numero, observations, garantie_jusqu_au, pdf_path, created_at')
        .eq('job_id', acces.job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('invoices')
        .select('numero, pdf_path, date_emission, status')
        .eq('job_id', acces.job_id)
        .eq('kind', 'facture')
        .neq('status', 'brouillon')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Passage enregistre : sert a savoir si le client a ouvert son dossier, et
  // a reperer un acces anormalement repetitif. L'increment se fait en SQL
  // pour ne pas ecraser un compteur concurrent.
  await supabase.rpc('touch_portal_token', { p_token_id: acces.id });

  const devis = devisRes.data;
  let urlPdf: string | null = null;
  if (devis?.pdf_path) {
    urlPdf = await urlSignee('documents', devis.pdf_path);
  }

  const photos = await Promise.all(
    (photosRes.data ?? []).map(async (p) => {
      const chemin = p.thumb_path ?? p.storage_path;
      return {
        id: p.id,
        url: await urlSignee('chantiers', chemin),
        phase: p.phase as string,
        legende: p.legende,
      };
    }),
  );

  // --- Documents ------------------------------------------------------------
  const documents: DossierClient['documents'] = [];

  if (devis?.pdf_path && urlPdf) {
    documents.push({ type: 'devis', numero: devis.numero, url: urlPdf, date: job.created_at });
  }

  const rapport = rapportRes.data;
  if (rapport?.pdf_path) {
    const url = await urlSignee('documents', rapport.pdf_path);
    if (url) {
      documents.push({
        type: 'rapport',
        numero: rapport.numero,
        url,
        date: rapport.created_at,
      });
    }
  }

  const facture = factureRes.data;
  if (facture?.pdf_path) {
    const url = await urlSignee('documents', facture.pdf_path);
    if (url) {
      documents.push({
        type: 'facture',
        numero: facture.numero,
        url,
        date: facture.date_emission ?? job.created_at,
      });
    }
  }

  const prenom = client.nom.split(' ')[0] ?? client.nom;

  return {
    jobId: job.id,
    reference: job.reference,
    stage: job.stage,
    service: job.service,
    propertyType: job.property_type,
    soil: job.soil,
    surface: job.surface_m2,
    commune: job.commune,
    codePostal: job.code_postal ?? null,
    urgent: job.urgent,
    creeLe: job.created_at,

    client: {
      prenom,
      nom: client.nom,
      email: client.email,
      consentPhotos: client.consent_photos,
    },

    estimation: { min: job.estimation_min, max: job.estimation_max },

    devis: devis
      ? {
          id: devis.id,
          numero: devis.numero,
          status: devis.status,
          montantHtva: Number(devis.montant_htva),
          montantTtc: Number(devis.montant_ttc),
          autoliquidation: devis.vat_regime === 'autoliquidation',
          valideJusquAu: devis.valide_jusqu_au,
          urlPdf,
        }
      : null,

    intervention: interRes.data
      ? {
          id: interRes.data.id,
          status: interRes.data.status,
          debut: interRes.data.starts_at,
          fin: interRes.data.ends_at,
        }
      : null,

    photos,
    documents,

    rapport: rapport
      ? {
          numero: rapport.numero,
          garantieJusquAu: rapport.garantie_jusqu_au,
          observations: rapport.observations,
        }
      : null,

    messages: (messagesRes.data ?? []).map((m) => ({
      id: m.id,
      corps: m.corps,
      sortant: m.sortant,
      auteur: m.auteur_label ?? (m.sortant ? 'SUITON' : 'Vous'),
      date: m.created_at,
    })),
  };
}

/** Resout un jeton en identifiant de chantier, sans charger le dossier. */
export async function jobDepuisJeton(
  jeton: string,
): Promise<{ jobId: string; tokenId: string }> {
  if (!jetonPlausible(jeton)) throw new NotFoundError();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('portal_tokens')
    .select('id, job_id, expires_at, revoked_at')
    .eq('token_hash', hacherJeton(jeton))
    .maybeSingle();

  if (!data || data.revoked_at || new Date(data.expires_at) < new Date()) {
    throw new NotFoundError();
  }
  return { jobId: data.job_id, tokenId: data.id };
}
