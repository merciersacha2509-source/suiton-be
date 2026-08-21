import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';

/**
 * Client de service. CONTOURNE LA RLS.
 *
 * N'a que trois usages legitimes :
 *   1. l'ecriture d'une reservation publique, validee en amont (Sprint 2) ;
 *   2. les webhooks entrants signes (Sprint 8) ;
 *   3. les taches planifiees.
 *
 * Toute autre utilisation est une erreur de conception : si un utilisateur
 * authentifie ne peut pas lire une donnee avec son propre client, c'est la
 * politique RLS qu'il faut corriger, pas le client qu'il faut changer.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
