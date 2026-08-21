'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { DonneeEtape } from '@/components/data/graphique-etapes';
import type { PointEvolution } from '@/components/data/graphique-evolution';

/**
 * Chargement differé des graphiques.
 *
 * Recharts pese une centaine de kilo-octets. Le premier jour, il n'y a aucune
 * donnee a tracer : charger la bibliotheque pour afficher un etat vide serait
 * du gaspillage pur. Ces enveloppes ne la chargent qu'au moment ou un
 * graphique est reellement rendu.
 *
 * `ssr: false` : Recharts mesure le conteneur pour se dimensionner, ce qu'il
 * ne peut pas faire au rendu serveur. Le squelette occupe la meme hauteur,
 * ce qui evite tout decalage a l'affichage.
 */

export const GraphiqueEtapesLazy = dynamic(
  () => import('@/components/data/graphique-etapes').then((m) => m.GraphiqueEtapes),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> },
);

export const GraphiqueEvolutionLazy = dynamic(
  () => import('@/components/data/graphique-evolution').then((m) => m.GraphiqueEvolution),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> },
);

export type { DonneeEtape, PointEvolution };
