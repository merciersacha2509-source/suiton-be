import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge, ScoreBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import type { ClientKind, ScoreBand } from '@/types/database';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

interface LigneClient {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  kind: ClientKind;
  commune: string | null;
  score: number;
  score_band: ScoreBand;
  consent_photos: boolean;
  no_contact: boolean;
  created_at: string;
  jobs: { count: number }[];
}

export default async function ClientsPage() {
  await requireCapability('clients.read');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clients')
    .select(
      `id, nom, email, telephone, kind, commune, score, score_band, consent_photos,
       no_contact, created_at, jobs(count)`,
    )
    .order('score', { ascending: false })
    .limit(200);

  const clients = (data ?? []) as unknown as LigneClient[];

  return (
    <>
      <PageHeader
        titre="Clients"
        description={`${clients.length} fiche${clients.length > 1 ? 's' : ''} · classées par score`}
      />

      <Card>
        {error ? (
          <CardBody>
            <p className="text-danger text-sm">Lecture impossible.</p>
          </CardBody>
        ) : clients.length === 0 ? (
          <EmptyState
            titre="Aucun client"
            description="Les fiches se créent automatiquement à la première demande."
          />
        ) : (
          <CardBody className="px-0 py-0">
            <Table>
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Contact</Th>
                  <Th>Commune</Th>
                  <Th className="text-right">Chantiers</Th>
                  <Th>Score</Th>
                  <Th>Depuis</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-mineral">
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.nom}</span>
                        {c.kind === 'professionnel' ? <Badge ton="ocean">Pro</Badge> : null}
                        {c.no_contact ? <Badge ton="danger">Ne pas contacter</Badge> : null}
                      </span>
                    </Td>
                    <Td>
                      <a
                        href={`tel:${c.telephone.replace(/\s/g, '')}`}
                        className="text-ocean block underline-offset-2 hover:underline"
                      >
                        {c.telephone}
                      </a>
                      <a
                        href={`mailto:${c.email}`}
                        className="text-ardoise block truncate text-[0.75rem]"
                      >
                        {c.email}
                      </a>
                    </Td>
                    <Td>{c.commune ?? '—'}</Td>
                    <Td className="tabular text-right">{c.jobs?.[0]?.count ?? 0}</Td>
                    <Td>
                      <ScoreBadge band={c.score_band} score={c.score} />
                    </Td>
                    <Td className="text-ardoise whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>

      <p className="text-ardoise mt-3 text-[0.75rem]">
        Le score est un outil de priorisation interne. Il n&apos;est jamais visible du client et
        ne modifie aucun prix.
      </p>

      <p className="text-ardoise mt-1 text-[0.75rem]">
        La fiche client détaillée arrive au Sprint 3.{' '}
        <Link href="/chantiers" className="text-ocean underline-offset-2 hover:underline">
          Voir les chantiers
        </Link>
      </p>
    </>
  );
}
