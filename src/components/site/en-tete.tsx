'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SuitonLogo } from '@/components/brand/suiton-mark';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { cn } from '@/lib/cn';

const LIENS = [
  { href: '/nettoyage-fin-de-chantier', label: 'Fin de chantier' },
  { href: '/nettoyage-apres-renovation', label: 'Après rénovation' },
  { href: '/nettoyage-de-vitres', label: 'Vitres' },
  { href: '/realisations', label: 'Réalisations' },
  { href: '/professionnels', label: 'Professionnels' },
];

export function EnTete() {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  return (
    <header className="border-mineral-dark sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" aria-label="SUITON — accueil" className="shrink-0">
          <SuitonLogo />
        </Link>

        <nav aria-label="Navigation principale" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LIENS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={chemin === l.href ? 'page' : undefined}
                  className={cn(
                    'rounded-suiton flex h-9 items-center px-3 text-[0.8125rem] transition-colors',
                    chemin === l.href
                      ? 'bg-mineral text-abysse font-medium'
                      : 'text-ardoise hover:bg-mineral hover:text-abysse',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a
            href={`tel:${ENTREPRISE.telephoneE164}`}
            className="h-touch rounded-suiton text-ocean hover:bg-mineral hidden items-center px-3 text-sm font-medium sm:flex"
          >
            {ENTREPRISE.telephone}
          </a>
          <Link
            href="/reservation"
            className="h-touch rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 hidden items-center px-4 text-sm font-medium transition-colors sm:flex"
          >
            Obtenir un devis
          </Link>

          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            aria-controls="menu-mobile"
            className="h-touch w-touch rounded-suiton hover:bg-mineral flex items-center justify-center lg:hidden"
          >
            <span className="sr-only">Menu</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d={ouvert ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {ouvert ? (
        <nav
          id="menu-mobile"
          aria-label="Navigation"
          className="border-mineral-dark border-t lg:hidden"
        >
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {LIENS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOuvert(false)}
                  className="h-touch flex items-center text-sm"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="border-mineral-dark mt-2 border-t pt-2">
              <Link
                href="/reservation"
                onClick={() => setOuvert(false)}
                className="h-touch rounded-suiton bg-abysse text-mineral flex items-center justify-center text-sm font-medium"
              >
                Obtenir un devis
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
