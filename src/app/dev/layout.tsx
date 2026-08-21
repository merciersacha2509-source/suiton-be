import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { estProduction } from '@/lib/env';

/**
 * Outils de developpement.
 *
 * Toute cette branche est INTROUVABLE en production : le layout renvoie un
 * 404 avant meme de rendre la page. Ce n'est pas une question de confort mais
 * de surface d'attaque — le visualiseur de courriels expose des adresses, des
 * noms et des liens de portail. Il n'a rien a faire sur un site public.
 *
 * Le controle est fait ici, une fois, plutot que dans chaque page : une page
 * ajoutee plus tard sous /dev heritera de la protection sans que personne ait
 * a y penser.
 */
export const metadata: Metadata = {
  title: 'Outils',
  robots: { index: false, follow: false, nocache: true },
};

export default function LayoutDev({ children }: { children: React.ReactNode }) {
  if (estProduction()) notFound();
  return <>{children}</>;
}
