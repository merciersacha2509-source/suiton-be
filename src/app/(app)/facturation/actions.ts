'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { produireFacture, urlSigneeFacture } from '@/lib/services/invoices';
import { surFacturePayee } from '@/lib/services/pipeline';
import { emailFacture } from '@/lib/emails';
import { telecharger } from '@/lib/storage';
import { publicEnv } from '@/lib/env';
import { formatDate, formatEUR } from '@/lib/format';
import { AppError } from '@/lib/errors';

export interface FactureState {
  ok?: boolean;
  message?: string;
  error?: string;
  pdfUrl?: string;
}

export async function genererFactureAction(
  _prev: FactureState,
  formData: FormData,
): Promise<FactureState> {
  await requireCapability('invoices.issue');

  const jobId = String(formData.get('jobId') ?? '');
  const brouillon = formData.get('brouillon') === 'true';
  if (!z.string().uuid().safeParse(jobId).success) return { error: 'Chantier invalide.' };

  try {
    const facture = await produireFacture({ jobId, brouillonSeulement: brouillon });
    revalidatePath('/facturation');
    revalidatePath(`/chantiers/${jobId}`);

    return {
      ok: true,
      message: brouillon
        ? `Brouillon ${facture.numero} produit. À reprendre dans votre outil comptable pour l'envoi Peppol.`
        : `Facture ${facture.numero} émise — ${formatEUR(facture.montantTtc)}.`,
      pdfUrl: (await urlSigneeFacture(facture.pdfPath)) ?? undefined,
    };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error('[facturation]', e);
    return { error: 'La génération a échoué. Consultez les journaux.' };
  }
}

/* -------------------------------------------------------------------------- */

export async function envoyerFactureAction(
  _prev: FactureState,
  formData: FormData,
): Promise<FactureState> {
  await requireCapability('invoices.issue');

  const invoiceId = String(formData.get('invoiceId') ?? '');
  if (!z.string().uuid().safeParse(invoiceId).success) return { error: 'Facture invalide.' };

  const supabase = await createClient();

  const { data: facture } = await supabase
    .from('invoices')
    .select(
      `id, numero, status, montant_ttc, date_echeance, communication, pdf_path, vat_regime,
       client:clients ( nom, email )`,
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (!facture) return { error: 'Facture introuvable.' };
  if (facture.status === 'brouillon') {
    return {
      error:
        'Cette facture est un brouillon B2B : elle doit partir par Peppol depuis votre outil comptable.',
    };
  }

  const client = Array.isArray(facture.client) ? facture.client[0] : facture.client;
  if (!client?.email) return { error: 'Ce client n’a pas d’adresse e-mail.' };
  if (!facture.pdf_path) return { error: 'Le PDF de cette facture est introuvable.' };

  const [pdf, { data: settings }] = await Promise.all([
    telecharger('documents', facture.pdf_path),
    supabase.from('settings').select('banque').maybeSingle<{ banque: { iban: string } }>(),
  ]);

  const envoi = await emailFacture({
    email: client.email,
    nom: client.nom,
    numero: facture.numero,
    montant: formatEUR(Number(facture.montant_ttc)),
    echeance: formatDate(facture.date_echeance),
    communication: facture.communication ?? '',
    iban: settings?.banque?.iban ?? '',
    autoliquidation: facture.vat_regime === 'autoliquidation',
    urlPortail: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portail`,
    pdf: pdf ?? undefined,
  });

  if (!envoi.envoye) return { error: `L'e-mail n'est pas parti : ${envoi.erreur}` };

  await supabase
    .from('invoices')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', invoiceId);

  revalidatePath('/facturation');
  return { ok: true, message: `Facture ${facture.numero} envoyée à ${client.email}.` };
}

/* -------------------------------------------------------------------------- */

export async function marquerPayeeAction(
  _prev: FactureState,
  formData: FormData,
): Promise<FactureState> {
  const session = await requireCapability('invoices.issue');

  const invoiceId = String(formData.get('invoiceId') ?? '');
  if (!z.string().uuid().safeParse(invoiceId).success) return { error: 'Facture invalide.' };

  const supabase = await createClient();
  const { data: facture, error } = await supabase
    .from('invoices')
    .update({ status: 'payee', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('status', 'emise')
    .select('job_id')
    .maybeSingle();

  if (error) return { error: "L'enregistrement a échoué." };

  // Fin de chaine : le chantier est archive. L'archive est un instantane
  // denormalise qui survit a l'anonymisation du client.
  let archive = '';
  if (facture?.job_id) {
    const suite = await surFacturePayee(facture.job_id, session.userId);
    const nb = suite.produits.find((p) => p.type === 'archive')?.numero;
    archive = nb ? ` Chantier archivé (${nb}).` : '';
    if (suite.erreurs.length > 0) {
      console.warn('[facturation] archivage', suite.erreurs.join(' · '));
    }
  }

  revalidatePath('/facturation');
  return { ok: true, message: `Facture marquée payée.${archive}` };
}
