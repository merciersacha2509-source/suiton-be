import type { AppRole } from '@/types/database';
import { can, type Capability } from '@/lib/auth/roles';

/**
 * Correspondance chemin protege -> capacite requise pour l'atteindre.
 *
 * Memes prefixes que `CHEMINS_PROTEGES` du middleware, meme capacite que le
 * `requireCapability()` place en tete de chaque page correspondante : cette
 * table ne fait que decrire des gardes qui existent deja, elle n'en cree
 * aucune. L'ordre compte — c'est aussi l'ordre de preference pour la
 * redirection par defaut.
 */
const ROUTES_PROTEGEES: readonly { chemin: string; capacite: Capability }[] = [
  { chemin: '/tableau-de-bord', capacite: 'dashboard.view' },
  { chemin: '/chantiers', capacite: 'jobs.read' },
  { chemin: '/clients', capacite: 'clients.read' },
  { chemin: '/planning', capacite: 'planning.read' },
  { chemin: '/terrain', capacite: 'terrain.execute' },
  { chemin: '/facturation', capacite: 'invoices.read' },
  { chemin: '/donnees', capacite: 'dashboard.view' },
  { chemin: '/intelligence', capacite: 'dashboard.view' },
  { chemin: '/playbook', capacite: 'dashboard.view' },
  { chemin: '/parametres', capacite: 'settings.read' },
];

/**
 * Premiere page protegee que ce role peut reellement consulter.
 *
 * `/connexion` si aucune : pas de role sans capacite parmi les quatre
 * existants aujourd'hui, mais un profil sans role exploitable ne doit
 * jamais recevoir un acces par defaut.
 */
export function getDefaultRouteForRole(role: AppRole | null | undefined): string {
  const premiere = ROUTES_PROTEGEES.find((r) => can(role, r.capacite));
  return premiere?.chemin ?? '/connexion';
}

/**
 * Ce role peut-il atteindre ce chemin ?
 *
 * Un chemin protege non reconnu est refuse : on ne devine jamais un acces
 * pour une route qu'on ne sait pas classer.
 */
export function estRouteAutoriseePourRole(
  chemin: string,
  role: AppRole | null | undefined,
): boolean {
  const entree = ROUTES_PROTEGEES.find(
    (r) => chemin === r.chemin || chemin.startsWith(`${r.chemin}/`),
  );
  return entree ? can(role, entree.capacite) : false;
}
