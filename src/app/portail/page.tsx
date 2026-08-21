import type { Metadata } from 'next';
import { SuitonLogo } from '@/components/brand/suiton-mark';

export const metadata: Metadata = {
  title: 'Votre dossier',
  robots: { index: false, follow: false },
};

/**
 * Page atteinte quand quelqu'un ouvre /portail sans jeton. Elle ne revele
 * rien et oriente vers le seul moyen de retrouver un lien : nous appeler.
 */
export default function PortailSansJeton() {
  return (
    <main className="bg-mineral flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <SuitonLogo />
      <div className="max-w-sm">
        <h1 className="font-heading text-xl font-semibold">Lien incomplet</h1>
        <p className="text-ardoise mt-2 text-sm">
          L&apos;adresse de votre dossier se termine par une suite de caractères. Reprenez le
          lien complet depuis l&apos;e-mail que nous vous avons envoyé.
        </p>
        <p className="mt-4 text-sm">
          Vous ne le retrouvez pas ?{' '}
          <a
            href="tel:+32489210124"
            className="text-ocean font-medium underline underline-offset-2"
          >
            0489 21 01 24
          </a>{' '}
          — nous vous en renvoyons un.
        </p>
      </div>
    </main>
  );
}
