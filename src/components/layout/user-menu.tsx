'use client';

import { useEffect, useRef, useState } from 'react';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { logoutAction } from '@/app/(auth)/connexion/actions';
import type { AppRole } from '@/types/database';

export function UserMenu({ nom, email, role }: { nom: string; email: string; role: AppRole }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  // Fermeture au clic exterieur et a Echap : un menu qui ne se ferme qu'en
  // recliquant sur son declencheur est une impasse au clavier.
  useEffect(() => {
    if (!ouvert) return;

    const surClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };

    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert]);

  const initiales = nom
    .split(' ')
    .map((m) => m[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="h-touch rounded-suiton hover:bg-mineral flex items-center gap-2 px-2"
      >
        <span className="bg-abysse text-mineral flex h-8 w-8 items-center justify-center rounded-full text-[0.75rem] font-semibold">
          {initiales || '?'}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[0.8125rem] leading-tight font-medium">{nom}</span>
          <span className="text-ardoise block text-[0.75rem] leading-tight">
            {ROLE_LABELS[role]}
          </span>
        </span>
      </button>

      {ouvert ? (
        <div
          role="menu"
          className="rounded-suiton border-mineral-dark absolute top-full right-0 z-30 mt-1 w-60 border bg-white py-1 shadow-lg"
        >
          <div className="border-mineral-dark border-b px-3 py-2">
            <p className="truncate text-[0.8125rem] font-medium">{nom}</p>
            <p className="text-ardoise truncate text-[0.75rem]">{email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="h-touch text-danger hover:bg-danger-wash flex w-full items-center px-3 text-left text-sm"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
