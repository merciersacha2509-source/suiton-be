'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { blackWeekActive } from '@/lib/site/tarifs-secondaires';

/**
 * Bandeau Black Week (accueil et /nettoyage-textile).
 *
 * Fin de l'offre : 30/11 a minuit, heure de Bruxelles. Une offre affichee
 * apres sa date est une promesse que l'on ne tient pas ; le bandeau doit
 * donc disparaitre seul, sans redeploiement.
 *
 * La page textile est regeneree toutes les 24 heures : le controle cote
 * serveur seul pourrait laisser le bandeau en ligne une journee de trop.
 * D'ou le second controle dans le navigateur, apres l'hydratation, pour ne
 * pas provoquer d'ecart entre le rendu serveur et le rendu client.
 *
 * Le bouton mene au formulaire de devis textile : /reservation ne traite que
 * la fin de travaux, un canape ne peut pas y etre reserve.
 *
 * Bouton mineral sur fond abysse : l'aqua reste reserve aux elements de
 * preuve.
 */
export function BandeauBlackWeek() {
  const [actif, setActif] = useState(() => blackWeekActive());

  useEffect(() => {
    if (!blackWeekActive()) setActif(false);
  }, []);

  if (!actif) return null;

  return (
    <aside aria-label="Offre Black Week" className="bg-abysse text-mineral">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm leading-snug sm:text-base">
          <span className="font-heading font-semibold">Black Week jusqu&apos;au 30/11 :</span>{' '}
          option vapeur offerte pour tout nettoyage de canapé réservé.
        </p>
        <Link
          href="/nettoyage-textile#devis"
          className="rounded-suiton bg-mineral text-abysse focus-visible:outline-mineral inline-flex h-11 shrink-0 items-center justify-center self-start px-5 text-sm font-semibold transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 sm:self-auto"
        >
          Réserver
        </Link>
      </div>
    </aside>
  );
}
