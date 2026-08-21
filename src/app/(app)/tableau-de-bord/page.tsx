import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/card';
import { Badge, ScoreBadge, StageBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { formatDate, formatEUR } from '@/lib/format';
import type { JobStage, ScoreBand } from '@/types/database';

export const metadata: Metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

interface Demande {
  id: string;
  reference: string;
  stage: JobStage;
  commune: string;
  surface_m2: number;
  urgent: boolean;
  created_at: string;
  client: { nom: string; score: number; score_band: ScoreBand } | null;
}

interface DevisAEnvoyer {
  id: string;
  numero: string;
  montant_ttc: number;
  created_at: string;
  job: { id: string; reference: string; commune: string } | null;
}

interface Prochaine {
  id: string;
  starts_at: string;
  status: string;
  job: { id: string; reference: string; commune: string } | null;
}

interface Avis {
  id: string;
  note: number;
  texte: string | null;
  auteur: string | null;
  publiee_le: string | null;
}

/**
 * Tableau de bord.
 *
 * Cinq blocs, pas six. Ce qui n'appelle pas une decision aujourd'hui n'a rien
 * a faire ici : un tableau de bord qu'on survole est un tableau de bord qu'on
 * cesse d'ouvrir.
 */
export default async function TableauDeBordPage() {
  const session = await requireCapability('dashboard.view');
  const supabase = await createClient();

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const [nouveauxRes, devisRes, agendaRes, caRes, avisRes, aFacturerRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(
        `id, reference, stage, commune, surface_m2, urgent, created_at,
         client:clients ( nom, score, score_band )`,
      )
      .in('stage', ['nouveau', 'contacte', 'qualifie'])
      .order('urgent', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('quotes')
      .select('id, numero, montant_ttc, created_at, job:jobs ( id, reference, commune )')
      .eq('status', 'brouillon')
      .order('created_at')
      .limit(6),
    supabase
      .from('interventions')
      .select('id, starts_at, status, job:jobs ( id, reference, commune )')
      .gte('starts_at', new Date().toISOString())
      .neq('status', 'annule')
      .order('starts_at')
      .limit(5),
    supabase
      .from('invoices')
      .select('montant_ttc, status, date_emission')
      .in('status', ['emise', 'payee'])
      .gte('date_emission', debutMois.toISOString().slice(0, 10)),
    supabase
      .from('reviews')
      .select('id, note, texte, auteur, publiee_le')
      .not('publiee_le', 'is', null)
      .order('publiee_le', { ascending: false })
      .limit(3),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('stage', 'termine'),
  ]);

  const nouveaux = (nouveauxRes.data ?? []) as unknown as Demande[];
  const devis = (devisRes.data ?? []) as unknown as DevisAEnvoyer[];
  const agenda = (agendaRes.data ?? []) as unknown as Prochaine[];
  const avis = (avisRes.data ?? []) as unknown as Avis[];

  const caMois = (caRes.data ?? []).reduce((s, f) => s + Number(f.montant_ttc), 0);
  const encaisse = (caRes.data ?? [])
    .filter((f) => f.status === 'payee')
    .reduce((s, f) => s + Number(f.montant_ttc), 0);

  const noteMoyenne =
    avis.length > 0 ? avis.reduce((s, a) => s + a.note, 0) / avis.length : null;

  const prenom = session.profile.nom.split(' ')[0] ?? session.profile.nom;
  const baseKO = Boolean(nouveauxRes.error && devisRes.error);

  return (
    <>
      <PageHeader
        titre={`Bonjour ${prenom}`}
        description="Ce qui demande une décision aujourd'hui."
        action={
          <Link href="/reservation" target="_blank">
            <Button variant="secondaire">Formulaire public</Button>
          </Link>
        }
      />

      {baseKO ? (
        <Alert ton="danger" titre="Base de données injoignable" className="mb-5">
          Vérifiez Supabase et l&apos;application des migrations.
        </Alert>
      ) : null}

      {/* --- CA ----------------------------------------------------------- */}
      <section
        aria-label="Chiffres du mois"
        className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard libelle="Facturé ce mois" valeur={formatEUR(caMois)} detail="TVA comprise" />
        <StatCard libelle="Encaissé" valeur={formatEUR(encaisse)} detail="ce mois" accent />
        <StatCard
          libelle="À facturer"
          valeur={String(aFacturerRes.count ?? 0)}
          detail="chantiers terminés"
        />
        <StatCard
          libelle="Avis"
          valeur={noteMoyenne ? `${noteMoyenne.toFixed(1)}/5` : '—'}
          detail={avis.length > 0 ? `${avis.length} publiés` : 'aucun encore'}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* --- Nouveaux chantiers ---------------------------------------- */}
        <Card>
          <CardHeader
            titre="Nouvelles demandes"
            description={nouveaux.length > 0 ? 'À qualifier' : undefined}
            action={
              <Link
                href="/chantiers"
                className="text-ocean text-[0.8125rem] underline-offset-2 hover:underline"
              >
                Tout voir
              </Link>
            }
          />
          {nouveaux.length === 0 ? (
            <EmptyState
              titre="Rien en attente"
              description="Les demandes arrivent par le formulaire public."
              action={
                <Link href="/reservation" target="_blank">
                  <Button variant="secondaire">Tester le formulaire</Button>
                </Link>
              }
            />
          ) : (
            <CardBody className="flex flex-col gap-2.5">
              {nouveaux.map((j) => (
                <Link
                  key={j.id}
                  href={`/chantiers/${j.id}`}
                  className="border-mineral-dark flex items-start justify-between gap-3 border-b pb-2.5 last:border-0 last:pb-0 hover:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-sm font-medium">{j.reference}</span>
                      {j.urgent ? <Badge ton="alerte">Urgent</Badge> : null}
                      {j.client ? (
                        <ScoreBadge band={j.client.score_band} score={j.client.score} />
                      ) : null}
                    </span>
                    <span className="text-ardoise mt-0.5 block truncate text-[0.8125rem]">
                      {j.client?.nom} · {j.commune} · {j.surface_m2} m²
                    </span>
                  </span>
                  <StageBadge stage={j.stage} />
                </Link>
              ))}
            </CardBody>
          )}
        </Card>

        {/* --- Devis à envoyer -------------------------------------------- */}
        <Card>
          <CardHeader
            titre="Devis à envoyer"
            description={devis.length > 0 ? 'Relisez, puis envoyez' : undefined}
          />
          {devis.length === 0 ? (
            <EmptyState
              titre="Aucun devis en attente"
              description="Les devis générés et non encore envoyés apparaîtront ici."
            />
          ) : (
            <CardBody className="flex flex-col gap-2.5">
              {devis.map((d) => (
                <Link
                  key={d.id}
                  href={d.job ? `/chantiers/${d.job.id}` : '/chantiers'}
                  className="border-mineral-dark flex items-center justify-between gap-3 border-b pb-2.5 last:border-0 last:pb-0 hover:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="tabular block text-sm font-medium">{d.numero}</span>
                    <span className="text-ardoise block truncate text-[0.8125rem]">
                      {d.job?.reference} · {d.job?.commune} · depuis le{' '}
                      {formatDate(d.created_at)}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-semibold">
                    {formatEUR(Number(d.montant_ttc))}
                  </span>
                </Link>
              ))}
            </CardBody>
          )}
        </Card>

        {/* --- Interventions ---------------------------------------------- */}
        <Card>
          <CardHeader
            titre="Prochaines interventions"
            action={
              <Link
                href="/planning"
                className="text-ocean text-[0.8125rem] underline-offset-2 hover:underline"
              >
                Planning
              </Link>
            }
          />
          {agenda.length === 0 ? (
            <EmptyState
              titre="Rien de planifié"
              description="Planifiez depuis la fiche d'un chantier gagné."
            />
          ) : (
            <CardBody className="flex flex-col gap-2.5">
              {agenda.map((i) => (
                <Link
                  key={i.id}
                  href={i.job ? `/chantiers/${i.job.id}` : '/planning'}
                  className="border-mineral-dark flex items-center justify-between gap-3 border-b pb-2.5 last:border-0 last:pb-0 hover:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="tabular block text-sm font-medium">
                      {formatDate(i.starts_at)} · {HEURE.format(new Date(i.starts_at))}
                    </span>
                    <span className="text-ardoise block truncate text-[0.8125rem]">
                      {i.job?.reference} · {i.job?.commune}
                    </span>
                  </span>
                  <Badge ton={i.status === 'confirme' ? 'succes' : 'alerte'}>{i.status}</Badge>
                </Link>
              ))}
            </CardBody>
          )}
        </Card>

        {/* --- Avis -------------------------------------------------------- */}
        <Card>
          <CardHeader titre="Derniers avis" description="Google Business Profile" />
          {avis.length === 0 ? (
            <EmptyState
              titre="Aucun avis"
              description="La sollicitation part automatiquement après la garantie de 48 h — Sprint 5."
            />
          ) : (
            <CardBody className="flex flex-col gap-3">
              {avis.map((a) => (
                <div
                  key={a.id}
                  className="border-mineral-dark border-b pb-3 last:border-0 last:pb-0"
                >
                  <p className="flex items-center gap-2">
                    <span className="tabular font-heading text-base font-semibold">
                      {a.note}/5
                    </span>
                    <span className="text-ardoise text-[0.8125rem]">
                      {a.auteur ?? 'Anonyme'}
                      {a.publiee_le ? ` · ${formatDate(a.publiee_le)}` : ''}
                    </span>
                  </p>
                  {a.texte ? <p className="mt-1 text-[0.8125rem]">{a.texte}</p> : null}
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
