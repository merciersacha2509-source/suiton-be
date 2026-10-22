import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Badge,
  RappelStageBadge,
  RAPPEL_STAGE_LABELS,
  RAPPEL_SOURCE_LABELS,
} from '@/components/ui/badge';
import { formatDate, joursDepuis } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { RappelStage } from '@/types/database';

export const metadata: Metadata = { title: 'Demandes de rappel' };
export const dynamic = 'force-dynamic';

/**
 * Demandes de rappel — Contact, Auto, Textile, Vitres sur devis.
 *
 * Ne rejoint pas `jobs` : ces demandes n'ont ni surface, ni zone, ni prix
 * calcule (voir la migration `rappels`). Meme logique de filtre par etape
 * que Chantiers, en plus simple — quatre etapes suffisent, il n'y a pas de
 * devis a produire ici.
 */
const FILTRES = [
  { cle: 'a_traiter', libelle: 'À traiter', stages: ['nouveau', 'contacte'] },
  { cle: 'traitees', libelle: 'Traitées', stages: ['traite'] },
  { cle: 'perdues', libelle: 'Perdues', stages: ['perdu'] },
  { cle: 'toutes', libelle: 'Toutes', stages: [] },
] as const;

/**
 * Relance : promesse affichee au client "rappele le jour meme avant 16 h,
 * sinon le lendemain matin" — un jour ouvre sans mouvement suffit donc a
 * justifier un repere visuel. Pas d'envoi automatique.
 */
const STAGES_EN_ATTENTE: readonly RappelStage[] = ['nouveau', 'contacte'];
const SEUIL_RELANCE_JOURS = 1;

interface LigneRappel {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  source: string;
  stage: RappelStage;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export default async function RappelsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  await requireCapability('rappels.read');
  const { f } = await searchParams;

  const filtre = FILTRES.find((x) => x.cle === f) ?? FILTRES[0];
  const supabase = await createClient();

  let requete = supabase
    .from('rappels')
    .select('id, nom, telephone, email, adresse, source, stage, photos, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filtre.stages.length > 0) {
    requete = requete.in('stage', filtre.stages);
  }

  const { data, error } = await requete;
  const rappels = (data ?? []) as unknown as LigneRappel[];

  return (
    <>
      <PageHeader
        titre="Demandes de rappel"
        description={`${rappels.length} demande${rappels.length > 1 ? 's' : ''} · ${filtre.libelle.toLowerCase()}`}
      />

      <nav aria-label="Filtres" className="mb-4 flex flex-wrap gap-1.5">
        {FILTRES.map((x) => (
          <Link
            key={x.cle}
            href={`/rappels?f=${x.cle}`}
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
        ) : rappels.length === 0 ? (
          <EmptyState
            titre="Aucune demande ici"
            description="Les demandes arrivent des formulaires Contact, Auto, Textile et Vitres sur devis."
          />
        ) : (
          <CardBody className="px-0 py-0">
            <Table>
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Contact</Th>
                  <Th>Origine</Th>
                  <Th>Étape</Th>
                  <Th>Reçu</Th>
                </tr>
              </thead>
              <tbody>
                {rappels.map((r) => {
                  const aRelancer =
                    STAGES_EN_ATTENTE.includes(r.stage) &&
                    joursDepuis(r.updated_at) >= SEUIL_RELANCE_JOURS;
                  return (
                  <tr key={r.id} className="hover:bg-mineral">
                    <Td>
                      <Link
                        href={`/rappels/${r.id}`}
                        className="text-ocean font-medium underline-offset-2 hover:underline"
                      >
                        {r.nom}
                      </Link>
                      {r.photos.length > 0 ? (
                        <Badge ton="preuve" className="ml-2">
                          {r.photos.length} photo{r.photos.length > 1 ? 's' : ''}
                        </Badge>
                      ) : null}
                      {aRelancer ? (
                        <Badge ton="danger" className="ml-2">
                          À relancer · {joursDepuis(r.updated_at)} j
                        </Badge>
                      ) : null}
                    </Td>
                    <Td className="tabular">
                      {r.telephone}
                      {r.email ? <span className="text-ardoise ml-1.5">· {r.email}</span> : null}
                    </Td>
                    <Td>
                      <Badge ton="neutre">{RAPPEL_SOURCE_LABELS[r.source] ?? r.source}</Badge>
                    </Td>
                    <Td>
                      <RappelStageBadge stage={r.stage} />
                    </Td>
                    <Td className="text-ardoise whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </Td>
                  </tr>
                  );
                })}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>

      <p className="text-ardoise mt-3 text-[0.75rem]">
        Étapes disponibles : {Object.values(RAPPEL_STAGE_LABELS).join(' · ')}
      </p>
    </>
  );
}
