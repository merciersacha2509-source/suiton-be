import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { chargerDossier } from '@/lib/services/portal';
import { consommerQuota, ipDepuisRequete } from '@/lib/rate-limit';
import { NotFoundError, RateLimitError } from '@/lib/errors';
import { SuitonLogo } from '@/components/brand/suiton-mark';
import { Suivi } from './suivi';
import { BlocDevis } from './bloc-devis';
import { BlocPhotos } from './bloc-photos';
import { BlocMessages } from './bloc-messages';
import { BlocConsentement } from './bloc-consentement';
import { BlocNouvelleDemande } from './bloc-nouvelle-demande';
import { BlocDocuments } from './bloc-documents';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatDateTime, formatSurface } from '@/lib/format';
import { LIBELLES_SERVICE, LIBELLES_BIEN, LIBELLES_SALISSURE } from '@/lib/pdf/compose';

export const dynamic = 'force-dynamic';

/**
 * Le portail ne doit jamais etre indexe, ni laisser fuiter son URL par
 * l'en-tete Referer. `noindex` ici, `Referrer-Policy: no-referrer` dans
 * next.config.ts.
 */
export const metadata: Metadata = {
  title: 'Votre dossier',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PortailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    await consommerQuota(
      'portail',
      `${ipDepuisRequete(await headers())}:${token.slice(0, 12)}`,
    );
  } catch (e) {
    if (e instanceof RateLimitError) notFound();
    throw e;
  }

  let dossier;
  try {
    dossier = await chargerDossier(token);
  } catch (e) {
    // 404 pour toute anomalie : jeton inconnu, expire ou revoque. Distinguer
    // les cas confirmerait a un attaquant qu'un dossier existe.
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  return (
    <div className="bg-mineral min-h-dvh">
      <header className="border-mineral-dark border-b bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <SuitonLogo />
          <a
            href="tel:+32489210124"
            className="h-touch rounded-suiton text-ocean hover:bg-mineral flex items-center px-3 text-sm font-medium"
          >
            0489 21 01 24
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <p className="tabular text-ardoise text-[0.8125rem]">{dossier.reference}</p>
          <h1 className="font-heading mt-0.5 text-2xl font-semibold">
            Bonjour {dossier.client.prenom}
          </h1>
          <p className="text-ardoise mt-1 text-sm">
            {LIBELLES_SERVICE[dossier.service]} · {LIBELLES_BIEN[dossier.propertyType]}{' '}
            {formatSurface(dossier.surface)} · {dossier.commune}
          </p>
        </div>

        <Suivi stage={dossier.stage} />

        <div className="mt-5 flex flex-col gap-5">
          <BlocDevis
            jeton={token}
            devis={dossier.devis}
            estimation={dossier.estimation}
            stage={dossier.stage}
          />

          {dossier.intervention ? (
            <Card>
              <CardHeader
                titre="Votre intervention"
                description={
                  dossier.intervention.status === 'provisoire'
                    ? 'Créneau provisoire — confirmé à l’acceptation du devis'
                    : 'Créneau confirmé'
                }
              />
              <CardBody>
                <p className="tabular font-heading text-lg font-semibold">
                  {formatDateTime(dossier.intervention.debut)}
                </p>
                <p className="text-ardoise mt-1 text-sm">
                  Fin estimée {formatDateTime(dossier.intervention.fin)}
                </p>
                <p className="text-ardoise mt-3 text-[0.8125rem]">
                  Besoin de décaler ? Appelez le 0489 21 01 24 — nous replaçons sans frais tant
                  que c&apos;est plus de 48 h à l&apos;avance.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader titre="Votre chantier" />
            <CardBody className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-ardoise">Service</span> ·{' '}
                {LIBELLES_SERVICE[dossier.service]}
              </p>
              <p>
                <span className="text-ardoise">Surface</span> · {formatSurface(dossier.surface)}
              </p>
              <p>
                <span className="text-ardoise">Salissure</span> ·{' '}
                {LIBELLES_SALISSURE[dossier.soil]}
              </p>
              <p>
                <span className="text-ardoise">Commune</span> · {dossier.commune}
              </p>
            </CardBody>
          </Card>

          {dossier.rapport ? (
            <Card>
              <CardHeader
                titre="Votre chantier est terminé"
                description={`Rapport ${dossier.rapport.numero}`}
              />
              <CardBody className="flex flex-col gap-3">
                <Alert ton="succes" titre="Garantie retouche">
                  Un point ne vous convient pas ? Signalez-le avant le{' '}
                  {formatDateTime(dossier.rapport.garantieJusquAu)} : nous repassons sans frais
                  et sans discussion. Un appel au 0489 21 01 24 suffit.
                </Alert>
                <div>
                  <p className="text-ardoise mb-1 text-[0.8125rem] font-medium">
                    Ce que nous avons constaté
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{dossier.rapport.observations}</p>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <BlocDocuments documents={dossier.documents} />
          <BlocPhotos photos={dossier.photos} />
          <BlocMessages jeton={token} messages={dossier.messages} />
          <BlocConsentement jeton={token} accorde={dossier.client.consentPhotos} />
          <BlocNouvelleDemande dossier={dossier} />
        </div>

        <p className="text-ardoise mt-8 text-center text-[0.75rem]">
          Ce lien vous est personnel. Il reste valable douze mois et se met à jour à chaque
          étape.
          <br />
          SUITON · Rue Boussart 7, 7850 Enghien · TVA BE1040784957
        </p>
      </main>
    </div>
  );
}
