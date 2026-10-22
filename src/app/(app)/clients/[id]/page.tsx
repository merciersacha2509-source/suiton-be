import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge, ScoreBadge, StageBadge } from '@/components/ui/badge';
import { formatDate, formatRange } from '@/lib/format';
import { PanneauFiche } from './panneau-fiche';
import type { ClientKind, JobStage, ScoreBand } from '@/types/database';

interface ClientDetail {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string | null;
  commune: string | null;
  code_postal: string | null;
  kind: ClientKind;
  score: number;
  score_band: ScoreBand;
  no_contact: boolean;
  created_at: string;
}

interface LigneChantier {
  id: string;
  reference: string;
  stage: JobStage;
  commune: string;
  estimation_min: number | null;
  estimation_max: number | null;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('nom').eq('id', id).maybeSingle();
  return { title: data?.nom ?? 'Client' };
}

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability('clients.read');
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client, error }, { data: chantiers }] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, nom, email, telephone, adresse, commune, code_postal, kind, score, score_band, no_contact, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select('id, reference, stage, commune, estimation_min, estimation_max, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (error || !client) notFound();
  const fiche = client as unknown as ClientDetail;
  const lignes = (chantiers ?? []) as unknown as LigneChantier[];

  return (
    <>
      <PageHeader
        titre={fiche.nom}
        description={`Client depuis le ${formatDate(fiche.created_at)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader titre="Résumé" />
            <CardBody className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ardoise">Score</span>
                <ScoreBadge band={fiche.score_band} score={fiche.score} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ardoise">Type</span>
                <Badge ton={fiche.kind === 'professionnel' ? 'ocean' : 'neutre'}>
                  {fiche.kind === 'professionnel' ? 'Professionnel' : 'Particulier'}
                </Badge>
              </div>
              {fiche.no_contact ? (
                <div className="flex items-center justify-between">
                  <span className="text-ardoise">Statut</span>
                  <Badge ton="danger">Ne pas contacter</Badge>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <PanneauFiche
            clientId={fiche.id}
            nom={fiche.nom}
            email={fiche.email}
            telephone={fiche.telephone}
            adresse={fiche.adresse}
            commune={fiche.commune}
            codePostal={fiche.code_postal}
          />
        </div>

        <Card>
          <CardHeader titre="Chantiers" description={`${lignes.length} au total`} />
          {lignes.length === 0 ? (
            <CardBody>
              <EmptyState titre="Aucun chantier" description="Rien encore pour ce client." />
            </CardBody>
          ) : (
            <CardBody className="px-0 py-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Référence</Th>
                    <Th>Commune</Th>
                    <Th className="text-right">Estimation</Th>
                    <Th>Étape</Th>
                    <Th>Reçu</Th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((c) => (
                    <tr key={c.id} className="hover:bg-mineral">
                      <Td>
                        <Link
                          href={`/chantiers/${c.id}`}
                          className="text-ocean font-medium underline-offset-2 hover:underline"
                        >
                          {c.reference}
                        </Link>
                      </Td>
                      <Td>{c.commune}</Td>
                      <Td className="tabular text-right">
                        {c.estimation_min !== null && c.estimation_max !== null
                          ? formatRange(Number(c.estimation_min), Number(c.estimation_max))
                          : '—'}
                      </Td>
                      <Td>
                        <StageBadge stage={c.stage} />
                      </Td>
                      <Td className="text-ardoise whitespace-nowrap">{formatDate(c.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
