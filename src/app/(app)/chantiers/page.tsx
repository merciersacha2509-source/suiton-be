import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { ScoreBadge, StageBadge, Badge, STAGE_LABELS } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatRange } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { JobStage, ScoreBand } from '@/types/database';

export const metadata: Metadata = { title: 'Chantiers' };
export const dynamic = 'force-dynamic';

/** Filtres de la barre : ce qu'on regarde vraiment plusieurs fois par jour. */
const FILTRES = [
  {
    cle: 'a_traiter',
    libelle: 'À traiter',
    stages: ['nouveau', 'contacte', 'qualifie', 'devis_a_produire'],
  },
  {
    cle: 'en_attente',
    libelle: 'En attente',
    stages: ['devis_envoye', 'relance', 'negociation'],
  },
  { cle: 'gagnes', libelle: 'Gagnés', stages: ['gagne', 'planifie'] },
  { cle: 'termines', libelle: 'Terminés', stages: ['termine'] },
  { cle: 'tous', libelle: 'Tous', stages: [] },
] as const;

interface LigneChantier {
  id: string;
  reference: string;
  stage: JobStage;
  commune: string;
  surface_m2: number;
  urgent: boolean;
  estimation_min: number | null;
  estimation_max: number | null;
  created_at: string;
  client: { nom: string; score: number; score_band: ScoreBand } | null;
}

export default async function ChantiersPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  await requireCapability('jobs.read');
  const { f } = await searchParams;

  const filtre = FILTRES.find((x) => x.cle === f) ?? FILTRES[0];
  const supabase = await createClient();

  let requete = supabase
    .from('jobs')
    .select(
      `id, reference, stage, commune, surface_m2, urgent, estimation_min, estimation_max, created_at,
       client:clients ( nom, score, score_band )`,
    )
    .order('urgent', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (filtre.stages.length > 0) {
    requete = requete.in('stage', filtre.stages);
  }

  const { data, error } = await requete;
  const chantiers = (data ?? []) as unknown as LigneChantier[];

  return (
    <>
      <PageHeader
        titre="Chantiers"
        description={`${chantiers.length} chantier${chantiers.length > 1 ? 's' : ''} · ${filtre.libelle.toLowerCase()}`}
      />

      <nav aria-label="Filtres" className="mb-4 flex flex-wrap gap-1.5">
        {FILTRES.map((x) => (
          <Link
            key={x.cle}
            href={`/chantiers?f=${x.cle}`}
            className={cn(
              'flex h-9 items-center rounded-full border px-3.5 text-[0.8125rem] transition-colors',
              x.cle === filtre.cle
                ? 'border-abysse bg-abysse text-mineral'
                : 'border-mineral-dark hover:border-ardoise-clair bg-white',
            )}
          >
            {x.libelle}
          </Link>
        ))}
      </nav>

      <Card>
        {error ? (
          <CardBody>
            <p className="text-danger text-sm">
              Lecture impossible. Vérifiez que les migrations sont appliquées.
            </p>
          </CardBody>
        ) : chantiers.length === 0 ? (
          <EmptyState
            titre="Aucun chantier ici"
            description={
              filtre.cle === 'a_traiter'
                ? 'Rien en attente. Les nouvelles demandes arriveront par le formulaire public.'
                : 'Changez de filtre, ou attendez les prochaines demandes.'
            }
            action={
              <Link href="/reservation" target="_blank">
                <Button variant="secondaire">Ouvrir le formulaire public</Button>
              </Link>
            }
          />
        ) : (
          <CardBody className="px-0 py-0">
            <Table>
              <thead>
                <tr>
                  <Th>Référence</Th>
                  <Th>Client</Th>
                  <Th>Commune</Th>
                  <Th className="text-right">Estimation</Th>
                  <Th>Étape</Th>
                  <Th>Reçu</Th>
                </tr>
              </thead>
              <tbody>
                {chantiers.map((c) => (
                  <tr key={c.id} className="hover:bg-mineral">
                    <Td>
                      <Link
                        href={`/chantiers/${c.id}`}
                        className="tabular text-ocean font-medium underline-offset-2 hover:underline"
                      >
                        {c.reference}
                      </Link>
                      {c.urgent ? (
                        <Badge ton="alerte" className="ml-2">
                          Urgent
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{c.client?.nom ?? '—'}</span>
                        {c.client ? (
                          <ScoreBadge band={c.client.score_band} score={c.client.score} />
                        ) : null}
                      </span>
                    </Td>
                    <Td>
                      {c.commune}
                      <span className="tabular text-ardoise ml-1.5">{c.surface_m2} m²</span>
                    </Td>
                    <Td className="tabular text-right">
                      {c.estimation_min !== null && c.estimation_max !== null
                        ? formatRange(Number(c.estimation_min), Number(c.estimation_max))
                        : '—'}
                    </Td>
                    <Td>
                      <StageBadge stage={c.stage} />
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
        Étapes disponibles : {Object.values(STAGE_LABELS).join(' · ')}
      </p>
    </>
  );
}
