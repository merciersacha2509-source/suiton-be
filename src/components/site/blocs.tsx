import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Blocs de mise en page du site public.
 *
 * Un seul rythme vertical, un seul jeu de largeurs, une seule maniere de
 * titrer une section. Sans cela, dix-neuf pages ecrites a la suite finissent
 * avec dix-neuf espacements differents et le site perd exactement ce qu'on
 * lui demande : l'air d'etre tenu.
 */

export function Section({
  children,
  fond = 'blanc',
  className,
  id,
}: {
  children: ReactNode;
  fond?: 'blanc' | 'mineral' | 'abysse';
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-20',
        fond === 'mineral' && 'bg-mineral',
        fond === 'abysse' && 'bg-abysse text-mineral',
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </section>
  );
}

export function TitreSection({
  surtitre,
  titre,
  chapeau,
  centre = false,
  inverse = false,
  niveau = 2,
}: {
  surtitre?: string;
  titre: string;
  chapeau?: string;
  centre?: boolean;
  inverse?: boolean;
  niveau?: 2 | 3;
}) {
  const H = niveau === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('max-w-2xl', centre && 'mx-auto text-center')}>
      {surtitre ? (
        <p
          className={cn(
            'inline-flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase',
            inverse ? 'text-aqua' : 'text-aqua-deep',
          )}
        >
          <span
            className={cn('h-1 w-1 shrink-0 rounded-full', inverse ? 'bg-aqua' : 'bg-aqua-deep')}
            aria-hidden
          />
          {surtitre}
        </p>
      ) : null}
      <H className={cn('mt-3 text-2xl font-semibold sm:text-3xl', inverse && 'text-mineral')}>
        {titre}
      </H>
      {chapeau ? (
        <p
          className={cn(
            'mt-4 text-base leading-relaxed',
            inverse ? 'text-mineral/70' : 'text-ardoise',
          )}
        >
          {chapeau}
        </p>
      ) : null}
    </div>
  );
}

/** Coche dessinee : aucune dependance a une police d'icones. */
export function Coche({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn('mt-1 shrink-0', className)}
    >
      <path
        d="M3 8.5l3.2 3.2L13 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Croix({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn('mt-1 shrink-0', className)}
    >
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ListePuces({
  items,
  ton = 'positif',
}: {
  items: readonly string[];
  ton?: 'positif' | 'negatif';
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-sm leading-relaxed">
          {ton === 'positif' ? (
            <Coche className="text-aqua-deep" />
          ) : (
            <Croix className="text-ardoise-clair" />
          )}
          <span className={ton === 'negatif' ? 'text-ardoise' : undefined}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Carte({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-suiton border-mineral-dark border bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Faq({
  items,
  titre = 'Questions fréquentes',
}: {
  items: readonly { question: string; reponse: string }[];
  titre?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold sm:text-3xl">{titre}</h2>
      <div className="divide-mineral-dark border-mineral-dark mt-8 divide-y border-y">
        {items.map((f) => (
          <details key={f.question} className="group py-4">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
              <span className="font-heading text-base font-medium">{f.question}</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden
                className="text-ardoise mt-1 shrink-0 transition-transform group-open:rotate-45"
              >
                <path
                  d="M9 3.5v11M3.5 9h11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </summary>
            <p className="text-ardoise mt-3 max-w-2xl pr-8 text-sm leading-relaxed">
              {f.reponse}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function AppelFinal({
  titre = 'Un chantier à livrer ?',
  texte = 'Décrivez-le en deux minutes. Vous recevez un devis ferme sous 24 heures ouvrées — vitres et châssis compris, rapport photo systématique.',
}: {
  titre?: string;
  texte?: string;
}) {
  return (
    <Section fond="abysse">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-mineral text-2xl font-semibold sm:text-3xl">{titre}</h2>
        <p className="text-mineral/70 mt-4 text-base leading-relaxed">{texte}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/reservation"
            className="rounded-suiton bg-aqua text-abysse flex h-12 items-center justify-center px-6 text-sm font-semibold shadow-sm transition-[opacity,transform,box-shadow] duration-200 hover:-translate-y-px hover:opacity-90 hover:shadow-md active:translate-y-0"
          >
            Obtenir un devis gratuit
          </Link>
          <Link
            href="/contact"
            className="rounded-suiton text-mineral flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-medium transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/5 active:translate-y-0"
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </Section>
  );
}

/**
 * Fil d'Ariane visible. Le JSON-LD correspondant est injecte separement :
 * Google veut les deux, et un fil d'Ariane visible sert aussi a l'humain qui
 * arrive sur une page locale depuis une recherche.
 */
export function FilAriane({ items }: { items: { nom: string; href: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mx-auto max-w-6xl px-4 pt-6">
      <ol className="text-ardoise flex flex-wrap items-center gap-1.5 text-xs">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-abysse">
                {item.nom}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-abysse">
                {item.nom}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
