import type { Capability } from '@/lib/auth/roles';

export interface NavItem {
  href: string;
  label: string;
  capability: Capability;
  /** Livre au sprint indique. Sert a afficher honnetement ce qui n'existe pas encore. */
  sprint: number;
}

/**
 * Navigation de SUITON OS.
 *
 * Les entrees des sprints a venir sont presentes et marquees : masquer la
 * suite donnerait l'illusion d'un produit fini, l'afficher sans marquage
 * ferait croire a des ecrans casses.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/tableau-de-bord',
    label: 'Tableau de bord',
    capability: 'dashboard.view',
    sprint: 1,
  },
  { href: '/chantiers', label: 'Chantiers', capability: 'jobs.read', sprint: 3 },
  { href: '/planning', label: 'Planning', capability: 'planning.read', sprint: 4 },
  { href: '/terrain', label: 'Terrain', capability: 'terrain.execute', sprint: 5 },
  { href: '/facturation', label: 'Facturation', capability: 'invoices.read', sprint: 7 },
  { href: '/parametres', label: 'Paramètres', capability: 'settings.read', sprint: 1 },
] as const;
