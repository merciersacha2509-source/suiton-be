import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'coverage/**',
      // Generes par `supabase start` — memes chemins que .gitignore.
      'supabase/.temp/**',
      'supabase/.branches/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      /**
       * Le client de service contourne la RLS. Il n'a que quatre usages
       * legitimes, tous hors session utilisateur :
       *   - les services metier (src/lib/services, src/lib/storage…)
       *   - les routes API publiques (reservation, creneaux, depot de photos)
       *   - le portail client, qui fonctionne par jeton et non par session
       *   - le formulaire public, qui lit la grille tarifaire
       *
       * Partout ailleurs, si un utilisateur authentifie ne peut pas lire une
       * donnee avec son propre client, c'est la politique RLS qu'il faut
       * corriger — pas le client qu'il faut changer.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/supabase/admin', '**/supabase/admin'],
              importNames: ['createAdminClient'],
              message:
                'Le client admin contourne la RLS. Passez par src/lib/storage.ts ou un service de src/lib/services/.',
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * Photos de chantier : <img> plutot que next/image, deliberement.
     *
     * Les images viennent de Supabase Storage par URL SIGNEE. La signature
     * change a chaque regeneration : l'optimiseur de Next la traiterait comme
     * une image differente a chaque fois, ne mettrait jamais rien en cache, et
     * refacturerait chaque transformation. On perdrait le benefice tout en
     * payant le cout.
     *
     * Ce que next/image apporte est deja obtenu autrement : `traiterPhoto`
     * produit un webp et une miniature a l'ingestion, la grille sert la
     * miniature, le rapport sert le webp. Les conteneurs ont un ratio fixe
     * (aspect-[4/3] ou padding proportionnel), donc aucun decalage de mise en
     * page, et tout est en `loading="lazy"` sous la ligne de flottaison.
     */
    files: ['src/components/site/comparaison.tsx', 'src/app/(site)/realisations/**/*.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    // @react-pdf/renderer expose un composant <Image> sans prop alt : la
    // regle jsx-a11y vise les balises du DOM, pas un noeud de rendu PDF.
    files: ['src/lib/pdf/**/*.tsx'],
    rules: { 'jsx-a11y/alt-text': 'off' },
  },
  {
    // Exceptions revues une par une. Toute addition a cette liste est une
    // decision d'architecture, pas un contournement.
    files: [
      'src/lib/services/**/*.ts',
      'src/lib/storage.ts',
      'src/lib/rate-limit.ts',
      'src/app/api/booking/route.ts',
      'src/app/api/slots/route.ts',
      'src/app/api/photos/**/*.ts',
      'src/app/portail/**/*.ts',
      'src/app/portail/**/*.tsx',
      'src/app/(site)/**/*.tsx',
      // Le site public lit la grille tarifaire hors session, a la
      // regeneration ISR : il n'existe aucun utilisateur a ce moment-la.
      'src/lib/site/tarifs.ts',
      // Meme raison : les realisations publiques sont lues hors session, a la
      // regeneration. La publication elle-meme reste soumise a la RLS.
      'src/lib/site/realisations.ts',
      'src/app/(app)/chantiers/**/actions.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
];

export default config;
