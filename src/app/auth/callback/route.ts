import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Echange du code OAuth / lien magique contre une session.
 *
 * La destination est validee : accepter une URL absolue permettrait une
 * redirection ouverte vers un site tiers.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const suite = searchParams.get('suite');

  const destination =
    suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : '/tableau-de-bord';

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=code_manquant`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/connexion?erreur=session`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
