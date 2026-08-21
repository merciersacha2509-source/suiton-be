import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/**
 * Client serveur lie a la session de l'utilisateur.
 * Soumis a la RLS : c'est le client par defaut de toute lecture metier.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Appele depuis un Server Component : les cookies y sont en
            // lecture seule. Le middleware rafraichit deja la session,
            // donc ignorer est sans consequence.
          }
        },
      },
    },
  );
}
