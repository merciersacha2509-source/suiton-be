'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SuitonLogo } from '@/components/brand/suiton-mark';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { cn } from '@/lib/cn';

/*
 * SUITON se positionne d'abord comme le specialiste du nettoyage de fin de
 * chantier / apres renovation, avec une cible B2B prioritaire. Auto et
 * Textile sont des prestations reelles mais secondaires : leur presence a
 * egalite dans le menu principal brouillait ce positionnement, d'ou le
 * regroupement sous un sous-menu plutot qu'une suppression.
 */
const LIENS = [
  { href: '/nettoyage-fin-de-chantier', label: 'Fin de chantier' },
  { href: '/nettoyage-apres-renovation', label: 'Après rénovation' },
  { href: '/professionnels', label: 'Professionnels' },
  { href: '/nettoyage-de-vitres', label: 'Vitres' },
  { href: '/realisations', label: 'Réalisations' },
];

const COMPLEMENTAIRES = [
  { href: '/nettoyage-auto', label: 'Nettoyage auto' },
  { href: '/nettoyage-textile', label: 'Nettoyage textile' },
];

export function EnTete() {
  const [ouvert, setOuvert] = useState(false);
  const [descendu, setDescendu] = useState(false);
  const [sousMenuOuvert, setSousMenuOuvert] = useState(false);
  const chemin = usePathname();
  const sousMenuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const surScroll = () => setDescendu(window.scrollY > 8);
    surScroll();
    window.addEventListener('scroll', surScroll, { passive: true });
    return () => window.removeEventListener('scroll', surScroll);
  }, []);

  useEffect(() => {
    if (!sousMenuOuvert) return;
    const surClicExterieur = (e: MouseEvent) => {
      if (sousMenuRef.current && !sousMenuRef.current.contains(e.target as Node)) {
        setSousMenuOuvert(false);
      }
    };
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSousMenuOuvert(false);
    };
    document.addEventListener('mousedown', surClicExterieur);
    document.addEventListener('keydown', surEchap);
    return () => {
      document.removeEventListener('mousedown', surClicExterieur);
      document.removeEventListener('keydown', surEchap);
    };
  }, [sousMenuOuvert]);

  const surPageComplementaire = COMPLEMENTAIRES.some((l) => l.href === chemin);

  return (
    <header
      className={cn(
        'border-mineral-dark sticky top-0 z-30 border-b transition-[background-color,box-shadow] duration-200',
        descendu
          ? 'bg-white/85 shadow-[0_1px_12px_rgba(11,34,57,0.06)] backdrop-blur-md'
          : 'bg-white/95 backdrop-blur',
      )}
    >
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
                    'rounded-suiton relative flex h-9 items-center px-3 text-[0.8125rem] transition-colors duration-150',
                    chemin === l.href
                      ? 'text-abysse font-medium'
                      : 'text-ardoise hover:bg-mineral hover:text-abysse',
                  )}
                >
                  {l.label}
                  {chemin === l.href ? (
                    <span
                      className="bg-aqua-deep absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              </li>
            ))}
            <li ref={sousMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setSousMenuOuvert((v) => !v)}
                aria-expanded={sousMenuOuvert}
                aria-haspopup="true"
                className={cn(
                  'rounded-suiton relative flex h-9 items-center gap-1 px-3 text-[0.8125rem] transition-colors duration-150',
                  surPageComplementaire
                    ? 'text-abysse font-medium'
                    : 'text-ardoise hover:bg-mineral hover:text-abysse',
                )}
              >
                Services complémentaires
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden
                  className={cn('transition-transform duration-150', sousMenuOuvert && 'rotate-180')}
                >
                  <path
                    d="M2 3.5L5 6.5L8 3.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {surPageComplementaire ? (
                  <span
                    className="bg-aqua-deep absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                    aria-hidden
                  />
                ) : null}
              </button>
              {sousMenuOuvert ? (
                <ul className="rounded-suiton border-mineral-dark absolute top-[calc(100%+0.5rem)] right-0 w-56 border bg-white p-1.5 shadow-lg">
                  {COMPLEMENTAIRES.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setSousMenuOuvert(false)}
                        aria-current={chemin === l.href ? 'page' : undefined}
                        className={cn(
                          'rounded-suiton flex h-9 items-center px-3 text-sm transition-colors duration-150',
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
              ) : null}
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a
            href={`tel:${ENTREPRISE.telephoneE164}`}
            className="h-touch rounded-suiton text-ocean hover:bg-mineral hidden items-center px-3 text-sm font-medium transition-colors duration-150 sm:flex"
          >
            {ENTREPRISE.telephone}
          </a>
          <Link
            href="/reservation"
            className="h-touch rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 hidden items-center px-4 text-sm font-medium tracking-[0.01em] shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0 sm:flex"
          >
            Obtenir un devis
          </Link>

          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            aria-controls="menu-mobile"
            className="h-touch w-touch rounded-suiton hover:bg-mineral flex items-center justify-center transition-colors duration-150 lg:hidden"
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
              <li key={l.href} className="border-mineral-dark border-b last:border-b-0">
                <Link
                  href={l.href}
                  onClick={() => setOuvert(false)}
                  aria-current={chemin === l.href ? 'page' : undefined}
                  className={cn(
                    'h-touch flex items-center text-sm transition-colors duration-150',
                    chemin === l.href ? 'text-abysse font-medium' : 'text-ardoise',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="border-mineral-dark border-b pt-3 pb-1">
              <p className="text-ardoise-clair text-[0.6875rem] font-medium tracking-[0.12em] uppercase">
                Services complémentaires
              </p>
            </li>
            {COMPLEMENTAIRES.map((l) => (
              <li key={l.href} className="border-mineral-dark border-b last:border-b-0">
                <Link
                  href={l.href}
                  onClick={() => setOuvert(false)}
                  aria-current={chemin === l.href ? 'page' : undefined}
                  className={cn(
                    'h-touch flex items-center text-sm transition-colors duration-150',
                    chemin === l.href ? 'text-abysse font-medium' : 'text-ardoise',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="mt-3 pb-1">
              <Link
                href="/reservation"
                onClick={() => setOuvert(false)}
                className="h-touch rounded-suiton bg-abysse text-mineral flex items-center justify-center text-sm font-medium shadow-sm transition-[background-color,box-shadow] duration-200 active:shadow-none"
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
