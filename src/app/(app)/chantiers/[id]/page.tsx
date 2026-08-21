import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { urlSignee } from '@/lib/storage';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, ScoreBadge, StageBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  PanneauDevis,
  PanneauEtape,
  PanneauPlanning,
  PanneauPortail,
  PanneauRealisation,
} from './panneau-actions';
import { formatDateTime, formatEUR, formatRange, formatSurface } from '@/lib/format';
import { estimateDuration } from '@/lib/pricing';
import { LIBELLES_BIEN, LIBELLES_SALISSURE, LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { LIBELLES_ZONE } from '@/lib/zones';
import type {
  JobStage,
  PropertyType,
  ScoreBand,
  ServiceType,
  SoilLevel,
  TeamRow,
  ZoneTier,
} from '@/types/database';

/**
 * Forme de la ligne lue.
 *
 * Sans les types generes (`npm run db:types`), le client Supabase renvoie
 * `any` sur chaque colonne, ce qui desactive silencieusement toute
 * verification. On declare donc la forme attendue : la moindre divergence de
 * schema se voit alors a la compilation.
 */
interface JobDetail {
  id: string;
  reference: string;
  stage: JobStage;
  service: ServiceType;
  property_type: PropertyType;
  soil: SoilLevel;
  surface_m2: number;
  adresse: string | null;
  commune: string;
  code_postal: string | null;
  zone: ZoneTier;
  urgent: boolean;
  date_souhaitee: string | null;
  estimation_min: number | null;
  estimation_max: number | null;
  notes: string | null;
  perdu_motif: string | null;
  created_at: string;
  published: boolean | null;
  published_slug: string | null;
  resume_public: string | null;
  client:
    | {
        id: string;
        nom: string;
        email: string;
        telephone: string;
        kind: 'particulier' | 'professionnel';
        tva: string | null;
        score: number;
        score_band: ScoreBand;
        consent_photos: boolean;
      }[]
    | {
        id: string;
        nom: string;
        email: string;
        telephone: string;
        kind: 'particulier' | 'professionnel';
        tva: string | null;
        score: number;
        score_band: ScoreBand;
        consent_photos: boolean;
      }
    | null;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('jobs').select('reference').eq('id', id).maybeSingle();
  return { title: data?.reference ?? 'Chantier' };
}

export default async function ChantierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability('jobs.read');
  const { id } = await params;
  const supabase = await createClient();

  const { data: jobBrut } = await supabase
    .from('jobs')
    .select(
      `id, reference, stage, service, property_type, soil, surface_m2, adresse, commune,
       code_postal, zone, urgent, date_souhaitee, estimation_min, estimation_max, notes,
       perdu_motif, created_at, published, published_slug, resume_public,
       client:clients ( id, nom, email, telephone, kind, tva, score, score_band, consent_photos )`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!jobBrut) notFound();

  const job = jobBrut as unknown as JobDetail;
  const client = Array.isArray(job.client) ? job.client[0] : job.client;

  const [devisRes, interRes, eventsRes, equipesRes, messagesRes] = await Promise.all([
    supabase
      .from('quotes')
      .select(
        'id, numero, status, montant_htva, montant_ttc, valide_jusqu_au, pdf_path, sent_at',
      )
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('interventions')
      .select('id, status, starts_at, ends_at, google_event_id')
      .eq('job_id', id)
      .neq('status', 'annule')
      .order('starts_at'),
    supabase
      .from('events')
      .select('id, type, payload, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase.from('teams').select('id, nom, couleur, actif').eq('actif', true).order('nom'),
    supabase
      .from('messages')
      .select('id, corps, sortant, auteur_label, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const devis = devisRes.data;

  // Le lien de telechargement est signe cote serveur : les documents ne sont
  // jamais publics.
  let urlPdf: string | null = null;
  if (devis?.pdf_path) {
    urlPdf = await urlSignee('documents', devis.pdf_path);
  }

  // portal_tokens est lisible par le bureau grace a la politique RLS
  // `portal_tokens_staff` : pas besoin du client de service ici.
  const { data: jetonActif } = await supabase
    .from('portal_tokens')
    .select('id')
    .eq('job_id', id)
    .is('revoked_at', null)
    .maybeSingle();

  const duree = estimateDuration({ surface_m2: job.surface_m2, soil: job.soil });
  const equipes = (equipesRes.data ?? []) as TeamRow[];

  return (
    <>
      <PageHeader
        titre={job.reference}
        description={`${LIBELLES_SERVICE[job.service]} · ${formatSurface(job.surface_m2)} · ${job.commune}`}
        action={
          <span className="flex items-center gap-2">
            {job.urgent ? <Badge ton="alerte">Urgent</Badge> : null}
            <StageBadge stage={job.stage} />
          </span>
        }
      />

      {job.stage === 'perdu' && job.perdu_motif ? (
        <Alert ton="alerte" titre="Chantier perdu" className="mb-5">
          {job.perdu_motif}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* --- Colonne principale ---------------------------------------- */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              titre="Client"
              action={
                client ? (
                  <ScoreBadge band={client.score_band} score={client.score} />
                ) : undefined
              }
            />
            <CardBody className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <p className="font-medium">{client?.nom}</p>
              <p>
                <Badge ton={client?.kind === 'professionnel' ? 'ocean' : 'neutre'}>
                  {client?.kind === 'professionnel' ? 'Professionnel' : 'Particulier'}
                </Badge>
              </p>
              <p>
                <a
                  href={`tel:${client?.telephone.replace(/\s/g, '')}`}
                  className="text-ocean underline-offset-2 hover:underline"
                >
                  {client?.telephone}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${client?.email}`}
                  className="text-ocean break-all underline-offset-2 hover:underline"
                >
                  {client?.email}
                </a>
              </p>
              {client?.tva ? (
                <p>
                  <span className="text-ardoise">TVA</span> · {client.tva}
                </p>
              ) : null}
              <p>
                <span className="text-ardoise">Photos publiables</span> ·{' '}
                {client?.consent_photos ? 'oui' : 'non'}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titre="Chantier" />
            <CardBody className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-ardoise">Bien</span> · {LIBELLES_BIEN[job.property_type]}
              </p>
              <p>
                <span className="text-ardoise">Salissure</span> · {LIBELLES_SALISSURE[job.soil]}
              </p>
              <p>
                <span className="text-ardoise">Adresse</span> ·{' '}
                {[job.adresse, `${job.code_postal ?? ''} ${job.commune}`.trim()]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <p>
                <span className="text-ardoise">Zone</span> · {LIBELLES_ZONE[job.zone]}
              </p>
              <p className="tabular">
                <span className="text-ardoise">Estimation</span> ·{' '}
                {job.estimation_min !== null && job.estimation_max !== null
                  ? formatRange(Number(job.estimation_min), Number(job.estimation_max))
                  : '—'}
              </p>
              <p className="tabular">
                <span className="text-ardoise">Durée</span> · {Math.round(duree.min / 60)}–
                {Math.round(duree.max / 60)} h
              </p>
              {job.notes ? (
                <p className="sm:col-span-2">
                  <span className="text-ardoise">Précisions du client</span>
                  <br />
                  <span className="whitespace-pre-wrap">{job.notes}</span>
                </p>
              ) : null}
            </CardBody>
          </Card>

          {(interRes.data ?? []).length > 0 ? (
            <Card>
              <CardHeader titre="Interventions" />
              <CardBody className="flex flex-col gap-2 text-sm">
                {(interRes.data ?? []).map((i) => (
                  <div
                    key={i.id}
                    className="border-mineral-dark flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="tabular">{formatDateTime(i.starts_at)}</span>
                    <span className="flex items-center gap-2">
                      {i.google_event_id ? <Badge ton="preuve">Calendrier</Badge> : null}
                      <Badge ton={i.status === 'confirme' ? 'succes' : 'alerte'}>
                        {i.status}
                      </Badge>
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {(messagesRes.data ?? []).length > 0 ? (
            <Card>
              <CardHeader titre="Messages du portail" />
              <CardBody className="flex flex-col gap-2.5 text-sm">
                {(messagesRes.data ?? []).map((m) => (
                  <div key={m.id}>
                    <p className="whitespace-pre-wrap">{m.corps}</p>
                    <p className="text-ardoise mt-0.5 text-[0.75rem]">
                      {m.auteur_label ?? (m.sortant ? 'SUITON' : 'Client')} ·{' '}
                      {formatDateTime(m.created_at)}
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader titre="Historique" description="Journal des événements" />
            <CardBody className="flex flex-col gap-1.5 text-[0.8125rem]">
              {(eventsRes.data ?? []).length === 0 ? (
                <p className="text-ardoise">Aucun événement.</p>
              ) : (
                (eventsRes.data ?? []).map((e) => (
                  <div
                    key={e.id}
                    className="border-mineral-dark flex justify-between gap-3 border-b pb-1.5 last:border-0"
                  >
                    <span className="font-mono">{e.type}</span>
                    <span className="text-ardoise whitespace-nowrap">
                      {formatDateTime(e.created_at)}
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* --- Colonne d'actions ------------------------------------------ */}
        <aside className="flex flex-col gap-5">
          <PanneauDevis
            jobId={job.id}
            devis={
              devis
                ? { id: devis.id, numero: devis.numero, status: devis.status, urlPdf }
                : null
            }
          />
          <PanneauPlanning jobId={job.id} equipes={equipes} dureeMax={duree.max} />
          <PanneauEtape jobId={job.id} stage={job.stage} />
          <PanneauPortail jobId={job.id} aUnLien={Boolean(jetonActif)} />
          <PanneauRealisation
            jobId={job.id}
            stage={job.stage}
            publie={Boolean(job.published)}
            slug={job.published_slug ?? null}
            resume={job.resume_public ?? null}
            consentPhotos={Boolean(client?.consent_photos)}
          />

          {devis ? (
            <Card>
              <CardHeader titre="Montants" />
              <CardBody className="flex flex-col gap-1 text-sm">
                <p className="tabular flex justify-between">
                  <span className="text-ardoise">HTVA</span>
                  <span>{formatEUR(Number(devis.montant_htva))}</span>
                </p>
                <p className="tabular flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatEUR(Number(devis.montant_ttc))}</span>
                </p>
                {devis.sent_at ? (
                  <p className="text-ardoise mt-1 text-[0.75rem]">
                    Envoyé le {formatDateTime(devis.sent_at)}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Link
            href="/chantiers"
            className="text-ocean text-[0.8125rem] underline-offset-2 hover:underline"
          >
            ← Tous les chantiers
          </Link>
        </aside>
      </div>
    </>
  );
}
