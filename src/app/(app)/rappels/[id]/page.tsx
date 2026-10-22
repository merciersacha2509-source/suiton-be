import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { urlsPhotosParId } from '@/lib/storage';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, RappelStageBadge, RAPPEL_SOURCE_LABELS } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { PanneauEtapeRappel } from './panneau-etape';
import type { RappelSource, RappelStage } from '@/types/database';

interface RappelDetail {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  message: string | null;
  source: RappelSource;
  stage: RappelStage;
  perdu_motif: string | null;
  photos: string[];
  ip: string | null;
  created_at: string;
  client_id: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Demande ${id.slice(0, 8)}` };
}

export const dynamic = 'force-dynamic';

export default async function RappelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability('rappels.read');
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('rappels')
    .select(
      'id, nom, telephone, email, adresse, message, source, stage, perdu_motif, photos, ip, created_at, client_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) notFound();
  const rappel = data as unknown as RappelDetail;

  const urlsPhotos = await urlsPhotosParId(rappel.photos);

  return (
    <>
      <PageHeader
        titre={rappel.nom}
        description={`${RAPPEL_SOURCE_LABELS[rappel.source] ?? rappel.source} · reçu le ${formatDateTime(rappel.created_at)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader titre="Contact" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-ardoise text-xs">Téléphone</p>
                <a href={`tel:${rappel.telephone}`} className="tabular text-ocean underline-offset-2 hover:underline">
                  {rappel.telephone}
                </a>
              </div>
              <div>
                <p className="text-ardoise text-xs">E-mail</p>
                {rappel.email ? (
                  <a
                    href={`mailto:${rappel.email}`}
                    className="text-ocean underline-offset-2 hover:underline"
                  >
                    {rappel.email}
                  </a>
                ) : (
                  <p>—</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-ardoise text-xs">Adresse</p>
                <p>{rappel.adresse || '—'}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titre="Message" />
            <CardBody>
              <p className="whitespace-pre-wrap">{rappel.message || 'Aucun message.'}</p>
            </CardBody>
          </Card>

          {urlsPhotos.length > 0 ? (
            <Card>
              <CardHeader titre={`${urlsPhotos.length} photo${urlsPhotos.length > 1 ? 's' : ''}`} />
              <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {urlsPhotos.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                    <img
                      src={u}
                      alt={`Photo ${i + 1}`}
                      className="rounded-suiton border-mineral-dark aspect-square border object-cover"
                    />
                  </a>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {rappel.stage === 'perdu' && rappel.perdu_motif ? (
            <Card>
              <CardHeader titre="Motif de perte" />
              <CardBody>
                <p className="whitespace-pre-wrap">{rappel.perdu_motif}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader titre="Résumé" />
            <CardBody className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ardoise">Étape</span>
                <RappelStageBadge stage={rappel.stage} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ardoise">Origine</span>
                <Badge ton="neutre">{RAPPEL_SOURCE_LABELS[rappel.source] ?? rappel.source}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ardoise">Fiche client</span>
                {rappel.client_id ? (
                  <Link
                    href={`/clients/${rappel.client_id}`}
                    className="text-ocean font-medium underline-offset-2 hover:underline"
                  >
                    Voir la fiche
                  </Link>
                ) : (
                  <span className="text-ardoise text-[0.8125rem]">
                    {rappel.email ? '—' : 'Aucun e-mail fourni'}
                  </span>
                )}
              </div>
            </CardBody>
          </Card>

          <PanneauEtapeRappel rappelId={rappel.id} stage={rappel.stage} />
        </div>
      </div>
    </>
  );
}
