import type { ReactNode } from 'react';
import { EnTete } from '@/components/site/en-tete';
import { Pied } from '@/components/site/pied';
import { ActionsPermanentes } from '@/components/site/actions-permanentes';
import { Mesure } from '@/components/site/mesure';
import { BandeauEnvironnement } from '@/components/site/bandeau-environnement';
import { Jsonld, jsonldEntreprise } from '@/lib/site/seo';
import { COMMUNES } from '@/lib/site/communes';

/**
 * Enveloppe publique de suiton.be.
 *
 * Le JSON-LD LocalBusiness est injecte ici plutot que page par page : une
 * seule declaration d'entreprise, presente partout, sans risque de deux
 * versions divergentes.
 *
 * pb-16 sur mobile reserve la hauteur de la barre d'action permanente. Sans
 * cela, elle masque le dernier element de chaque page.
 */
export default function LayoutSite({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Jsonld donnees={jsonldEntreprise(COMMUNES)} />
      <a
        href="#contenu"
        className="focus:rounded-suiton focus:bg-abysse focus:text-mineral sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:text-sm"
      >
        Aller au contenu
      </a>
      <BandeauEnvironnement />
      <EnTete />
      <main id="contenu" className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>
      <Pied />
      <ActionsPermanentes />
      <Mesure />
    </div>
  );
}
