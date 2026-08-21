'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { cn } from '@/lib/cn';

/**
 * Barre d'action permanente, sur mobile.
 *
 * Appeler · WhatsApp · Réserver, toujours accessibles. Sur un chantier ou en
 * voiture, un visiteur ne remonte pas en haut de page pour chercher un
 * numero : soit l'action est sous le pouce, soit elle n'a pas lieu.
 *
 * Elle apparait apres 400 px de defilement seulement : afficher trois boutons
 * par-dessus la proposition de valeur, des la premiere seconde, dessert
 * precisement ce qu'on cherche a obtenir.
 */
export function ActionsPermanentes() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const surDefilement = () => setVisible(window.scrollY > 400);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  return (
    <div
      className={cn(
        'border-mineral-dark fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur',
        'transition-transform duration-200 lg:hidden',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-3">
        <a
          href={`tel:${ENTREPRISE.telephoneE164}`}
          className="border-mineral-dark flex h-14 flex-col items-center justify-center gap-0.5 border-r"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M4.5 3h3l1.5 3.5-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2L17 12.5v3a1.5 1.5 0 0 1-1.6 1.5A13 13 0 0 1 3 4.6 1.5 1.5 0 0 1 4.5 3Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[0.6875rem] font-medium">Appeler</span>
        </a>

        <a
          href={`https://wa.me/${ENTREPRISE.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-mineral-dark flex h-14 flex-col items-center justify-center gap-0.5 border-r"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 2.5a7.5 7.5 0 0 0-6.4 11.4L2.5 17.5l3.7-1.1A7.5 7.5 0 1 0 10 2.5Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M7.4 7.2c.3-.1.6 0 .8.3l.5.9c.1.2.1.4 0 .6l-.3.4c.4.8 1 1.4 1.8 1.8l.4-.3c.2-.1.4-.1.6 0l.9.5c.3.2.4.5.3.8-.2.5-.7.9-1.3.9-2 0-4.2-2.2-4.2-4.2 0-.6.3-1.1.9-1.3Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-[0.6875rem] font-medium">WhatsApp</span>
        </a>

        <Link
          href="/reservation"
          className="bg-abysse text-mineral flex h-14 flex-col items-center justify-center gap-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M3.5 5.5h13v11h-13v-11ZM6.5 3v3M13.5 3v3M3.5 9h13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[0.6875rem] font-semibold">Réserver</span>
        </Link>
      </div>
    </div>
  );
}
