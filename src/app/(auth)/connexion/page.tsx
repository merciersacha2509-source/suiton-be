import type { Metadata } from 'next';
import { SuitonLogo } from '@/components/brand/suiton-mark';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false },
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;

  return (
    <main className="bg-abysse flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
          <SuitonLogo inverse />
          <p className="text-ardoise-clair text-[0.8125rem]">
            Nous ne nettoyons pas simplement. Nous prouvons le résultat.
          </p>
        </div>

        <div className="rounded-suiton bg-white p-6 shadow-sm">
          <h1 className="font-heading mb-5 text-lg font-semibold">Connexion</h1>
          <LoginForm suite={suite} />
        </div>

        <p className="text-ardoise-clair mt-5 text-center text-[0.75rem]">
          Les comptes sont créés par la direction. Aucune inscription publique.
        </p>
      </div>
    </main>
  );
}
