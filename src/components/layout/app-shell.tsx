'use client';

import { useState } from 'react';
import { SuitonLogo } from '@/components/brand/suiton-mark';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/auth/roles';
import type { AppRole } from '@/types/database';

/**
 * Coquille applicative.
 *
 * Mobile-first : la barre laterale est un tiroir sous 1024 px et une colonne
 * fixe au-dela. L'application se consulte depuis un telephone, sur un
 * chantier, parfois avec des gants — toutes les cibles font 44 px.
 */
export function AppShell({
  role,
  nom,
  email,
  children,
}: {
  role: AppRole;
  nom: string;
  email: string;
  children: React.ReactNode;
}) {
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  return (
    <div className="min-h-dvh lg:flex">
      {/* --- Barre laterale ------------------------------------------------ */}
      <aside
        id="navigation-laterale"
        className={cn(
          'bg-abysse fixed inset-y-0 left-0 z-40 flex w-64 flex-col px-3 py-4',
          'transition-transform duration-200 lg:static lg:translate-x-0',
          tiroirOuvert ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 px-2">
          <SuitonLogo inverse />
        </div>

        <SidebarNav role={role} onNavigate={() => setTiroirOuvert(false)} />

        <div className="mt-auto border-t border-white/10 px-2 pt-3">
          <p className="text-mineral/50 text-[0.75rem]">SUITON OS 1.0 · Sprint 1</p>
          <p className="text-mineral/40 text-[0.75rem]">{ROLE_LABELS[role]}</p>
        </div>
      </aside>

      {/* Voile du tiroir mobile */}
      {tiroirOuvert ? (
        <button
          type="button"
          aria-label="Fermer la navigation"
          onClick={() => setTiroirOuvert(false)}
          className="bg-abysse/50 fixed inset-0 z-30 lg:hidden"
        />
      ) : null}

      {/* --- Colonne principale -------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-mineral-dark sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white px-4">
          <button
            type="button"
            onClick={() => setTiroirOuvert((v) => !v)}
            aria-expanded={tiroirOuvert}
            aria-controls="navigation-laterale"
            className="h-touch w-touch rounded-suiton hover:bg-mineral flex items-center justify-center lg:hidden"
          >
            <span className="sr-only">Ouvrir la navigation</span>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none">
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="lg:hidden">
            <SuitonLogo />
          </div>

          <div className="ml-auto">
            <UserMenu nom={nom} email={email} role={role} />
          </div>
        </header>

        <main id="contenu" className="flex-1 px-4 py-5 sm:px-6 sm:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
