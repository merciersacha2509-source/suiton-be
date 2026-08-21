import localFont from 'next/font/local';

/**
 * Polices de marque, auto-hebergees.
 *
 * On passe par `next/font/local` plutot que par les feuilles @fontsource
 * pour trois raisons, toutes mesurables sur le LCP :
 *
 *   1. Next emet un <link rel="preload"> pour les fichiers reellement
 *      utilises. Sans cela, la requete de police ne part qu'apres l'analyse
 *      du CSS — c'est-a-dire apres le chemin critique, exactement au mauvais
 *      moment pour un titre H1.
 *
 *   2. Seuls les sous-ensembles latins sont embarques. Les feuilles
 *      @fontsource declaraient 45 @font-face (cyrillique, grec, vietnamien),
 *      soit une trentaine de kilo-octets de CSS bloquant pour des alphabets
 *      qu'un site belge francophone n'affichera jamais.
 *
 *   3. `adjustFontFallback` calcule un `size-adjust` sur la police de repli.
 *      Le texte affiche pendant le chargement occupe alors la meme place que
 *      le texte final : la substitution ne decale plus la mise en page, et le
 *      CLS reste a zero au lieu de dependre de la vitesse du reseau.
 */

export const jura = localFont({
  src: [
    // Jura ne sert qu'aux titres, jamais au corps de texte : la graisse 400
    // n'est utilisee nulle part et n'est donc pas embarquee (14 ko de moins
    // sur le chemin critique, precharges compris).
    { path: './fonts/jura-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/jura-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--police-titre',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
  preload: true,
});

export const inter = localFont({
  src: [
    { path: './fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--police-texte',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
  preload: true,
});
