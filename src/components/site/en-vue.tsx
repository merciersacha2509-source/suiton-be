'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fait apparaitre son contenu quand il entre dans le viewport.
 *
 * Un seul IntersectionObserver par instance, deconnecte des qu'il a
 * declenche une fois — inutile de continuer a observer un element deja
 * apparu. `prefers-reduced-motion` est deja neutralise globalement
 * (globals.css) : rien de plus a faire ici pour le respecter.
 */
export function EnVue({
  children,
  className,
  delai = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Decalage en ms, pour faire apparaitre plusieurs blocs en cascade. */
  delai?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree?.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' },
    );

    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`en-vue ${visible ? 'est-visible' : ''} ${className ?? ''}`}
      style={delai ? { transitionDelay: `${delai}ms` } : undefined}
    >
      {children}
    </div>
  );
}
