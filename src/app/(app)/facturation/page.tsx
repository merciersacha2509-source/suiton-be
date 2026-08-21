import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { urlSignee } from '@/lib/storage';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { BoutonEnvoyer, BoutonFacturer, BoutonPayee } from './panneaux';
import { formatDate, formatEUR } from '@/lib/format';
import type { ClientKind, InvoiceStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Facturation' };
export const dynamic = 'force-dynamic';

interface AFacturer {
  id: string;
  reference: string;
  commune: string;
  duree_reelle_min: number | null;
  client: { nom: string; kind: ClientKind; tva: string | null } | null;
}

interface LigneFacture {
  id: string;
  numero: string;
  status: InvoiceStatus;
  montant_ttc: number;
  date_emission: string | null;
  date_echeance: string | null;
  communication: string | null;
  pdf_path: string | null;
  sent_at: string | null;
  vat_regime: string;
  job: { id: string; reference: string } | null;
  client: { nom: string } | null;
}

const TONS: Record<InvoiceStatus, 'neutre' | 'ocean' | 'succes' | 'danger'> = {
  brouillon: 'neutre',
  emise: 'ocean',
  payee: 'succes',
  annulee: 'danger',
};

export default async function FacturationPage() {
  await requireCapability('invoices.read');
  const supabase = await createClient();

  const [aFacturerRes, facturesRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, reference, commune, duree_reelle_min, client:clients ( nom, kind, tva )')
      .eq('stage', 'termine')
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('invoices')
      .select(
        `id, numero, status, montant_ttc, date_emission, date_echeance, communication,
         pdf_path, sent_at, vat_regime,
         job:jobs ( id, reference ), client:clients ( nom )`,
      )
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const factures = (facturesRes.data ?? []) as unknown as LigneFacture[];
  const dejaFacture = new Set(factures.map((f) => f.job?.id).filter(Boolean));
  const aFacturer = ((aFacturerRes.data ?? []) as unknown as AFacturer[]).filter(
    (j) => !dejaFacture.has(j.id),
  );

  const liens = new Map<string, string>();
  await Promise.all(
    factures
      .filter((f) => f.pdf_path)
      .map(async (f) => {
        const url = await urlSignee('documents', f.pdf_path as string);
        if (url) liens.set(f.id, url);
      }),
  );

  const aujourdHui = new Date();
  const impayees = factures.filter((f) => f.status === 'emise');
  const enRetard = impayees.filter(
    (f) => f.date_echeance && new Date(f.date_echeance) < aujourdHui,
  );
  const encaisse = factures
    .filter((f) => f.status === 'payee')
    .reduce((s, f) => s + Number(f.montant_ttc), 0);
  const enAttente = impayees.reduce((s, f) => s + Number(f.montant_ttc), 0);

  return (
    <>
      <PageHeader titre="Facturation" description="Ce qui reste à encaisser." />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          libelle="À facturer"
          valeur={String(aFacturer.length)}
          detail="chantiers terminés"
        />
        <StatCard
          libelle="En attente"
          valeur={formatEUR(enAttente)}
          detail={`${impayees.length} factures`}
        />
        <StatCard
          libelle="En retard"
          valeur={String(enRetard.length)}
          detail={enRetard.length > 0 ? 'à relancer' : 'aucune'}
        />
        <StatCard libelle="Encaissé" valeur={formatEUR(encaisse)} detail="cumul" accent />
      </section>

      <Alert ton="alerte" titre="Facturation professionnelle — Peppol" className="mb-5">
        Depuis le 1<sup>er</sup> janvier 2026, une facture B2B belge doit être transmise au
        format structuré via Peppol. SUITON OS ne le fait pas encore : pour un client
        professionnel, il produit un <strong>brouillon PDF</strong> à reprendre dans votre outil
        comptable. Pour un particulier, le PDF <em>est</em> la facture, et tout se fait ici.
      </Alert>

      {aFacturer.length > 0 ? (
        <Card className="mb-5">
          <CardHeader titre="À facturer" description="Chantiers terminés, sans facture" />
          <CardBody className="px-0 py-0">
            <Table>
              <thead>
                <tr>
                  <Th>Chantier</Th>
                  <Th>Client</Th>
                  <Th>Commune</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {aFacturer.map((j) => {
                  const pro = j.client?.kind === 'professionnel';
                  return (
                    <tr key={j.id}>
                      <Td>
                        <Link
                          href={`/chantiers/${j.id}`}
                          className="tabular text-ocean font-medium underline-offset-2 hover:underline"
                        >
                          {j.reference}
                        </Link>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          {j.client?.nom}
                          {pro ? <Badge ton="ocean">Pro</Badge> : null}
                        </span>
                      </Td>
                      <Td>{j.commune}</Td>
                      <Td className="text-right">
                        <span className="inline-flex justify-end">
                          <BoutonFacturer jobId={j.id} estPro={pro} />
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader titre="Factures" />
        {factures.length === 0 ? (
          <EmptyState
            titre="Aucune facture"
            description="Les factures apparaîtront ici dès qu'un chantier terminé sera facturé."
          />
        ) : (
          <CardBody className="px-0 py-0">
            <Table>
              <thead>
                <tr>
                  <Th>Numéro</Th>
                  <Th>Client</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Échéance</Th>
                  <Th>État</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {factures.map((f) => {
                  const retard =
                    f.status === 'emise' &&
                    f.date_echeance &&
                    new Date(f.date_echeance) < aujourdHui;
                  const url = liens.get(f.id);

                  return (
                    <tr key={f.id} className={retard ? 'bg-danger-wash' : undefined}>
                      <Td>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tabular text-ocean font-medium underline-offset-2 hover:underline"
                          >
                            {f.numero}
                          </a>
                        ) : (
                          <span className="tabular font-medium">{f.numero}</span>
                        )}
                        {f.communication ? (
                          <span className="tabular text-ardoise block text-[0.6875rem]">
                            {f.communication}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="truncate">{f.client?.nom}</Td>
                      <Td className="tabular text-right">{formatEUR(Number(f.montant_ttc))}</Td>
                      <Td className="whitespace-nowrap">
                        {f.date_echeance ? formatDate(f.date_echeance) : '—'}
                        {retard ? (
                          <span className="text-danger block text-[0.6875rem] font-medium">
                            en retard
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="flex flex-col gap-1">
                          <Badge ton={TONS[f.status]}>{f.status}</Badge>
                          {f.vat_regime === 'autoliquidation' ? (
                            <span className="text-ardoise text-[0.6875rem]">autoliq.</span>
                          ) : null}
                        </span>
                      </Td>
                      <Td>
                        <span className="flex justify-end gap-2">
                          {f.status === 'emise' && !f.sent_at ? (
                            <BoutonEnvoyer invoiceId={f.id} />
                          ) : null}
                          {f.status === 'emise' ? <BoutonPayee invoiceId={f.id} /> : null}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>
    </>
  );
}
