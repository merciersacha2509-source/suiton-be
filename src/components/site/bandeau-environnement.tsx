import Link from 'next/link';
import { appEnv } from '@/lib/env';

/**
 * Bandeau d'environnement.
 *
 * Visible partout SAUF en production. Sa raison d'etre est d'empecher une
 * confusion couteuse : croire qu'on regarde le site reel alors qu'on est sur
 * une preview, ou l'inverse. Les deux erreurs se paient — la premiere en
 * decisions prises sur de fausses donnees, la seconde en donnees de test
 * creees dans la vraie base.
 *
 * Il porte aussi les liens des outils de developpement : c'est le seul
 * endroit ou ils sont decouvrables, et ils disparaissent avec lui.
 */
export function BandeauEnvironnement() {
  const env = appEnv();
  if (env === 'production') return null;

  const preview = env === 'preview';

  return (
    <div
      role="status"
      className={
        preview
          ? 'bg-alerte text-white'
          : 'bg-abysse-80 text-mineral'
      }
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[0.75rem]">
        <span className="font-heading font-semibold tracking-[0.08em] uppercase">
          {preview ? 'Preview' : 'Développement'}
        </span>
        <span className="opacity-90">
          {preview
            ? 'Version de test — non indexée, aucun courriel envoyé, données de démonstration.'
            : 'Machine locale — aucun courriel envoyé, données de démonstration.'}
        </span>
        <Link href="/dev/emails" className="ml-auto underline underline-offset-2">
          Courriels capturés
        </Link>
      </div>
    </div>
  );
}
