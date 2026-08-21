import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatDuration, formatSurface } from '@/lib/format';
import type { InterventionStatus, ServiceType } from '@/types/database';

export const metadata: Metadata = { title: 'Planning' };
export const dynamic = 'force-dynamic';

const JOUR = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

const TONS: Record<InterventionStatus, 'succes' | 'alerte' | 'preuve' | 'neutre' | 'danger'> = {
  provisoire: 'alerte',
  confirme: 'succes',
  en_route: 'preuve',
  sur_place: 'preuve',
  termine: 'neutre',
  annule: 'danger',
};

interface LigneIntervention {
  id: string;
  status: InterventionStatus;
  starts_at: string;
  ends_at: string;
  travel_buffer_min: number;
  google_event_id: string | null;
  team: { nom: string } | { nom: string }[] | null;
  job: {
    id: string;
    reference: string;
    commune: string;
    adresse: string | null;
    surface_m2: number;
    service: ServiceType;
    client: { nom: string; telephone: string } | { nom: string; telephone: string }[] | null;
  } | null;
}

function premier<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function PlanningPage() {
  await requireCapability('planning.read');
  const supabase = await createClient();

  const depuis = new Date();
  depuis.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('interventions')
    .select(
      `id, status, starts_at, ends_at, travel_buffer_min, google_event_id,
       team:teams ( nom ),
       job:jobs ( id, reference, commune, adresse, surface_m2, service,
                  client:clients ( nom, telephone ) )`,
    )
    .gte('starts_at', depuis.toISOString())
    .neq('status', 'annule')
    .order('starts_at')
    .limit(80);

  const interventions = (data ?? []) as unknown as LigneIntervention[];

  const parJour = new Map<string, LigneIntervention[]>();
  for (const i of interventions) {
    const cle = i.starts_at.slice(0, 10);
    const liste = parJour.get(cle);
    if (liste) liste.push(i);
    else parJour.set(cle, [i]);
  }

  const provisoires = interventions.filter((i) => i.status === 'provisoire').length;

  return (
    <>
      <PageHeader
        titre="Planning"
        description={`${interventions.length} intervention${interventions.length > 1 ? 's' : ''} à venir`}
      />

      {provisoires > 0 ? (
        <Alert
          ton="alerte"
          titre={`${provisoires} créneau${provisoires > 1 ? 'x' : ''} provisoire${provisoires > 1 ? 's' : ''}`}
          className="mb-5"
        >
          Ces créneaux sont bloqués mais le devis n&apos;est pas encore accepté. Ils se libèrent
          si le client refuse.
        </Alert>
      ) : null}

      {error ? (
        <Card>
          <CardBody>
            <p className="text-danger text-sm">Lecture impossible.</p>
          </CardBody>
        </Card>
      ) : parJour.size === 0 ? (
        <Card>
          <EmptyState
            titre="Rien de planifié"
            description="Les interventions apparaîtront ici dès qu'un chantier sera planifié depuis sa fiche."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {Array.from(parJour.entries()).map(([jour, liste]) => (
            <Card key={jour}>
              <CardHeader
                titre={JOUR.format(new Date(jour))}
                description={`${liste.length} intervention${liste.length > 1 ? 's' : ''}`}
              />
              <CardBody className="flex flex-col gap-3">
                {liste.map((i) => {
                  const job = i.job;
                  const client = premier(job?.client ?? null);
                  const equipe = premier(i.team);
                  const duree = Math.round(
                    (new Date(i.ends_at).getTime() - new Date(i.starts_at).getTime()) / 60_000,
                  );

                  return (
                    <div
                      key={i.id}
                      className="border-mineral-dark flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
                    >
                      <div className="tabular shrink-0 sm:w-28">
                        <p className="font-heading text-base font-semibold">
                          {HEURE.format(new Date(i.starts_at))}
                        </p>
                        <p className="text-ardoise text-[0.75rem]">{formatDuration(duree)}</p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          {job ? (
                            <Link
                              href={`/chantiers/${job.id}`}
                              className="tabular text-ocean font-medium underline-offset-2 hover:underline"
                            >
                              {job.reference}
                            </Link>
                          ) : null}
                          <Badge ton={TONS[i.status]}>{i.status}</Badge>
                          {i.google_event_id ? <Badge ton="preuve">Calendrier</Badge> : null}
                          {equipe ? (
                            <span className="text-ardoise text-[0.75rem]">{equipe.nom}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-sm">
                          {client?.nom} · {job ? formatSurface(job.surface_m2) : ''}
                        </p>
                        <p className="text-ardoise text-[0.8125rem]">
                          {[job?.adresse, job?.commune].filter(Boolean).join(', ')}
                        </p>
                      </div>

                      {client?.telephone ? (
                        <a
                          href={`tel:${client.telephone.replace(/\s/g, '')}`}
                          className="h-touch rounded-suiton border-mineral-dark hover:bg-mineral flex shrink-0 items-center border px-3 text-sm"
                        >
                          Appeler
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="text-ardoise mt-4 text-[0.75rem]">
        Un tampon de trajet est bloqué après chaque intervention. La base refuse tout
        chevauchement, ce tampon compris.
      </p>
    </>
  );
}
