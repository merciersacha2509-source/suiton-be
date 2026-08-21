import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { formatSurface } from '@/lib/format';
import { LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { cn } from '@/lib/cn';
import type { VueTerrain } from '@/types/database';

export const metadata: Metadata = { title: 'Terrain' };
export const dynamic = 'force-dynamic';

const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });
const JOUR = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const TONS = {
  provisoire: 'alerte',
  confirme: 'ocean',
  en_route: 'preuve',
  sur_place: 'preuve',
  termine: 'succes',
} as const;

const LIBELLES_STATUT = {
  provisoire: 'Provisoire',
  confirme: 'À faire',
  en_route: 'En route',
  sur_place: 'Sur place',
  termine: 'Terminé',
} as const;

/**
 * Journee de terrain.
 *
 * Concu pour un telephone tenu d'une main, sur un chantier, parfois avec des
 * gants. Grandes cibles, contraste eleve, aucune information superflue —
 * et surtout AUCUN MONTANT : le telephone d'un technicien peut etre perdu
 * ou vole.
 */
export default async function TerrainPage() {
  await requireCapability('terrain.execute');
  const supabase = await createClient();

  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 3);

  const { data, error } = await supabase
    .from('vue_terrain')
    .select('*')
    .gte('starts_at', debut.toISOString())
    .lt('starts_at', fin.toISOString())
    .order('starts_at')
    .returns<VueTerrain[]>();

  const interventions = data ?? [];

  const parJour = new Map<string, VueTerrain[]>();
  for (const i of interventions) {
    const cle = i.starts_at.slice(0, 10);
    const liste = parJour.get(cle);
    if (liste) liste.push(i);
    else parJour.set(cle, [i]);
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        titre="Terrain"
        description={
          interventions.length === 0
            ? 'Rien de planifié dans les trois prochains jours.'
            : `${interventions.length} intervention${interventions.length > 1 ? 's' : ''} sur trois jours`
        }
      />

      {error ? (
        <Card>
          <CardBody>
            <p className="text-danger text-sm">Lecture impossible.</p>
          </CardBody>
        </Card>
      ) : parJour.size === 0 ? (
        <Card>
          <EmptyState
            titre="Aucune intervention"
            description="Les chantiers planifiés apparaîtront ici, du plus proche au plus lointain."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(parJour.entries()).map(([jour, liste]) => (
            <section key={jour}>
              <h2 className="font-heading mb-2.5 text-base font-semibold capitalize">
                {jour === aujourdhui ? "Aujourd'hui" : JOUR.format(new Date(jour))}
              </h2>

              <div className="flex flex-col gap-2.5">
                {liste.map((i) => {
                  const enCours = i.status === 'en_route' || i.status === 'sur_place';
                  return (
                    <Link
                      key={i.intervention_id}
                      href={`/terrain/${i.intervention_id}`}
                      className={cn(
                        'rounded-suiton flex items-center gap-3.5 border bg-white p-4 transition-colors',
                        enCours
                          ? 'border-aqua-deep ring-aqua-deep ring-1'
                          : 'border-mineral-dark hover:border-ardoise-clair',
                      )}
                    >
                      <div className="tabular w-14 shrink-0">
                        <p className="font-heading text-lg leading-none font-semibold">
                          {HEURE.format(new Date(i.starts_at))}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem] font-medium">{i.client_nom}</p>
                        <p className="text-ardoise truncate text-[0.8125rem]">
                          {[i.adresse, i.commune].filter(Boolean).join(', ')}
                        </p>
                        <p className="text-ardoise mt-1 truncate text-[0.75rem]">
                          {LIBELLES_SERVICE[i.service]} · {formatSurface(i.surface_m2)}
                        </p>
                      </div>

                      <Badge ton={TONS[i.status as keyof typeof TONS] ?? 'neutre'}>
                        {LIBELLES_STATUT[i.status as keyof typeof LIBELLES_STATUT] ?? i.status}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
