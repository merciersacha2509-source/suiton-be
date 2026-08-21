import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { urlSignee } from '@/lib/storage';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Checklist } from './checklist';
import { PhotosTerrain, type PhotoTerrain } from './photos-terrain';
import { PanneauStatut, PanneauValidation } from './panneau-statut';
import { formatSurface } from '@/lib/format';
import { LIBELLES_BIEN, LIBELLES_SALISSURE, LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { estimateDuration } from '@/lib/pricing';
import type { ChecklistStep, VueTerrain } from '@/types/database';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chantier' };

const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

export default async function ChantierTerrainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability('terrain.execute');
  const { id } = await params;
  const supabase = await createClient();

  const { data: vue } = await supabase
    .from('vue_terrain')
    .select('*')
    .eq('intervention_id', id)
    .maybeSingle<VueTerrain>();

  if (!vue) notFound();

  const [{ data: etapes }, { data: progression }, { data: photosBrutes }, { data: rapport }] =
    await Promise.all([
      supabase.from('checklist_steps').select('*').eq('actif', true).order('ordre'),
      supabase.from('checklist_progress').select('ordre, fait_at').eq('intervention_id', id),
      supabase
        .from('photos')
        .select('id, phase, piece, paire, thumb_path, storage_path')
        .eq('job_id', vue.job_id)
        .order('paire'),
      supabase.from('reports').select('id, numero').eq('intervention_id', id).maybeSingle(),
    ]);

  const photos: PhotoTerrain[] = await Promise.all(
    (photosBrutes ?? []).map(async (p) => ({
      id: p.id,
      phase: p.phase as string,
      piece: p.piece as string,
      paire: p.paire,
      url: await urlSignee('chantiers', p.thumb_path ?? p.storage_path, 3600),
    })),
  );

  const faites = new Map((progression ?? []).map((p) => [p.ordre, p.fait_at as string]));
  const liste = (etapes ?? []) as ChecklistStep[];
  const complete = liste.length > 0 && liste.every((e) => faites.has(e.ordre));

  const pairesCompletes = (() => {
    const m = new Map<number, Set<string>>();
    for (const p of photos) {
      if (p.paire === null) continue;
      const s = m.get(p.paire) ?? new Set<string>();
      s.add(p.phase);
      m.set(p.paire, s);
    }
    return Array.from(m.values()).filter((s) => s.has('avant') && s.has('apres')).length;
  })();

  const duree = estimateDuration({ surface_m2: vue.surface_m2, soil: vue.soil });
  const verrouille = Boolean(rapport);
  const demarre = vue.status === 'sur_place' || vue.status === 'termine';

  return (
    <>
      <PageHeader
        titre={vue.client_nom}
        description={`${vue.reference} · ${LIBELLES_SERVICE[vue.service]}`}
        action={<Badge ton={demarre ? 'preuve' : 'ocean'}>{vue.status}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader titre="Le chantier" />
            <CardBody className="flex flex-col gap-3">
              <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-ardoise">Arrivée prévue</span> ·{' '}
                  <span className="tabular font-medium">
                    {HEURE.format(new Date(vue.starts_at))}
                  </span>
                </p>
                <p>
                  <span className="text-ardoise">Durée estimée</span> ·{' '}
                  {Math.round(duree.min / 60)}–{Math.round(duree.max / 60)} h
                </p>
                <p>
                  <span className="text-ardoise">Bien</span> ·{' '}
                  {LIBELLES_BIEN[vue.property_type]} {formatSurface(vue.surface_m2)}
                </p>
                <p>
                  <span className="text-ardoise">Salissure</span> ·{' '}
                  {LIBELLES_SALISSURE[vue.soil]}
                </p>
              </div>

              <p className="text-sm">
                <span className="text-ardoise">Adresse</span>
                <br />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    [vue.adresse, vue.code_postal, vue.commune].filter(Boolean).join(' '),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean font-medium underline underline-offset-2"
                >
                  {[vue.adresse, `${vue.code_postal ?? ''} ${vue.commune}`.trim()]
                    .filter(Boolean)
                    .join(', ')}
                </a>
              </p>

              <a href={`tel:${vue.client_telephone.replace(/\s/g, '')}`}>
                <span className="h-touch rounded-suiton border-mineral-dark flex w-full items-center justify-center border text-sm font-medium">
                  Appeler {vue.client_nom.split(' ')[0]} — {vue.client_telephone}
                </span>
              </a>

              {vue.acces_notes ? (
                <Alert ton="alerte" titre="Accès">
                  {vue.acces_notes}
                </Alert>
              ) : null}

              {vue.notes ? (
                <div className="rounded-suiton bg-mineral p-3 text-sm">
                  <p className="text-ardoise mb-1 text-[0.75rem] font-medium">
                    Précisions du client
                  </p>
                  <p className="whitespace-pre-wrap">{vue.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              titre="Procédure"
              description="Cochez au fur et à mesure — l'heure est enregistrée"
            />
            <CardBody>
              <Checklist
                interventionId={id}
                etapes={liste}
                faites={faites}
                verrouille={verrouille || !demarre}
              />
              {!demarre ? (
                <p className="text-ardoise mt-3 text-[0.8125rem]">
                  La checklist s&apos;active à votre arrivée sur place.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              titre="Photos"
              description={`${pairesCompletes} comparaison${pairesCompletes > 1 ? 's' : ''} complète${pairesCompletes > 1 ? 's' : ''}`}
            />
            <CardBody>
              <PhotosTerrain
                interventionId={id}
                jobId={vue.job_id}
                photos={photos}
                verrouille={verrouille}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader titre="Avancement" />
            <CardBody>
              <PanneauStatut interventionId={id} statut={vue.status} />
              {vue.sur_place_at ? (
                <p className="tabular text-ardoise mt-2 text-[0.8125rem]">
                  Arrivé à {HEURE.format(new Date(vue.sur_place_at))}
                </p>
              ) : null}
            </CardBody>
          </Card>

          {demarre ? (
            <Card>
              <CardHeader titre="Clôture" description="Produit et envoie le rapport" />
              <CardBody>
                <PanneauValidation
                  interventionId={id}
                  checklistComplete={complete}
                  pairesCompletes={pairesCompletes}
                  dejaValide={verrouille}
                />
              </CardBody>
            </Card>
          ) : null}

          <Link
            href="/terrain"
            className="text-ocean text-[0.8125rem] underline-offset-2 hover:underline"
          >
            ← Toutes les interventions
          </Link>
        </aside>
      </div>
    </>
  );
}
