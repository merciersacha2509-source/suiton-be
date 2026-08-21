'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/**
 * Client navigateur. Porte la cle anonyme et est soumis a la RLS.
 * Il ne sert qu'a l'authentification et aux abonnements temps reel ;
 * toute lecture metier passe par un composant serveur.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
