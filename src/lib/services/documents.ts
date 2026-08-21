import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { televerser, urlSignee } from '@/lib/storage';
import { DOCUMENTS, type TypeDocument } from '@/lib/pdf/tokens';
import { NotFoundError } from '@/lib/errors';

/**
 * Registre documentaire.
 *
 * Point de passage UNIQUE de tout PDF produit par SUITON OS. Aucun document
 * n'est ecrit dans le stockage sans passer par ici, ce qui garantit trois
 * choses :
 *
 *   1. l'inscription au registre — donc la trace de ce qui a ete produit ;
 *   2. le versionnement — regenerer cree une version 2, jamais un ecrasement ;
 *   3. l'empreinte — deux generations identiques se detectent.
 *
 * Le chemin de stockage contient la version : les anciennes versions restent
 * accessibles, ce qui est la seule facon de repondre a « ce n'est pas ce
 * devis que j'ai recu ».
 */

export interface DocumentEnregistre {
  id: string;
  type: TypeDocument;
  numero: string;
  version: number;
  storagePath: string;
  hash: string;
  octets: number;
  /** true si un document identique existait deja : rien n'a ete reecrit. */
  inchange: boolean;
}

export interface EntreeDocument {
  jobId: string;
  type: TypeDocument;
  numero: string;
  pdf: Buffer;
  /** Donnees de generation, pour pouvoir rejouer le document a l'identique. */
  snapshot?: Record<string, unknown>;
  entityId?: string | null;
  createdBy?: string | null;
}

function cheminDocument(type: TypeDocument, numero: string, version: number): string {
  const annee = new Date().getUTCFullYear();
  const suffixe = version > 1 ? `-v${version}` : '';
  return `${type}/${annee}/${numero}${suffixe}.pdf`;
}

/** Nombre de pages, lu dans le PDF lui-meme. */
function compterPages(pdf: Buffer): number {
  const matches = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

export async function enregistrerDocument(entree: EntreeDocument): Promise<DocumentEnregistre> {
  const supabase = createAdminClient();
  const hash = createHash('sha256').update(entree.pdf).digest('hex');

  // Un document identique existe deja ? On ne cree pas de version pour rien.
  // C'est ce qui evite qu'un double clic sur « Générer » produise une v2, une
  // v3, une v4 — et rende l'historique illisible.
  const { data: identique } = await supabase
    .from('documents')
    .select('id, numero, version, storage_path, octets')
    .eq('job_id', entree.jobId)
    .eq('type', entree.type)
    .eq('hash', hash)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (identique) {
    return {
      id: identique.id,
      type: entree.type,
      numero: identique.numero,
      version: identique.version,
      storagePath: identique.storage_path,
      hash,
      octets: identique.octets ?? entree.pdf.byteLength,
      inchange: true,
    };
  }

  const { data: versionData } = await supabase.rpc('prochaine_version_document', {
    p_job_id: entree.jobId,
    p_type: entree.type,
    p_numero: entree.numero,
  });

  const version = typeof versionData === 'number' ? versionData : 1;
  const chemin = cheminDocument(entree.type, entree.numero, version);

  const archivage = await televerser('documents', chemin, entree.pdf, 'application/pdf');
  if (!archivage.ok) {
    throw new Error(`Archivage impossible : ${archivage.erreur}`);
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      job_id: entree.jobId,
      type: entree.type,
      destinataire: DOCUMENTS[entree.type].destinataire,
      numero: entree.numero,
      version,
      storage_path: chemin,
      octets: entree.pdf.byteLength,
      pages: compterPages(entree.pdf),
      hash,
      snapshot: entree.snapshot ?? {},
      entity_id: entree.entityId ?? null,
      created_by: entree.createdBy ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Inscription au registre impossible : ${error?.message ?? 'inconnu'}`);
  }

  await supabase.from('events').insert({
    job_id: entree.jobId,
    type: 'document.created',
    payload: { document: entree.type, numero: entree.numero, version },
  });

  return {
    id: data.id,
    type: entree.type,
    numero: entree.numero,
    version,
    storagePath: chemin,
    hash,
    octets: entree.pdf.byteLength,
    inchange: false,
  };
}

/** Marque un document comme transmis. Sert au portail et aux relances. */
export async function marquerEnvoye(documentId: string, destinataire: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('documents')
    .update({ sent_at: new Date().toISOString(), sent_to: destinataire })
    .eq('id', documentId);
}

/** Dernière version d'un type de document pour un chantier. */
export async function dernierDocument(
  jobId: string,
  type: TypeDocument,
): Promise<{ id: string; numero: string; version: number; storagePath: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('documents')
    .select('id, numero, version, storage_path')
    .eq('job_id', jobId)
    .eq('type', type)
    .is('superseded_by', null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    numero: data.numero,
    version: data.version,
    storagePath: data.storage_path,
  };
}

export async function urlDocument(storagePath: string, secondes = 900): Promise<string | null> {
  return urlSignee('documents', storagePath, secondes);
}

/**
 * Archive un chantier.
 *
 * L'archive est un instantane DENORMALISE : une archive qui depend de six
 * jointures n'est plus une archive. Elle survit a la suppression du client
 * (droit a l'effacement), qui anonymise mais ne peut pas supprimer les
 * pieces comptables — obligation de conservation de dix ans.
 */
export async function archiverChantier(
  jobId: string,
  parProfileId: string | null,
): Promise<{ documents: number; montantTtc: number | null }> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('jobs')
    .select(
      `id, reference, stage, service, property_type, soil, surface_m2, adresse, code_postal,
       commune, zone, urgent, estimation_min, estimation_max, duree_estimee_min,
       duree_reelle_min, created_at,
       client:clients ( nom, email, telephone, kind, tva, commune ),
       partner:partners ( denomination, tva )`,
    )
    .eq('id', jobId)
    .maybeSingle();

  if (!job) throw new NotFoundError('Chantier introuvable.');

  const [{ data: documents }, { data: evenements }, { data: factures }, { data: rapports }] =
    await Promise.all([
      supabase
        .from('documents')
        .select('type, numero, version, storage_path, hash, sent_at, created_at')
        .eq('job_id', jobId)
        .order('created_at'),
      supabase
        .from('events')
        .select('type, payload, created_at')
        .eq('job_id', jobId)
        .order('created_at'),
      supabase
        .from('invoices')
        .select('numero, montant_htva, tva_montant, montant_ttc, vat_regime, status, paid_at')
        .eq('job_id', jobId),
      supabase
        .from('reports')
        .select('numero, observations, duree_reelle_min, validated_at')
        .eq('job_id', jobId),
    ]);

  const montantTtc = (factures ?? []).reduce((s, f) => s + Number(f.montant_ttc ?? 0), 0);

  const contenu = {
    archive_version: 1,
    archive_le: new Date().toISOString(),
    chantier: job,
    documents: documents ?? [],
    factures: factures ?? [],
    rapports: rapports ?? [],
    chronologie: evenements ?? [],
  };

  const { error } = await supabase.from('job_archives').upsert(
    {
      job_id: jobId,
      reference: job.reference,
      archive_par: parProfileId,
      contenu,
      documents_count: (documents ?? []).length,
      montant_ttc: montantTtc || null,
    },
    { onConflict: 'job_id' },
  );

  if (error) throw new Error(`Archivage impossible : ${error.message}`);

  await supabase.from('events').insert({
    job_id: jobId,
    type: 'job.archived',
    payload: { documents: (documents ?? []).length, montant_ttc: montantTtc },
  });

  return { documents: (documents ?? []).length, montantTtc: montantTtc || null };
}
