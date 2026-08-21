import type { ReactNode } from 'react';
import { FilAriane } from '@/components/site/blocs';

/**
 * Gabarit des pages legales.
 *
 * Prose sobre, une seule colonne, largeur de lecture confortable. Ces pages
 * ne convertissent pas ; elles doivent etre lisibles et trouvables, rien de
 * plus.
 */
export function PageLegale({
  titre,
  miseAJour,
  chemin,
  children,
}: {
  titre: string;
  miseAJour: string;
  chemin: string;
  children: ReactNode;
}) {
  return (
    <>
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: titre, href: chemin },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-20">
        <h1 className="text-3xl font-semibold">{titre}</h1>
        <p className="text-ardoise mt-3 text-xs">Dernière mise à jour : {miseAJour}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </div>
    </>
  );
}

export function Article({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-lg font-semibold">{titre}</h2>
      <div className="text-ardoise mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
