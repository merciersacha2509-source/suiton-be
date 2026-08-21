import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware.
 *
 * Deux responsabilites, pas trois :
 *   1. rafraichir la session Supabase sur les chemins qui en ont une ;
 *   2. rediriger vers la connexion ce qui exige une session.
 *
 * Les autorisations fines ne sont PAS ici : le middleware ne connait pas le
 * role sans une requete supplementaire sur chaque navigation. Les gardes de
 * role vivent dans les layouts serveur, et la RLS tranche en dernier ressort.
 *
 * ---------------------------------------------------------------------------
 * Depuis la mise en ligne de suiton.be, la logique est INVERSEE.
 *
 * Auparavant, tout etait protege sauf une liste de chemins publics. Le site
 * public compte desormais une vingtaine de pages et en gagnera d'autres :
 * une liste blanche aurait fini par oublier une page, et une page de vente
 * derriere un ecran de connexion ne se remarque pas tout de suite.
 *
 * Surtout : `updateSession()` appelle Supabase. L'executer sur chaque visite
 * d'une page marketing ajoute un aller-retour reseau au TTFB de visiteurs qui
 * n'ont pas de session et n'en auront jamais. On ne le fait donc que sur
 * l'espace applicatif.
 * ---------------------------------------------------------------------------
 */

/** Espace applicatif : session obligatoire. */
const CHEMINS_PROTEGES = [
  '/tableau-de-bord',
  '/chantiers',
  '/clients',
  '/planning',
  '/terrain',
  '/facturation',
  '/donnees',
  '/intelligence',
  '/playbook',
  '/parametres',
];

/**
 * Chemins qui ont besoin d'une session rafraichie sans l'exiger :
 * la page de connexion (pour rediriger un utilisateur deja connecte) et le
 * rappel OAuth.
 */
const CHEMINS_SESSION = ['/connexion', '/auth'];

/**
 * Outils de developpement.
 *
 * Le layout de /dev renvoie deja 404 en production. Le middleware ne les
 * protege donc pas davantage — mais il ne doit pas non plus les traiter comme
 * l'espace applicatif et exiger une session : ces pages servent precisement a
 * verifier ce qui se passe avant qu'un compte existe.
 */

const correspond = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const protege = correspond(pathname, CHEMINS_PROTEGES);
  const sessionUtile = protege || correspond(pathname, CHEMINS_SESSION);

  // Site public, portail client (protege par jeton), API publiques :
  // aucun appel a Supabase, aucun cookie touche.
  if (!sessionUtile) return NextResponse.next();

  const { response, user } = await updateSession(request);

  if (user && pathname === '/connexion') {
    return NextResponse.redirect(new URL('/tableau-de-bord', request.url));
  }

  if (protege && !user) {
    const url = new URL('/connexion', request.url);
    // On memorise la destination pour y revenir apres authentification.
    url.searchParams.set('suite', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et les images optimisees.
     * Faire passer /_next/static dans le middleware couterait un aller-retour
     * Supabase par fichier.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?)$).*)',
  ],
};
