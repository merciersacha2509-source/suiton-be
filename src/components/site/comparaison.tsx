'use client';

import { useState } from 'react';
import type { PhotoPubliee } from '@/lib/site/realisations';

/**
 * Comparaison avant / apres.
 *
 * Un curseur, pas deux images cote a cote. La juxtaposition laisse toujours
 * un doute sur le cadrage ; le balayage sur une meme zone d'ecran ne le
 * laisse pas. C'est precisement ce doute que le rapport photo existe pour
 * lever.
 *
 * Accessible au clavier : le curseur est un `input[type=range]` natif, donc
 * pilotable aux fleches, avec une valeur annoncee. Aucune bibliotheque.
 */
export function Comparaison({
  avant,
  apres,
  piece,
}: {
  avant: PhotoPubliee;
  apres: PhotoPubliee;
  piece: string;
}) {
  const [position, setPosition] = useState(50);
  const ratio = avant.largeur && avant.hauteur ? (avant.hauteur / avant.largeur) * 100 : 66.7;

  return (
    <figure className="rounded-suiton border-mineral-dark overflow-hidden border bg-white">
      <div className="relative select-none" style={{ paddingBottom: `${ratio}%` }}>
        {/* Apres, en fond : c'est le resultat qu'on veut voir en premier. */}
        <img
          src={apres.url}
          alt={`${piece} après intervention`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={avant.url}
            alt={`${piece} avant intervention`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        <span
          className="bg-aqua pointer-events-none absolute inset-y-0 w-0.5"
          style={{ left: `${position}%` }}
          aria-hidden
        />
        <span className="bg-abysse/80 text-mineral pointer-events-none absolute top-3 left-3 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
          Avant
        </span>
        <span className="bg-aqua text-abysse pointer-events-none absolute top-3 right-3 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
          Après
        </span>

        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label={`Comparer avant et après — ${piece}`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <figcaption className="border-mineral-dark border-t px-4 py-3 text-sm">
        <span className="font-medium">{piece}</span>
        {apres.legende ? <span className="text-ardoise"> — {apres.legende}</span> : null}
      </figcaption>
    </figure>
  );
}
