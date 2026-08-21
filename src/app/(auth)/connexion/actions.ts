'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getDefaultRouteForRole, estRouteAutoriseePourRole } from '@/lib/auth/routes';
import { loginSchema } from '@/lib/validation/auth';

export interface LoginState {
  error?: string;
  champs?: Record<string, string>;
}

/**
 * Connexion.
 *
 * Le message d'erreur est volontairement identique que l'adresse existe ou
 * non : distinguer les deux permettrait d'enumerer les comptes.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    motDePasse: formData.get('motDePasse'),
  });

  if (!parsed.success) {
    const champs: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !champs[key]) champs[key] = issue.message;
    }
    return { champs };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.motDePasse,
  });

  if (error) {
    return { error: 'Identifiants incorrects.' };
  }

  // signInWithPassword() pose les cookies de session sur ce meme request ;
  // getSession() les relit immediatement — pas d'aller-retour supplementaire.
  const session = await getSession();
  if (!session) {
    await supabase.auth.signOut();
    return { error: 'Compte introuvable ou desactive. Contactez la direction.' };
  }

  const role = session.profile.role;
  const destinationParDefaut = getDefaultRouteForRole(role);

  const suiteBrut = formData.get('suite');
  const suiteSyntaxeValide =
    typeof suiteBrut === 'string' && suiteBrut.startsWith('/') && !suiteBrut.startsWith('//');
  // Query string et fragment ecartes uniquement pour la verification de
  // capacite : la redirection elle-meme garde le suite= complet.
  const suiteChemin = suiteSyntaxeValide
    ? (suiteBrut.split('?')[0] ?? suiteBrut).split('#')[0] ?? ''
    : '';
  const destination =
    suiteSyntaxeValide && estRouteAutoriseePourRole(suiteChemin, role)
      ? (suiteBrut as string)
      : destinationParDefaut;

  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/connexion');
}
