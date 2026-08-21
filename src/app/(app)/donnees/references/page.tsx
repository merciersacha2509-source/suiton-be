import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { chantiersComparables } from '@/lib/services/analytics';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { Confiance } from '@/components/ui/confiance';
import { Button } from '@/components/ui/button';
import { formatDate, formatDuration, formatEUR } from '@/lib/format';
import { LIBELLES_BIEN, LIBELLES_SALISSURE } from '@/lib/pdf/compose';
import { SEUIL_OBSERVATIONS } from '@/lib/alertes';
import type { NiveauConfiance, PropertyType, SoilLevel } from '@/types/database';

export const metadata: Metadata = { title: 'Références' };
export const dynamic = 'force-dynamic';

const BANDES: Record<string, string> = {
  xs: '< 60 m²',
  s: '60–110 m²',
  m: '110–180 m²',
  l: '180–300 m²',
  xl: '> 300 m²',
};

/**
 * Table des references par gabarit.
 *
 * Le champ « origine » est la colonne la plus importante de cette page : il
 * dit si le chiffre vient de l'experience ou du catalogue. Sans lui, on ne
 * distingue pas une reference eprouvee d'un pari initial.
 */
export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ bien?: string; bande?: string; sal?: string }>;
}) {
  await requireCapability('dashboard.view');
  const { bien, bande, sal } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from('references_gabarits')
    .select('*')
    .order('property_type')
    .order('bande')
    .order('soil');

  const lignes = data ?? [];
  const observees = lignes.filter((l) => String(l.origine) === 'observee').length;

  // Detail : chantiers derriere un gabarit precis.
  const detail =
    bien && bande && sal
      ? await chantiersComparables(
          bien as PropertyType,
          bande === 'xs'
            ? 40
            : bande === 's'
              ? 90
              : bande === 'm'
                ? 140
                : bande === 'l'
                  ? 250
                  : 400,
          sal as SoilLevel,
        )
      : null;

  return (
    <>
      <PageHeader
        titre="Références"
        description="Ce que dure réellement un chantier, par gabarit."
        action={
          <Link href="/donnees">
            <Button variant="secondaire" size="sm">
              ← Cockpit
            </Button>
          </Link>
        }
      />

      <Alert ton={observees === 0 ? 'info' : 'succes'} className="mb-5">
        {observees === 0 ? (
          <>
            Aucune référence observée pour l&apos;instant : les {lignes.length} gabarits
            utilisent le catalogue. Chaque chantier terminé et facturé rapproche le système de
            ses propres chiffres — il en faut {SEUIL_OBSERVATIONS} par gabarit pour basculer.
          </>
        ) : (
          <>
            <strong>{observees}</strong> gabarit{observees > 1 ? 's reposent' : ' repose'} sur
            vos chantiers réels, {lignes.length - observees} encore sur le catalogue.
          </>
        )}
      </Alert>

      {detail ? (
        <Card className="mb-5">
          <CardHeader
            titre="Chantiers comparables"
            description={`${LIBELLES_BIEN[bien as PropertyType]} · ${BANDES[bande ?? ''] ?? bande} · ${LIBELLES_SALISSURE[sal as SoilLevel]}`}
            action={
              <Link href="/donnees/references">
                <Button variant="discret" size="sm">
                  Fermer
                </Button>
              </Link>
            }
          />
          {detail.length === 0 ? (
            <CardBody>
              <p className="text-ardoise text-sm">
                Aucun chantier de ce gabarit n&apos;a encore été terminé et facturé.
              </p>
            </CardBody>
          ) : (
            <CardBody className="px-0 py-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Référence</Th>
                    <Th>Commune</Th>
                    <Th className="text-right">Surface</Th>
                    <Th className="text-right">Durée</Th>
                    <Th className="text-right">min/m²</Th>
                    <Th className="text-right">Facturé</Th>
                    <Th>Réalisé</Th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((c: Record<string, unknown>) => (
                    <tr
                      key={String(c.job_id)}
                      className={c.suspecte ? 'bg-alerte-wash' : undefined}
                    >
                      <Td>
                        <Link
                          href={`/chantiers/${String(c.job_id)}`}
                          className="tabular text-ocean font-medium underline-offset-2 hover:underline"
                        >
                          {String(c.reference)}
                        </Link>
                        {c.suspecte ? (
                          <span className="text-alerte ml-2 text-[0.6875rem]">exclu</span>
                        ) : null}
                      </Td>
                      <Td>{String(c.commune)}</Td>
                      <Td className="tabular text-right">{Number(c.surface_m2)} m²</Td>
                      <Td className="tabular text-right">
                        {formatDuration(Number(c.duree_reelle_min ?? 0))}
                      </Td>
                      <Td className="tabular text-right">
                        {c.minutes_par_m2 !== null ? Number(c.minutes_par_m2).toFixed(2) : '—'}
                      </Td>
                      <Td className="tabular text-right">
                        {c.facture_htva !== null ? formatEUR(Number(c.facture_htva)) : '—'}
                      </Td>
                      <Td className="text-ardoise whitespace-nowrap">
                        {c.realise_le ? formatDate(String(c.realise_le)) : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titre="Tous les gabarits"
          description="105 combinaisons bien × surface × salissure"
        />
        <CardBody className="px-0 py-0">
          <Table>
            <thead>
              <tr>
                <Th>Bien</Th>
                <Th>Surface</Th>
                <Th>Salissure</Th>
                <Th className="text-right">Référence</Th>
                <Th className="text-right">Fourchette</Th>
                <Th className="text-right">Prix médian</Th>
                <Th>Origine</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const observee = String(l.origine) === 'observee';
                return (
                  <tr
                    key={`${l.property_type}-${l.bande}-${l.soil}`}
                    className={observee ? 'bg-aqua-wash/40' : undefined}
                  >
                    <Td>{LIBELLES_BIEN[l.property_type as PropertyType]}</Td>
                    <Td className="whitespace-nowrap">
                      {BANDES[String(l.bande)] ?? String(l.bande)}
                    </Td>
                    <Td>{LIBELLES_SALISSURE[l.soil as SoilLevel]}</Td>
                    <Td className="tabular text-right font-medium">
                      {Number(l.effective_min_m2).toFixed(2)}
                      <span className="text-ardoise"> min/m²</span>
                    </Td>
                    <Td className="tabular text-ardoise text-right">
                      {l.q1_min_m2 !== null && l.q3_min_m2 !== null
                        ? `${Number(l.q1_min_m2).toFixed(1)} – ${Number(l.q3_min_m2).toFixed(1)}`
                        : '—'}
                    </Td>
                    <Td className="tabular text-right">
                      {l.mediane_htva !== null ? formatEUR(Number(l.mediane_htva)) : '—'}
                    </Td>
                    <Td>
                      <Confiance
                        niveau={l.confiance as NiveauConfiance}
                        n={l.n !== null ? Number(l.n) : 0}
                      />
                    </Td>
                    <Td className="text-right">
                      {Number(l.n ?? 0) > 0 ? (
                        <Link
                          href={`/donnees/references?bien=${String(l.property_type)}&bande=${String(l.bande)}&sal=${String(l.soil)}`}
                          className="text-ocean text-[0.8125rem] whitespace-nowrap underline-offset-2 hover:underline"
                        >
                          Voir
                        </Link>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <p className="text-ardoise mt-4 text-[0.75rem] leading-relaxed">
        Les lignes teintées reposent sur vos chantiers réels. Les autres sur le catalogue de
        départ, établi depuis la cadence annoncée dans la grille tarifaire — utile pour
        démarrer, remplacé dès que l&apos;expérience le permet.
      </p>
    </>
  );
}
