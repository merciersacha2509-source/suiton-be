import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import { AppShell } from '@/components/layout/app-shell';
import { BandeauEnvironnement } from '@/components/site/bandeau-environnement';

/**
 * L'espace de gestion partage le domaine avec le site public, dont la valeur
 * par defaut est `index: true`. On la repose explicitement ici : ces pages ne
 * doivent apparaitre dans aucun index, meme si un robot obtenait un jour une
 * session.
 */
export const metadata: Metadata = {
  title: { default: 'SUITON OS', template: '%s · SUITON OS' },
  robots: { index: false, follow: false },
};

/**
 * Layout authentifie.
 *
 * Le middleware a deja redirige les visiteurs sans session ; ce garde est
 * la seconde barriere, cote serveur, avec le profil et le role charges.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <>
      <BandeauEnvironnement />
      <AppShell role={session.profile.role} nom={session.profile.nom} email={session.email}>
        {children}
      </AppShell>
    </>
  );
}
