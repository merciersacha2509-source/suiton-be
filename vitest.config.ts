import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  /**
   * tsconfig.json declare `jsx: preserve` — c'est Next.js qui transforme le
   * JSX au build. Vitest, lui, doit le transformer lui-meme, d'ou cette
   * surcharge esbuild locale.
   */
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Marqueur Next.js, non resolvable hors bundler. Voir le stub.
      'server-only': fileURLToPath(
        new URL('./src/tests/stubs/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
