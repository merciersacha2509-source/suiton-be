import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ForbiddenError } from '@/lib/errors';
import { can, type Capability } from '@/lib/auth/roles';
import type { Profile } from '@/types/database';

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Session courante. `cache` deduplique l'appel : dix composants serveur
 * dans le meme rendu ne declenchent qu'une seule requete.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (error || !profile || !profile.actif) return null;

  return { userId: user.id, email: user.email ?? '', profile };
});

/** Impose une session. Redirige vers la connexion sinon. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/connexion');
  return session;
}

/**
 * Impose une capacite.
 *
 * Ce garde n'est pas la securite : la RLS l'est. Il evite d'afficher un
 * ecran a quelqu'un qui n'en verrait que des erreurs.
 */
export async function requireCapability(capability: Capability): Promise<Session> {
  const session = await requireSession();
  if (!can(session.profile.role, capability)) {
    throw new ForbiddenError('Votre role ne donne pas acces a cette page.');
  }
  return session;
}
