import type { AppRole } from '@/types/database';

/** Libelles affiches. Le code ne doit jamais apparaitre dans l'interface. */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Direction',
  staff: 'Bureau',
  technicien: 'Terrain',
  partenaire: 'Partenaire',
};

/**
 * Capacites par role. Une seule table de verite cote client comme serveur.
 * La RLS applique les memes regles en base : ceci sert a masquer une entree
 * de menu, pas a proteger une donnee.
 */
export const CAPABILITIES = {
  'dashboard.view': ['admin', 'staff'],
  'jobs.read': ['admin', 'staff', 'technicien', 'partenaire'],
  'jobs.write': ['admin', 'staff'],
  'clients.read': ['admin', 'staff'],
  'quotes.write': ['admin', 'staff'],
  'invoices.read': ['admin', 'staff'],
  'invoices.issue': ['admin', 'staff'],
  'invoices.credit': ['admin'],
  'planning.read': ['admin', 'staff', 'technicien'],
  'planning.write': ['admin', 'staff'],
  'terrain.execute': ['admin', 'staff', 'technicien'],
  'settings.read': ['admin', 'staff'],
  'settings.write': ['admin'],
  'automations.manage': ['admin'],
  'audit.read': ['admin'],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}
